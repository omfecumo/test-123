'use strict';
// P12–P15: grabación y reproducción de secuencias, campos protegidos, confirmación de operaciones destructivas,
// interfaz inesperada, detención inmediata, paso a paso, exportar/importar secuencias, permisos.
// P13-mac: automatización de una app de prueba autorizada (TextEdit) — solo se ejecuta en macOS.
const { test } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { abrir, primerIngreso, menu, captura, cerrar, externas, datos, expect, EVID } = require('./fixture');

const DIR = datos('p04-' + Date.now());
let app, win, ctl;

async function abrirControl() {
  const [w] = await Promise.all([app.waitForEvent('window', { predicate: p => p.url().startsWith('siaf://control/index.html') }), menu(app, 'Herramientas', 'SIAF Control y Automatización…')]);
  await w.waitForLoadState('domcontentloaded');
  await w.waitForFunction(() => typeof INFO !== 'undefined' && INFO);
  return w;
}
const historial = () => ctl.evaluate(() => siafControl.historial());
async function ejecutarYEsperar(id, opciones = {}, estados = ['completada', 'detenida', 'error']) {
  const n0 = (await historial()).length;
  await ctl.evaluate(([id, op]) => siafControl.ejecutar(id, op), [id, opciones]);
  await expect.poll(async () => (await historial()).length, { timeout: 120000 }).toBe(n0 + 1);
  const h = (await historial())[0];
  expect(estados).toContain(h.estado);
  return h;
}
const guardar = s => ctl.evaluate(s => siafControl.guardar(s), s);

test.beforeAll(async () => {
  ({ app, win } = await abrir(DIR, { limpiar: true }));
  await primerIngreso(win, '2580');
  ctl = await abrirControl();
});
test.afterAll(async () => { if (app) await cerrar(app); });

test('P12 grabar acciones en SIAF, guardar la secuencia y reproducirla', async () => {
  await ctl.click('[data-p="grabar"]');
  await ctl.selectOption('#grab-objetivo', 'siaf');
  await ctl.click('#btn-grabar');
  await expect(ctl.locator('#estado')).toContainText('Grabando');
  await expect.poll(() => win.evaluate(() => document.documentElement.classList.contains('siaf-grabando'))).toBe(true);
  // acciones reales del usuario en SIAF
  await menu(app, 'Visualización', 'Agenda y tareas');
  await win.waitForTimeout(1500);
  await win.click('.vista-cabecera [data-n]');
  await win.fill('#f-titulo', 'Tarea grabada');
  await win.press('#f-titulo', 'Tab');
  await win.click('.capa-oscura [data-guardar]');
  await expect(win.locator('#toasts')).toContainText('Tarea guardada');
  await captura(win, '11-grabando-en-siaf');
  await ctl.click('#btn-grabar-fin');
  await expect(ctl.locator('#grab-guardar')).toBeVisible();
  const pasos = await ctl.evaluate(() => grabados.map(p => p.tipo));
  expect(pasos).toEqual(expect.arrayContaining(['navegar', 'clic', 'escribir']));
  await ctl.fill('#grab-nombre', 'Crear tarea de revisión');
  await ctl.fill('#grab-carpeta', 'Agenda');
  await ctl.click('#btn-grab-guardar');
  await expect(ctl.locator('#editor')).toBeVisible();
  await captura(ctl, '12-control-secuencia-grabada');
  const id = await ctl.evaluate(() => actual.id);
  expect(await ctl.evaluate(() => actual.pasos.filter(p => p.tipo === 'navegar').map(p => p.ruta))).toContain('tareas');
  // reproducción automática
  const h = await ejecutarYEsperar(id);
  expect(h.estado, h.error || '').toBe('completada');
  expect(await win.evaluate(() => DB.todos('tareas').filter(t => t.titulo === 'Tarea grabada').length)).toBe(2);
  await captura(ctl, '13-control-ejecucion-completada');
  // la barra flotante (HUD) se mostró durante la ejecución
  expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().some(w => w.webContents.getURL().includes('hud.html')))).toBe(true);
});

test('P12b campos protegidos: el PIN nunca se graba', async () => {
  await ctl.click('[data-p="grabar"]');
  await ctl.click('#btn-grabar');
  await win.evaluate(() => App.cambiarPin(Auth.actual.id));
  await win.fill('#f-pin', '9137'); await win.press('#f-pin', 'Tab');
  await win.fill('#f-pin2', '9137'); await win.press('#f-pin2', 'Tab');
  await win.locator('.capa-oscura [data-cancelar]').last().click();
  await ctl.click('#btn-grabar-fin');
  const g = await ctl.evaluate(() => JSON.stringify(grabados));
  expect(g).not.toContain('9137');
  expect(g).toContain('campoSensible');
  expect(await win.evaluate(() => Auth.verificarPin(DB.get('usuarios', Auth.actual.id), '2580'))).toBe(true); // se canceló: el PIN no cambió
  await ctl.click('#btn-grab-descartar').catch(() => { });
});

test('P15 operación destructiva sin confirmar → la secuencia se detiene sin ejecutarla', async () => {
  await app.evaluate(({ dialog }) => { global.__conf = []; dialog.showMessageBox = async (_w, o) => { global.__conf.push((o || _w).message); return { response: 0 }; }; }); // «Detener»
  const s = await guardar({ nombre: 'Borrar tarea (prueba)', pasos: [{ tipo: 'navegar', ruta: 'tareas' }, { tipo: 'clic', selector: { texto: '🗑️ Eliminar tarea', css: 'button.peligro' } }] });
  const h = await ejecutarYEsperar(s.id);
  expect(h.estado).toBe('detenida');
  expect(h.error).toMatch(/no confirmada/);
  expect(await app.evaluate(() => global.__conf[0])).toMatch(/Confirmar operación sensible/);
});

test('P15b la interfaz cambió: elemento inexistente → error comprensible, sin reintentar el clic', async () => {
  const s = await guardar({ nombre: 'Interfaz cambiada', pasos: [{ tipo: 'navegar', ruta: 'ganado' }, { tipo: 'clic', selector: { texto: 'Botón que ya no existe', css: '#no-existe' }, timeoutMs: 1500 }] });
  const h = await ejecutarYEsperar(s.id);
  expect(h.estado).toBe('error');
  expect(h.error).toMatch(/La interfaz cambió: no se encontró «Botón que ya no existe»/);
});

test('P15c detener de inmediato desde el menú (equivale a ⌘⇧⎋ y al botón de la barra flotante)', async () => {
  const s = await guardar({ nombre: 'Espera larga', pasos: [{ tipo: 'esperar', ms: 120000 }, { tipo: 'navegar', ruta: 'mapa' }] });
  const n0 = (await historial()).length;
  await ctl.evaluate(id => siafControl.ejecutar(id), s.id);
  await new Promise(r => setTimeout(r, 1500));
  const t0 = Date.now();
  await menu(app, 'Herramientas', 'Detener toda automatización');
  await expect.poll(async () => (await historial()).length, { timeout: 10000 }).toBe(n0 + 1);
  expect(Date.now() - t0).toBeLessThan(5000);
  expect((await historial())[0].estado).toBe('detenida');
});

test('P12c modo paso a paso, pausas, validaciones, condición y punto de recuperación', async () => {
  const s = await guardar({ nombre: 'Paso a paso', pasos: [
    { tipo: 'navegar', ruta: 'ganado' }, { tipo: 'punto', etiqueta: 'En ganado' }, { tipo: 'validarTexto', contiene: 'Ganado' },
    { tipo: 'condicion', comprobacion: { tipo: 'elementoExiste', selector: { css: '#no-hay' } }, siFalla: 'saltar', saltar: 1 }, { tipo: 'navegar', ruta: 'costos' },
    { tipo: 'esperar', ms: 300 }, { tipo: 'navegar', ruta: 'tareas' }] });
  const n0 = (await historial()).length;
  await ctl.evaluate(id => siafControl.ejecutar(id, { modo: 'pasoAPaso' }), s.id);
  let avances = 0;
  for (const t0 = Date.now(); (await historial()).length === n0 && Date.now() - t0 < 90000;) { await new Promise(r => setTimeout(r, 600)); await ctl.evaluate(() => siafControl.avanzar()); avances++; }
  const h = (await historial())[0];
  expect(h.estado, h.error || '').toBe('completada');
  expect(avances).toBeGreaterThanOrEqual(6); // cada paso esperó «Siguiente»
  expect(h.ultimoPunto.etiqueta).toBe('En ganado');
  expect(await win.evaluate(() => location.hash)).toBe('#/tareas');
});

test('P12d exportar e importar secuencias; aprobación de AppleScript no se hereda', async () => {
  const s = await guardar({ nombre: 'Para exportar', objetivo: { tipo: 'app', bundleId: 'com.apple.TextEdit', nombreApp: 'TextEdit' }, pasos: [{ tipo: 'applescript', fuente: 'tell application "TextEdit" to activate' }] });
  const f = path.join(DIR, 'exportada.siafseq.json');
  await app.evaluate(({ dialog }, f) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: f }); dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [f] }); }, f);
  expect(await ctl.evaluate(id => siafControl.exportar(id), s.id)).toBe(true);
  expect(JSON.parse(fs.readFileSync(f, 'utf8')).formato).toBe('siaf-secuencia');
  const imp = await ctl.evaluate(() => siafControl.importar());
  expect(imp.id).not.toBe(s.id);
  expect(await ctl.evaluate(h => siafControl.aprobado(h), imp.pasos[0].hash)).toBe(false);
  await ctl.click('[data-p="permisos"]');
  await ctl.waitForTimeout(800);
  await captura(ctl, '14-control-permisos');
  await ctl.click('[data-p="historial"]');
  await ctl.waitForTimeout(500);
  await captura(ctl, '15-control-historial');
  expect(await externas(app)).toEqual([]);
});

test('P13-mac automatización de TextEdit (app de prueba autorizada) — requiere macOS con Accesibilidad concedida', async () => {
  test.skip(process.platform !== 'darwin', 'Solo en macOS: necesita el auxiliar nativo siaf-automator y el permiso de Accesibilidad.');
  const per = await ctl.evaluate(() => siafControl.permisos());
  test.skip(!per.accesibilidad || !per.auxiliar.ok, 'Conceda Accesibilidad a SIAF y compile el auxiliar (scripts/build-automator.sh).');
  await app.evaluate(({ dialog }) => { dialog.showMessageBox = async () => ({ response: 1 }); }); // «Autorizar» / «Ejecutar»
  await ctl.evaluate(() => siafControl.autorizarApp('com.apple.TextEdit', 'TextEdit'));
  const s = await guardar({ nombre: 'TextEdit: documento de prueba', objetivo: { tipo: 'app', bundleId: 'com.apple.TextEdit', nombreApp: 'TextEdit' }, pasos: [
    { tipo: 'abrirApp', bundleId: 'com.apple.TextEdit' }, { tipo: 'esperar', ms: 1500 }, { tipo: 'teclas', combinacion: 'cmd+n' }, { tipo: 'esperar', ms: 800 },
    { tipo: 'escribirTexto', texto: 'Prueba de SIAF Control y Automatización', modo: 'teclear' },
    { tipo: 'validarValor', elemento: { rol: 'AXTextArea' }, contiene: 'SIAF Control' }] });
  const h = await ejecutarYEsperar(s.id);
  fs.writeFileSync(path.join(EVID, '..', 'automatizacion-textedit-macos.json'), JSON.stringify({ permisos: per, historial: h, apps: await ctl.evaluate(() => siafControl.appsEnEjecucion()) }, null, 2));
  await captura(ctl, '18-control-textedit-macos');
  console.log('TEXTEDIT', JSON.stringify({ per, h }));
  expect(h.estado, h.error || '').toBe('completada');
});
