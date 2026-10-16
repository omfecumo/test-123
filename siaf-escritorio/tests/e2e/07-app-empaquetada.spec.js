'use strict';
// Prueba de humo sobre la aplicación EMPAQUETADA (SIAF.app). Se ejecuta solo si SIAF_APP_EXEC apunta al ejecutable:
//   SIAF_APP_EXEC="dist/mac-universal/SIAF.app/Contents/MacOS/SIAF" npx playwright test tests/e2e/07-app-empaquetada.spec.js
const { test, _electron: electron } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { primerIngreso, listarRespaldos, esperarArchivo, datos, expect, RAIZ, cerrar } = require('./fixture');

test('App empaquetada: arranca desde el paquete, usa asar, incluye el auxiliar nativo y respalda en disco', async () => {
  const exe = process.env.SIAF_APP_EXEC;
  test.skip(!exe, 'Defina SIAF_APP_EXEC con la ruta del ejecutable empaquetado.');
  const dir = datos('empaquetada-' + Date.now());
  fs.mkdirSync(dir, { recursive: true });
  const args = process.platform === 'linux' && process.getuid() === 0 ? ['--no-sandbox'] : [];
  const app = await electron.launch({ executablePath: path.resolve(RAIZ, exe), args, env: { ...process.env, SIAF_USER_DATA: dir } });
  const info = await app.evaluate(({ app }) => ({ empaquetada: app.isPackaged, version: app.getVersion(), recursos: process.resourcesPath, arch: process.arch, plataforma: process.platform }));
  expect(info.empaquetada).toBe(true);
  if (info.plataforma === 'darwin') expect(fs.existsSync(path.join(info.recursos, 'bin', 'siaf-automator'))).toBe(true);
  expect(fs.existsSync(path.join(info.recursos, 'app.asar'))).toBe(true);
  const win = await app.firstWindow();
  await win.waitForSelector('.login', { timeout: 90000 });
  await win.screenshot({ path: path.join(RAIZ, 'evidencias', 'capturas', `empaquetada-${info.plataforma}-${info.arch}-ingreso.png`) });
  await primerIngreso(win, '2580');
  await esperarArchivo(() => listarRespaldos(dir).length > 0);
  await win.screenshot({ path: path.join(RAIZ, 'evidencias', 'capturas', `empaquetada-${info.plataforma}-${info.arch}-mapa.png`) });
  fs.writeFileSync(path.join(RAIZ, 'evidencias', `empaquetada-${info.plataforma}-${info.arch}.json`), JSON.stringify({ ...info, respaldos: listarRespaldos(dir), fecha: new Date().toISOString() }, null, 2));
  await cerrar(app);
});
