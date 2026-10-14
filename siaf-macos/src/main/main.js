'use strict';
/* SIAF para macOS — proceso principal de Electron.
   Arquitectura: SIAF (archivo HTML original, sin reescribir) se ejecuta en una ventana Chromium aislada
   (contextIsolation + sandbox, sin Node.js) bajo el origen fijo siaf://app. Un único puente (preload.js) expone
   operaciones nativas limitadas y validadas: respaldos en disco, migración, preferencias y grabación de acciones. */
const { app, BrowserWindow, ipcMain, dialog, shell, session, Menu, nativeTheme, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const log = require('./log');
const { Config } = require('./config');
const { Respaldos } = require('./backups');
const protocolo = require('./protocol');
const { construirMenu } = require('./menu');
const migracion = require('./migracion');
const automatizacion = require('./automation');

const VERSION_SIAF = '9.3.3';
const RAIZ = path.join(__dirname, '..', '..');
const RAICES = {
  app: path.join(RAIZ, 'app-web'),
  control: path.join(RAIZ, 'src', 'automation-ui'),
  ayuda: path.join(RAIZ, 'src', 'help'),
};

// Carpeta de datos: ~/Library/Application Support/SIAF. SIAF_USER_DATA permite aislar pruebas automatizadas.
if (process.env.SIAF_USER_DATA) app.setPath('userData', path.resolve(process.env.SIAF_USER_DATA));
app.setName('SIAF');
protocolo.registrarPrivilegios();

let ventana = null;
let config = null;
let respaldos = null;
let recuperacion = false;
let salidaLista = false;
let saliendo = false;

const RUTAS = () => {
  const datos = app.getPath('userData');
  return { datos, respaldos: path.join(datos, 'Respaldos'), logs: path.join(datos, 'logs'), migraciones: path.join(datos, 'Migraciones'), automatizacion: path.join(datos, 'Automatizacion') };
};

// ---------- validación del remitente de cada mensaje IPC ----------
function desdeSIAF(ev) {
  const url = ev.senderFrame && ev.senderFrame.url;
  if (!url || !url.startsWith(protocolo.ORIGEN_APP + '/') || !ventana || ev.sender !== ventana.webContents) throw new Error('Origen no autorizado.');
}
function manejar(canal, fn) {
  ipcMain.handle(canal, async (ev, ...args) => {
    desdeSIAF(ev);
    try { return await fn(...args); } catch (e) { log.error(`IPC ${canal}:`, e.message); throw e; }
  });
}

// ---------- ventana principal ----------
function crearVentana() {
  const g = config.get('ventana');
  const area = screen.getPrimaryDisplay().workAreaSize;
  const opciones = {
    width: Math.min(1440, area.width), height: Math.min(920, area.height), minWidth: 900, minHeight: 600,
    title: 'SIAF', show: false, backgroundColor: nativeTheme.shouldUseDarkColors ? '#0f1f17' : '#f4f7f5',
    tabbingIdentifier: 'siaf',
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'preload.js'),
      contextIsolation: true, sandbox: true, nodeIntegration: false, webSecurity: true,
      allowRunningInsecureContent: false, spellcheck: true, devTools: !app.isPackaged || process.env.SIAF_DEVTOOLS === '1',
    },
  };
  if (g && g.width && g.height) Object.assign(opciones, { x: g.x, y: g.y, width: g.width, height: g.height });
  ventana = new BrowserWindow(opciones);
  if (g && g.maximizada) ventana.maximize();
  ventana.once('ready-to-show', () => ventana.show());
  ventana.on('close', ev => {
    try { config.set({ ventana: { ...ventana.getNormalBounds(), maximizada: ventana.isMaximized() } }); } catch (e) { }
    // Cerrar la ventana cierra la aplicación (una sola ventana de datos); antes se hace el respaldo de salida.
    if (pedirRespaldoSalida()) ev.preventDefault();
  });
  ventana.on('closed', () => { ventana = null; });
  ventana.webContents.on('render-process-gone', async (_e, d) => {
    log.error('El proceso de la ventana terminó:', d.reason, d.exitCode);
    if (d.reason === 'clean-exit' || !ventana) return;
    const r = await dialog.showMessageBox(ventana, { type: 'error', message: 'SIAF se detuvo inesperadamente', detail: 'Los datos confirmados están guardados en el disco. ¿Desea volver a abrir SIAF?', buttons: ['Volver a abrir', 'Salir'], defaultId: 0 });
    if (r.response === 0) ventana.reload(); else app.quit();
  });
  ventana.webContents.on('console-message', (ev) => {
    const nivel = ev.level ?? ev.params?.level;
    if (nivel === 'error' || nivel === 3) log.aviso('Consola SIAF:', ev.message ?? ev.params?.message);
  });
  ventana.loadURL(protocolo.ORIGEN_APP + '/index.html');
  return ventana;
}

function enviarComando(accion, datos) {
  if (!ventana) { crearVentana(); ventana.webContents.once('did-finish-load', () => enviarComando(accion, datos)); return; }
  if (ventana.isMinimized()) ventana.restore();
  ventana.focus();
  ventana.webContents.send('escritorio:comando', { accion, ...datos });
}

// ---------- endurecimiento de todo contenido web ----------
function endurecer() {
  const permitidos = new Set(['clipboard-sanitized-write', 'fileSystem']);
  session.defaultSession.setPermissionRequestHandler((_wc, permiso, cb) => cb(permitidos.has(permiso)));
  session.defaultSession.setPermissionCheckHandler((_wc, permiso) => permitidos.has(permiso));
  session.defaultSession.on('will-download', (_e, item) => {
    // SIAF_DESCARGAS_DIR solo lo usan las pruebas automatizadas (evita el diálogo de guardar)
    if (process.env.SIAF_DESCARGAS_DIR) item.setSavePath(path.join(process.env.SIAF_DESCARGAS_DIR, path.basename(item.getFilename())));
    else item.setSaveDialogOptions({ title: 'Guardar archivo de SIAF', defaultPath: path.join(app.getPath('downloads'), item.getFilename()) });
    item.once('done', (_ev, estado) => log.info('Descarga', estado, path.extname(item.getFilename())));
  });
  app.on('web-contents-created', (_e, wc) => {
    wc.on('will-attach-webview', ev => ev.preventDefault());
    wc.on('will-navigate', (ev, url) => {
      const actual = wc.getURL();
      const mismo = (() => { try { return new URL(url).origin === new URL(actual).origin; } catch (e) { return false; } })();
      if (!mismo) { ev.preventDefault(); abrirExterno(url); }
    });
    wc.setWindowOpenHandler(({ url }) => { abrirExterno(url); return { action: 'deny' }; });
  });
}

async function abrirExterno(url) {
  let u; try { u = new URL(url); } catch (e) { return; }
  if (!['https:', 'mailto:'].includes(u.protocol)) { log.aviso('Navegación bloqueada:', u.protocol); return; }
  const r = await dialog.showMessageBox(ventana || undefined, { type: 'question', message: 'Abrir enlace externo', detail: `SIAF va a abrir en su navegador:\n${u.origin}${u.pathname}`, buttons: ['Abrir', 'Cancelar'], defaultId: 1, cancelId: 1 });
  if (r.response === 0) shell.openExternal(u.toString());
}

// ---------- IPC (solo desde siaf://app) ----------
function registrarIPC() {
  manejar('escritorio:info', () => ({
    versionApp: app.getVersion(), versionSIAF: VERSION_SIAF, electron: process.versions.electron, plataforma: process.platform, arquitectura: process.arch,
    rutas: { datos: RUTAS().datos, respaldos: RUTAS().respaldos }, preferencias: config.publica(), recuperacion, ultimoRespaldo: respaldos.ultimo(),
  }));
  manejar('respaldo:guardar', (bytes, motivo, detalle) => {
    if (!(bytes instanceof Uint8Array)) throw new Error('Datos de respaldo no válidos.');
    return respaldos.guardar(bytes, String(motivo), String(detalle || ''));
  });
  manejar('respaldo:listar', () => respaldos.listar());
  manejar('respaldo:verificar', nombre => respaldos.verificar(nombre));
  manejar('respaldo:leer', nombre => new Uint8Array(respaldos.leer(nombre)));
  manejar('respaldo:abrir-carpeta', () => shell.openPath(RUTAS().respaldos));
  manejar('preferencias:guardar', cambios => { const c = config.set(cambios); return { respaldoAuto: c.respaldoAuto, intervaloHoras: c.intervaloHoras, retenerAuto: c.retenerAuto, retenerPuntos: c.retenerPuntos, respaldoAlSalir: c.respaldoAlSalir, carpetaEspejo: c.carpetaEspejo }; });
  manejar('preferencias:elegir-espejo', async () => {
    const r = await dialog.showOpenDialog(ventana, { title: 'Carpeta espejo para respaldos', properties: ['openDirectory', 'createDirectory'], message: 'Elija un disco externo o una carpeta sincronizada (p. ej. iCloud Drive).' });
    if (r.canceled || !r.filePaths[0]) return config.publica();
    config.set({ carpetaEspejo: r.filePaths[0] });
    return config.publica();
  });
  manejar('migracion:pendiente', () => migracion.leerPendiente(RUTAS().migraciones));
  manejar('migracion:esperado', datos => migracion.guardarPendiente(RUTAS().migraciones, datos));
  manejar('migracion:resultado', reporte => migracion.guardarResultado(RUTAS().migraciones, reporte));
  manejar('recuperacion:atendida', () => { recuperacion = false; return true; });
  manejar('log:error', texto => { log.aviso('Ventana SIAF:', String(texto).slice(0, 1500)); return true; });
  manejar('salida:lista', () => { salidaLista = true; if (saliendo) app.quit(); return true; });
}

/** Devuelve true si hay que esperar el respaldo de salida (y lo solicita una sola vez). */
let salidaSolicitada = false;
function pedirRespaldoSalida() {
  if (!saliendo) { saliendo = true; automatizacion.detenerTodo('cierre'); }
  if (salidaLista || !ventana || ventana.webContents.isCrashed() || !config || !config.get('respaldoAlSalir')) return false;
  if (!salidaSolicitada) {
    salidaSolicitada = true;
    ventana.webContents.send('escritorio:comando', { accion: 'respaldo-salida' });
    setTimeout(() => { if (!salidaLista) { log.aviso('Respaldo de salida sin respuesta en 30 s; se cierra igual.'); salidaLista = true; app.quit(); } }, 30000);
  }
  return true;
}

// ---------- comandos de menú que requieren el proceso principal ----------
const acciones = {
  comando: (accion, datos) => enviarComando(accion, datos),
  abrirCarpetaRespaldos: () => shell.openPath(RUTAS().respaldos),
  abrirRegistro: () => shell.showItemInFolder(log.archivo),
  ayuda: (seccion = '') => abrirAyuda(seccion),
  permisos: () => automatizacion.abrirControl('permisos'),
  control: () => automatizacion.abrirControl(),
  detenerAutomatizacion: () => automatizacion.detenerTodo('menú'),
  verificarRespaldos: async () => {
    const r = respaldos.verificarTodos();
    const malos = r.filter(x => !x.ok);
    dialog.showMessageBox(ventana || undefined, { type: malos.length ? 'warning' : 'info', message: malos.length ? `${malos.length} de ${r.length} respaldos no pasaron la verificación` : `Los ${r.length} respaldos pasaron la verificación SHA-256`, detail: malos.map(m => `${m.nombre}: ${m.errores.join('; ')}`).join('\n') || `Carpeta: ${RUTAS().respaldos}` });
  },
  migrar: async () => {
    const r = await dialog.showOpenDialog(ventana, { title: 'Migrar datos desde SIAF (versión HTML)', buttonLabel: 'Analizar', properties: ['openFile'], filters: [{ name: 'Respaldos de SIAF', extensions: ['zip', 'json', 'siaf'] }] });
    if (r.canceled || !r.filePaths[0]) return;
    let analisis;
    try { analisis = migracion.analizarArchivo(r.filePaths[0]); } catch (e) { dialog.showMessageBox(ventana, { type: 'error', message: 'No se pudo analizar el archivo', detail: e.message }); return; }
    const ok = await dialog.showMessageBox(ventana, { type: analisis.errores.length ? 'error' : 'question', message: analisis.errores.length ? 'El archivo no se puede migrar' : 'Análisis previo a la migración', detail: migracion.textoReporte(analisis), buttons: analisis.errores.length ? ['Cerrar'] : ['Continuar en SIAF…', 'Cancelar'], defaultId: analisis.errores.length ? 0 : 1, cancelId: analisis.errores.length ? 0 : 1 });
    if (analisis.errores.length || ok.response !== 0) return;
    migracion.guardarPendiente(RUTAS().migraciones, { origen: path.basename(r.filePaths[0]), sha256: analisis.sha256, conteos: analisis.conteos, cifrado: analisis.cifrado, fecha: new Date().toISOString(), estado: 'enviada' });
    enviarComando('migrar', { nombre: path.basename(r.filePaths[0]), bytes: new Uint8Array(fs.readFileSync(r.filePaths[0])) });
  },
};

function abrirAyuda(seccion) {
  const w = new BrowserWindow({ width: 900, height: 760, title: 'Ayuda de SIAF', webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false } });
  w.loadURL(`siaf://ayuda/index.html${seccion ? '#' + encodeURIComponent(seccion) : ''}`);
}

// ---------- ciclo de vida ----------
if (!app.requestSingleInstanceLock()) {
  // Una sola instancia: dos procesos sobre la misma base IndexedDB podrían bloquearse entre sí.
  app.quit();
} else {
  app.on('second-instance', () => { if (ventana) { if (ventana.isMinimized()) ventana.restore(); ventana.focus(); } });

  app.whenReady().then(() => {
    const r = RUTAS();
    log.iniciar(r.logs);
    log.info(`Inicio SIAF ${VERSION_SIAF} (app ${app.getVersion()}, Electron ${process.versions.electron}, ${process.platform}/${process.arch})`);
    config = new Config(r.datos);
    recuperacion = config.get('sesionAbierta') === true;
    if (recuperacion) log.aviso('La sesión anterior no se cerró correctamente: se hará un punto de recuperación al abrir.');
    config.set({ sesionAbierta: true });
    respaldos = new Respaldos(r.respaldos, config);
    if (!fs.existsSync(path.join(RAICES.app, 'index.html'))) {
      dialog.showErrorBox('SIAF incompleto', 'Falta app-web/index.html. Ejecute «npm run prepare-web» antes de iniciar.');
      app.exit(1);
      return;
    }
    protocolo.manejar(RAICES);
    endurecer();
    registrarIPC();
    automatizacion.iniciar({ dir: r.automatizacion, ventanaSIAF: () => ventana, config, padre: () => ventana });
    app.setAboutPanelOptions({ applicationName: 'SIAF', applicationVersion: app.getVersion(), version: `SIAF ${VERSION_SIAF} · Electron ${process.versions.electron}`, copyright: '© 2026 Omar Fernando Cuadro Mogollón. Todos los derechos reservados.' });
    Menu.setApplicationMenu(construirMenu(acciones, { esMac: process.platform === 'darwin', desarrollo: !app.isPackaged }));
    crearVentana();
  });

  app.on('activate', () => { if (!ventana) crearVentana(); });
  app.on('window-all-closed', () => app.quit());

  // Cierre ordenado (⌘Q o cerrar la ventana): se pide a SIAF un último respaldo si hubo cambios (máximo 30 s).
  app.on('before-quit', ev => { if (pedirRespaldoSalida()) ev.preventDefault(); });
  app.on('will-quit', () => {
    if (config) config.set({ sesionAbierta: false });
    log.info('Cierre normal');
  });
}

module.exports = { acciones };
