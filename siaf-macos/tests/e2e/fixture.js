'use strict';
const { _electron: electron, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..', '..');
const EVID = path.join(RAIZ, 'evidencias', 'capturas');
fs.mkdirSync(EVID, { recursive: true });
const datos = nombre => path.join(RAIZ, '.e2e-datos', nombre);

/** Abre SIAF con una carpeta de datos propia. Registra (y bloquea) cualquier petición de red externa. */
async function abrir(dir, { limpiar = false, env = {}, raiz = RAIZ } = {}) {
  if (limpiar) fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const args = [raiz];
  if (process.platform === 'linux' && process.getuid && process.getuid() === 0) args.unshift('--no-sandbox');
  const app = await electron.launch({ args, cwd: raiz, env: { ...process.env, SIAF_USER_DATA: dir, SIAF_DESCARGAS_DIR: path.join(dir, 'descargas'), ...env } });
  await app.evaluate(({ session }) => {
    global.__externas = [];
    session.defaultSession.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*', 'ws://*/*', 'wss://*/*'] }, (d, cb) => { global.__externas.push(d.url); cb({ cancel: true }); });
  });
  const win = await app.firstWindow();
  const errores = [];
  win.on('pageerror', e => errores.push(e.message));
  await win.waitForSelector('.login, #app .topbar', { timeout: 90000 });
  return { app, win, errores, dir };
}

async function teclearPin(win, pin) { for (const d of pin) await win.keyboard.press(d); await win.keyboard.press('Enter'); }

/** Primer ingreso del administrador: PIN inicial 1234 y cambio obligatorio a `nuevo`. */
async function primerIngreso(win, nuevo = '2580') {
  await win.waitForSelector('.login');
  await teclearPin(win, '1234');
  await win.waitForSelector('#cp1');
  await win.fill('#cp1', nuevo); await win.fill('#cp2', nuevo);
  await win.click('#lg-cp button[type=submit]');
  try { await win.waitForSelector('#app .topbar', { timeout: 60000 }); }
  catch (e) { await win.screenshot({ path: path.join(RAIZ, 'test-results', 'fallo-primer-ingreso.png') }); console.log('PANTALLA', await win.evaluate(() => document.body.innerText.slice(0, 600))); throw e; }
  await cerrarNovedades(win);
}

/** SIAF muestra «Novedades de SIAF 7» una sola vez por equipo, unos segundos después del primer ingreso. */
async function cerrarNovedades(win, ms = 10000) {
  const nov = win.locator('.capa-oscura', { hasText: 'Novedades de SIAF' });
  try { await nov.first().waitFor({ timeout: ms }); await nov.first().locator('.cerrar').click(); } catch (e) { /* no apareció */ }
}

async function ingresar(win, usuarioId, pin) {
  await win.waitForSelector('.login');
  await win.selectOption('#lg-u', usuarioId);
  await teclearPin(win, pin);
  await win.waitForSelector('#app .topbar', { timeout: 60000 });
}

/** Pulsa un elemento del menú de la aplicación por etiquetas (prueba el cableado real del menú). */
function menu(app, ...ruta) {
  return app.evaluate(({ Menu }, ruta) => {
    let items = Menu.getApplicationMenu().items, it = null;
    for (const r of ruta) { it = items.find(x => x.label === r); if (!it) throw new Error('Menú no encontrado: ' + r); items = it.submenu ? it.submenu.items : []; }
    it.click();
  }, ruta);
}

const listarRespaldos = dir => { try { return fs.readdirSync(path.join(dir, 'Respaldos')).filter(f => f.endsWith('.zip')).sort(); } catch (e) { return []; } };
async function esperarArchivo(fn, ms = 60000) { const t0 = Date.now(); for (; ;) { const r = fn(); if (r) return r; if (Date.now() - t0 > ms) throw new Error('Tiempo agotado esperando archivo'); await new Promise(r => setTimeout(r, 300)); } }
const captura = (win, nombre) => win.screenshot({ path: path.join(EVID, nombre + '.png') });
async function cerrar(app) { const p = app.process(); await app.close().catch(() => { }); if (p && p.exitCode === null) p.kill('SIGKILL'); }
async function externas(app) { return app.evaluate(() => global.__externas); }

module.exports = { cerrarNovedades, abrir, primerIngreso, ingresar, teclearPin, menu, listarRespaldos, esperarArchivo, captura, cerrar, externas, datos, expect, RAIZ, EVID };
