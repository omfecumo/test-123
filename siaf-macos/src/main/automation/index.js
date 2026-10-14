'use strict';
/* «SIAF Control y Automatización» — orquestación en el proceso principal.
   Ventanas: siaf://control/index.html (gestión) y siaf://control/hud.html (barra flotante durante la ejecución
   con «Pausar» y «Detener»). Atajo global para detener: ⌘⇧⎋ (Command+Shift+Escape), registrado solo mientras
   hay una grabación o ejecución activa. */
const { BrowserWindow, ipcMain, dialog, shell, globalShortcut, systemPreferences, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const log = require('../log');
const { Almacen } = require('./store');
const { Ejecucion } = require('./runner');
const { DriverSIAF } = require('./driver-siaf');
const { DriverMacOS, ejecutarArchivo } = require('./driver-macos');
const { Auxiliar } = require('./helper-client');
const { limpiarPaso, limpiarSecuencia, describirPaso, TIPOS, FORMATO, VERSION, BUNDLE } = require('./schema');

const AJUSTES = {
  accesibilidad: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility',
  monitorEntrada: 'x-apple.systempreferences:com.apple.preference.security?Privacy_ListenEvent',
  automatizacion: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Automation',
  pantalla: 'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture',
};

let ctx = null, almacen = null, aux = null;
let control = null, hud = null;
let grabacion = null;     // { objetivo, pasos: [] }
let ejecucion = null;     // Ejecucion activa
let manualPendiente = null, abortarDialogo = null;
const PRELOAD = path.join(__dirname, '..', '..', 'preload', 'preload-control.js');

function aVentanas(canal, datos) { for (const w of [control, hud]) if (w && !w.isDestroyed()) w.webContents.send(canal, datos); }
const notificar = (tipo, datos = {}) => aVentanas('ctrl:evento', { tipo, ...datos });

function abrirControl(pestana) {
  if (control && !control.isDestroyed()) { control.show(); control.focus(); if (pestana) notificar('pestana', { pestana }); return control; }
  control = new BrowserWindow({
    width: 1180, height: 780, minWidth: 860, minHeight: 560, title: 'SIAF Control y Automatización', show: false,
    webPreferences: { preload: PRELOAD, contextIsolation: true, sandbox: true, nodeIntegration: false },
  });
  control.once('ready-to-show', () => control.show());
  control.on('closed', () => { control = null; });
  control.loadURL('siaf://control/index.html' + (pestana ? '#' + pestana : ''));
  return control;
}

function mostrarHUD() {
  if (hud && !hud.isDestroyed()) return;
  const a = screen.getPrimaryDisplay().workArea;
  hud = new BrowserWindow({
    width: 460, height: 96, x: a.x + a.width - 480, y: a.y + 16, frame: false, resizable: false, alwaysOnTop: true, skipTaskbar: true,
    focusable: true, transparent: false, title: 'Automatización en curso', show: false, hasShadow: true,
    webPreferences: { preload: PRELOAD, contextIsolation: true, sandbox: true, nodeIntegration: false },
  });
  hud.setAlwaysOnTop(true, 'floating'); hud.setVisibleOnAllWorkspaces(true);
  hud.once('ready-to-show', () => hud.showInactive());
  hud.on('closed', () => { hud = null; });
  hud.loadURL('siaf://control/hud.html');
}
function cerrarHUD() { if (hud && !hud.isDestroyed()) hud.close(); hud = null; }

function registrarAtajo() {
  const acc = (ctx.config.get('automatizacion') || {}).atajoDetener || 'CommandOrControl+Shift+Escape';
  try { if (!globalShortcut.isRegistered(acc)) globalShortcut.register(acc, () => detenerTodo('atajo de teclado')); } catch (e) { log.aviso('No se pudo registrar el atajo de detención', e.message); }
}
function liberarAtajo() { if (!grabacion && !ejecucion) globalShortcut.unregisterAll(); }

// ---------------- grabación ----------------
async function iniciarGrabacion(objetivo, opciones = {}) {
  if (grabacion) throw new Error('Ya hay una grabación en curso.');
  if (ejecucion) throw new Error('Detenga la ejecución en curso antes de grabar.');
  const obj = objetivo && objetivo.tipo === 'app' ? { tipo: 'app', bundleId: objetivo.bundleId, nombreApp: objetivo.nombreApp || objetivo.bundleId } : { tipo: 'siaf' };
  if (obj.tipo === 'siaf') {
    const v = ctx.ventanaSIAF(); if (!v) throw new Error('Abra la ventana de SIAF.');
    grabacion = { objetivo: obj, pasos: [], inicio: new Date().toISOString() };
    v.webContents.send('escritorio:comando', { accion: 'grabar-iniciar' });
  } else {
    if (!BUNDLE.test(obj.bundleId || '') || !almacen.appAutorizada(obj.bundleId)) throw new Error('Elija una aplicación autorizada.');
    const d = aux.disponible(); if (!d.ok) throw new Error(d.motivo);
    const per = await aux.pedir('permisos');
    if (!per.accesibilidad) throw new Error('Falta el permiso de Accesibilidad para SIAF (Ajustes del Sistema → Privacidad y seguridad → Accesibilidad).');
    if (opciones.teclado && !per.monitorEntrada) throw new Error('Para grabar el teclado de otras apps, SIAF necesita «Monitorización de entrada». Puede grabar solo clics desmarcando «Grabar teclado».');
    grabacion = { objetivo: obj, pasos: [{ ...limpiarPaso({ tipo: 'activarApp', bundleId: obj.bundleId }, 'app') }], inicio: new Date().toISOString() };
    await aux.pedir('grabar', { apps: [obj.bundleId], teclado: !!opciones.teclado });
  }
  registrarAtajo();
  log.info('Grabación iniciada', obj.tipo, obj.bundleId || '');
  notificar('grabacion', { activa: true, objetivo: obj, pasos: grabacion.pasos.map(p => ({ paso: p, descripcion: describirPaso(p) })) });
  return { ok: true };
}
function agregarPasoGrabado(crudo) {
  if (!grabacion) return;
  try {
    const p = limpiarPaso(crudo, grabacion.objetivo.tipo);
    // fusiona escrituras consecutivas en el mismo campo (solo se conserva el valor final)
    const ult = grabacion.pasos[grabacion.pasos.length - 1];
    if (ult && ['escribir', 'escribirTexto'].includes(p.tipo) && ult.tipo === p.tipo && JSON.stringify(ult.selector || ult.elemento) === JSON.stringify(p.selector || p.elemento)) {
      if (p.tipo === 'escribirTexto' && p.modo === 'teclear') p.texto = (ult.texto + p.texto).slice(0, 5000);
      grabacion.pasos[grabacion.pasos.length - 1] = p;
      notificar('pasoGrabado', { paso: p, descripcion: describirPaso(p), reemplaza: true });
      return;
    }
    grabacion.pasos.push(p);
    notificar('pasoGrabado', { paso: p, descripcion: describirPaso(p) });
  } catch (e) { log.aviso('Paso grabado descartado:', e.message); }
}
async function detenerGrabacion() {
  if (!grabacion) return { pasos: [] };
  const g = grabacion; grabacion = null;
  if (g.objetivo.tipo === 'siaf') { const v = ctx.ventanaSIAF(); if (v) v.webContents.send('escritorio:comando', { accion: 'grabar-detener' }); }
  else { try { await aux.pedir('grabar-detener'); } catch (e) { log.aviso('Detener grabación externa:', e.message); } }
  liberarAtajo();
  log.info('Grabación detenida', g.pasos.length, 'pasos');
  notificar('grabacion', { activa: false });
  return { objetivo: g.objetivo, pasos: g.pasos };
}

// ---------------- ejecución ----------------
async function confirmarUI(titulo, detalle) {
  const padre = (control && !control.isDestroyed() && control) || ctx.ventanaSIAF() || undefined;
  const ac = new AbortController(); abortarDialogo = () => ac.abort();
  try {
    const r = await dialog.showMessageBox(padre, { type: 'warning', message: titulo, detail: detalle, buttons: ['Detener', 'Ejecutar'], defaultId: 0, cancelId: 0, signal: ac.signal });
    return r.response === 1;
  } catch (e) { return false; } finally { abortarDialogo = null; }
}
function manualUI(paso, texto) {
  return new Promise(res => {
    manualPendiente = res;
    const v = ctx.ventanaSIAF(); if (ejecucion && ejecucion.sec.objetivo.tipo === 'siaf' && v) v.focus();
    notificar('manual', { paso, texto, descripcion: describirPaso(paso) });
  });
}

async function ejecutar(id, opciones = {}) {
  if (ejecucion) throw new Error('Ya hay una secuencia en ejecución.');
  if (grabacion) throw new Error('Detenga la grabación antes de ejecutar.');
  const sec = almacen.obtener(id);
  const driver = sec.objetivo.tipo === 'siaf' ? new DriverSIAF(ctx.ventanaSIAF) : new DriverMacOS(aux, almacen);
  const e = new Ejecucion(sec, driver, { confirmar: confirmarUI, manual: manualUI }, { modo: opciones.modo, desde: opciones.desde });
  ejecucion = e;
  for (const ev of ['estado', 'paso', 'pasoTerminado', 'reintento', 'esperandoAvance']) e.on(ev, d => notificar(ev, { datos: d }));
  e.on('fin', r => {
    try { almacen.anotarEjecucion(r); } catch (x) { log.aviso('Historial:', x.message); }
    log.info('Ejecución terminada', r.estado, `${r.pasosOk}/${r.total}`, r.error ? '— ' + r.error : '');
    ejecucion = null; manualPendiente = null; liberarAtajo();
    setTimeout(cerrarHUD, r.estado === 'completada' ? 2500 : 6000);
  });
  registrarAtajo(); mostrarHUD();
  log.info('Ejecución iniciada', sec.id, sec.objetivo.tipo, e.modo);
  if (sec.objetivo.tipo === 'siaf') { const v = ctx.ventanaSIAF(); if (v) v.focus(); }
  e.ejecutar();
  return e.resumen();
}

function detenerTodo(motivo = 'usuario') {
  if (ejecucion) { ejecucion.detener(`Detenida (${motivo})`); if (abortarDialogo) abortarDialogo(); if (manualPendiente) { manualPendiente(false); manualPendiente = null; } }
  if (grabacion) detenerGrabacion().catch(() => { });
}

// ---------------- permisos y aplicaciones ----------------
async function permisos() {
  const r = { plataforma: process.platform, auxiliar: aux.disponible(), accesibilidad: null, monitorEntrada: null, pantalla: null, nota: '' };
  if (process.platform !== 'darwin') { r.nota = 'Los permisos de macOS solo aplican al ejecutar SIAF en un Mac. La automatización dentro de SIAF funciona en cualquier sistema.'; return r; }
  r.accesibilidad = systemPreferences.isTrustedAccessibilityClient(false);
  try { r.pantalla = systemPreferences.getMediaAccessStatus('screen'); } catch (e) { }
  if (r.auxiliar.ok) { try { const p = await aux.pedir('permisos'); r.monitorEntrada = p.monitorEntrada; r.accesibilidadAuxiliar = p.accesibilidad; } catch (e) { r.nota = e.message; } }
  return r;
}

async function bundleDeApp(ruta) {
  const id = await ejecutarArchivo('/usr/bin/defaults', ['read', path.join(ruta, 'Contents', 'Info'), 'CFBundleIdentifier']);
  if (!BUNDLE.test(id)) throw new Error('No se pudo leer el identificador de la aplicación.');
  return id;
}

// ---------------- IPC de la ventana de control ----------------
function desdeControl(ev) {
  const url = ev.senderFrame && ev.senderFrame.url;
  if (!url || !url.startsWith('siaf://control/')) throw new Error('Origen no autorizado.');
}
function manejar(canal, fn) {
  ipcMain.handle(canal, async (ev, ...a) => { desdeControl(ev); try { return await fn(...a); } catch (e) { log.aviso(`IPC ${canal}:`, e.message); throw e; } });
}

function registrarIPC() {
  manejar('ctrl:info', () => ({ tipos: Object.fromEntries(Object.entries(TIPOS).map(([k, v]) => [k, { etiqueta: v.etiqueta, objetivos: v.objetivos }])), formato: FORMATO, version: VERSION, plataforma: process.platform, grabando: !!grabacion, ejecutando: ejecucion ? ejecucion.resumen() : null, atajo: (ctx.config.get('automatizacion') || {}).atajoDetener }));
  manejar('ctrl:listar', () => almacen.listar());
  manejar('ctrl:obtener', id => almacen.obtener(id));
  manejar('ctrl:guardar', s => almacen.guardar(s));
  manejar('ctrl:eliminar', async id => {
    const r = await dialog.showMessageBox(control, { type: 'warning', message: '¿Eliminar la secuencia?', detail: 'Se moverá a la carpeta «eliminadas» del almacenamiento de automatización.', buttons: ['Cancelar', 'Eliminar'], defaultId: 0, cancelId: 0 });
    return r.response === 1 ? almacen.eliminar(id) : false;
  });
  manejar('ctrl:duplicar', id => almacen.duplicar(id));
  manejar('ctrl:describir', p => describirPaso(limpiarPaso(p.paso, p.objetivo)));
  manejar('ctrl:validar', s => limpiarSecuencia(s));
  manejar('ctrl:exportar', async id => {
    const s = almacen.obtener(id);
    const r = await dialog.showSaveDialog(control, { title: 'Exportar secuencia', defaultPath: `${s.nombre.replace(/[^\w\-áéíóúñ ]/gi, '_')}.siafseq.json`, filters: [{ name: 'Secuencia de SIAF', extensions: ['json'] }] });
    if (r.canceled || !r.filePath) return false;
    fs.writeFileSync(r.filePath, JSON.stringify(s, null, 2)); return true;
  });
  manejar('ctrl:importar', async () => {
    const r = await dialog.showOpenDialog(control, { title: 'Importar secuencia', properties: ['openFile'], filters: [{ name: 'Secuencia de SIAF', extensions: ['json'] }] });
    if (r.canceled || !r.filePaths[0]) return null;
    if (fs.statSync(r.filePaths[0]).size > 5 * 1024 * 1024) throw new Error('Archivo demasiado grande para ser una secuencia.');
    return almacen.importarTexto(fs.readFileSync(r.filePaths[0], 'utf8'));
  });
  manejar('ctrl:grabar', (objetivo, op) => iniciarGrabacion(objetivo, op));
  manejar('ctrl:grabar-detener', () => detenerGrabacion());
  manejar('ctrl:ejecutar', (id, op) => ejecutar(id, op || {}));
  manejar('ctrl:pausar', () => { if (ejecucion) ejecucion.pausar(); return true; });
  manejar('ctrl:continuar', () => { if (ejecucion) ejecucion.continuar(); return true; });
  manejar('ctrl:avanzar', () => { if (ejecucion) ejecucion.avanzar(); return true; });
  manejar('ctrl:detener', () => { detenerTodo('usuario'); return true; });
  manejar('ctrl:manual', ok => { const r = manualPendiente; manualPendiente = null; if (r) r(!!ok); return true; });
  manejar('ctrl:historial', () => almacen.historial());
  manejar('ctrl:permisos', () => permisos());
  manejar('ctrl:pedir-accesibilidad', () => process.platform === 'darwin' ? systemPreferences.isTrustedAccessibilityClient(true) : false);
  manejar('ctrl:pedir-monitor', async () => { const d = aux.disponible(); if (!d.ok) throw new Error(d.motivo); return aux.pedir('pedir-monitor'); });
  manejar('ctrl:abrir-ajustes', panel => { if (!AJUSTES[panel]) throw new Error('Panel desconocido.'); if (process.platform !== 'darwin') throw new Error('Solo disponible en macOS.'); return shell.openExternal(AJUSTES[panel]); });
  manejar('ctrl:apps', () => almacen.apps());
  manejar('ctrl:apps-en-ejecucion', async () => { const d = aux.disponible(); if (!d.ok) return []; return aux.pedir('apps'); });
  manejar('ctrl:autorizar-app', async (bundleId, nombre) => {
    if (!bundleId) {
      const r = await dialog.showOpenDialog(control, { title: 'Autorizar una aplicación', defaultPath: '/Applications', properties: ['openFile'], filters: [{ name: 'Aplicaciones', extensions: ['app'] }] });
      if (r.canceled || !r.filePaths[0]) return almacen.apps();
      bundleId = await bundleDeApp(r.filePaths[0]); nombre = path.basename(r.filePaths[0], '.app');
    }
    const ok = await dialog.showMessageBox(control, { type: 'question', message: `¿Autorizar a SIAF a controlar «${nombre || bundleId}»?`, detail: 'SIAF podrá pulsar controles, escribir texto y leer los elementos accesibles de esa aplicación, solo cuando usted grabe o ejecute una secuencia. Puede revocarlo en cualquier momento.', buttons: ['Cancelar', 'Autorizar'], defaultId: 0, cancelId: 0 });
    return ok.response === 1 ? almacen.autorizarApp(bundleId, nombre) : almacen.apps();
  });
  manejar('ctrl:revocar-app', b => almacen.revocarApp(b));
  manejar('ctrl:aprobar-script', async (secId, pasoId) => {
    const s = almacen.obtener(secId); const p = s.pasos.find(x => x.id === pasoId);
    if (!p || p.tipo !== 'applescript') throw new Error('Paso no encontrado.');
    const r = await dialog.showMessageBox(control, { type: 'warning', message: 'Aprobar AppleScript', detail: `Revise el código. Solo apruebe scripts que entienda y cuyo origen conozca.\n\nSHA-256: ${p.hash}\n\n${p.fuente.slice(0, 1800)}${p.fuente.length > 1800 ? '\n…' : ''}`, buttons: ['Cancelar', 'Aprobar en este Mac'], defaultId: 0, cancelId: 0 });
    return r.response === 1 ? almacen.aprobar(p.hash) : false;
  });
  manejar('ctrl:aprobado', hash => almacen.aprobado(hash));
  manejar('ctrl:atajos', async () => process.platform === 'darwin' ? (await ejecutarArchivo('/usr/bin/shortcuts', ['list'])).split('\n').filter(Boolean).slice(0, 500) : []);

  // eventos grabados desde la ventana de SIAF (validación del remitente: solo la ventana principal de SIAF)
  ipcMain.on('grabacion:evento', (ev, paso) => {
    const v = ctx.ventanaSIAF();
    if (!v || ev.sender !== v.webContents || !String(ev.senderFrame && ev.senderFrame.url).startsWith('siaf://app/')) return;
    if (grabacion && grabacion.objetivo.tipo === 'siaf') agregarPasoGrabado(paso);
  });
}

function iniciar(c) {
  ctx = c;
  almacen = new Almacen(c.dir);
  aux = new Auxiliar();
  aux.on('evento', m => {
    if (m.evento === 'paso' && grabacion && grabacion.objetivo.tipo === 'app' && m.datos && m.datos.app === grabacion.objetivo.bundleId) agregarPasoGrabado(m.datos.paso);
    if (m.evento === 'detener') detenerTodo('tecla Escape doble en el auxiliar');
  });
  registrarIPC();
}

module.exports = { iniciar, abrirControl, detenerTodo, _interno: () => ({ almacen, grabacion, ejecucion }) };
