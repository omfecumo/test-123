'use strict';
// P16: actualización (nueva versión del paquete de la app) sin pérdida de datos.
// P17: desinstalación (borrar el paquete de la app) sin eliminar los datos ni los respaldos.
// La «instalación» se simula con una copia completa del paquete de la app en otra carpeta: es exactamente lo que
// hace macOS al reemplazar SIAF.app en /Applications (los datos viven fuera, en ~/Library/Application Support/SIAF).
const { test } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { abrir, primerIngreso, listarRespaldos, cerrar, datos, expect, RAIZ, captura } = require('./fixture');

const DIR = datos('p05-' + Date.now());
const INST = datos('p05-instalaciones');

function instalar(version) {
  const destino = path.join(INST, version);
  fs.rmSync(destino, { recursive: true, force: true });
  fs.mkdirSync(destino, { recursive: true });
  for (const x of ['src', 'app-web', 'build']) fs.cpSync(path.join(RAIZ, x), path.join(destino, x), { recursive: true });
  const pkg = JSON.parse(fs.readFileSync(path.join(RAIZ, 'package.json'), 'utf8'));
  pkg.version = version;
  fs.writeFileSync(path.join(destino, 'package.json'), JSON.stringify(pkg, null, 2));
  fs.symlinkSync(path.join(RAIZ, 'node_modules'), path.join(destino, 'node_modules'));
  return destino;
}

test('P16 actualización 9.3.3 → 9.3.4 conserva datos, sesión, respaldos y preferencias', async () => {
  const v1 = instalar('9.3.3');
  let { app, win } = await abrir(DIR, { limpiar: true, raiz: v1 });
  await primerIngreso(win, '2580');
  await win.evaluate(() => DB.put('tareas', { titulo: 'Creada en 9.3.3', fecha: U.hoyISO(), vence: U.hoyISO(), estado: 'Pendiente', prioridad: 'Media' }));
  const conteos = await win.evaluate(() => Object.fromEntries(DB.COLECCIONES.filter(c => c !== 'fotos' && c !== 'auditoria').map(c => [c, DB.todos(c).length])));
  expect(await win.evaluate(() => siafEscritorio.info().then(i => i.versionApp))).toBe('9.3.3');
  await cerrar(app);
  const respaldos = listarRespaldos(DIR);

  // «actualizar»: se reemplaza el paquete completo de la app por la versión nueva
  fs.rmSync(v1, { recursive: true, force: true });
  const v2 = instalar('9.3.4');
  ({ app, win } = await abrir(DIR, { raiz: v2 }));
  await win.waitForSelector('#app .topbar');
  expect(await win.evaluate(() => siafEscritorio.info().then(i => i.versionApp))).toBe('9.3.4');
  expect(await win.evaluate(() => DB.todos('tareas').some(t => t.titulo === 'Creada en 9.3.3'))).toBe(true);
  const conteos2 = await win.evaluate(() => Object.fromEntries(DB.COLECCIONES.filter(c => c !== 'fotos' && c !== 'auditoria').map(c => [c, DB.todos(c).length])));
  expect(conteos2).toEqual(conteos);
  for (const r of respaldos) expect(listarRespaldos(DIR)).toContain(r);
  await captura(win, '16-tras-actualizacion');
  await cerrar(app);

  // P17 «desinstalar»: se borra el paquete de la app; datos y respaldos permanecen
  fs.rmSync(v2, { recursive: true, force: true });
  expect(fs.existsSync(path.join(DIR, 'IndexedDB'))).toBe(true);
  expect(listarRespaldos(DIR).length).toBeGreaterThanOrEqual(respaldos.length);
  expect(fs.existsSync(path.join(DIR, 'Respaldos', 'indice.json'))).toBe(true);
});
