'use strict';
// P01–P07: arranque limpio, seguridad del contenedor web, creación/edición/consulta, persistencia tras reinicio,
// respaldo al salir y funcionamiento sin red.
const { test } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { abrir, primerIngreso, menu, listarRespaldos, esperarArchivo, captura, cerrar, externas, datos, expect } = require('./fixture');

const DIR = datos('p01');

test('P01 instalación limpia: arranque, contexto seguro, sin Node.js en la página, CSP y menús nativos', async () => {
  const { app, win, errores } = await abrir(DIR, { limpiar: true });
  await captura(win, '01-ingreso-instalacion-limpia');
  const seg = await win.evaluate(async () => ({
    seguro: isSecureContext, subtle: !!(crypto && crypto.subtle), require: typeof require, process: typeof process, puente: Object.keys(window.siafEscritorio || {}),
    csp: (await fetch(location.href)).headers.get('content-security-policy'), origen: location.origin,
  }));
  expect(seg.seguro).toBe(true);
  expect(seg.subtle).toBe(true);
  expect(seg.require).toBe('undefined');
  expect(seg.process).toBe('undefined');
  expect(seg.csp).toContain("object-src 'none'");
  expect(seg.origen).toBe('siaf://app');
  const prefs = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences());
  expect(prefs.contextIsolation).toBe(true);
  expect(prefs.sandbox).toBe(true);
  expect(prefs.nodeIntegration).toBe(false);
  const menus = await app.evaluate(({ Menu }) => Menu.getApplicationMenu().items.map(i => i.label));
  for (const m of ['Archivo', 'Edición', 'Visualización', 'Herramientas', 'Ventana', 'Ayuda']) expect(menus).toContain(m);
  // navegación externa bloqueada
  const nav = await win.evaluate(() => { try { window.open('https://example.com'); return 'ok'; } catch (e) { return e.message; } });
  expect(nav).toBe('ok');
  expect(await win.evaluate(() => location.origin)).toBe('siaf://app');
  expect(errores).toEqual([]);
  await primerIngreso(win, '2580');
  await expect(win.locator('#estado-escritorio')).toBeVisible();
  // primera copia en disco
  const primera = await esperarArchivo(() => listarRespaldos(DIR).find(f => f.startsWith('SIAF_auto_')));
  expect(primera).toBeTruthy();
  await win.waitForTimeout(1500);
  await captura(win, '02-mapa-tras-primer-ingreso');
  await cerrar(app);
});

test('P02–P06 crear, editar y consultar registros; fotografía; persistencia tras reiniciar; respaldo al salir; sin red', async () => {
  let { app, win, errores } = await abrir(DIR);
  await win.waitForSelector('#app .topbar'); // sesión restaurada (14 días por defecto)
  // ---- crear animal con fotografía ----
  await menu(app, 'Visualización', 'Ganado');
  await win.click('[data-nuevo]');
  await win.fill('#f-arete', 'E2E-001');
  await win.selectOption('#f-sexo', 'H');
  await win.fill('#f-nombre', 'Lucero');
  const png = path.join(__dirname, '..', '..', 'build', 'icon.png');
  if (await win.locator('#f-fotos').count()) await win.setInputFiles('#f-fotos', png);
  await win.click('.capa-oscura [data-guardar]');
  await expect(win.locator('#toasts')).toContainText('Animal registrado');
  const animal = await win.evaluate(() => DB.todos('animales').find(a => a.arete === 'E2E-001'));
  expect(animal.nombre).toBe('Lucero');
  const fotos = await win.evaluate(id => DB.fotosDe('animales', id).then(f => f.length), animal.id);
  expect(fotos).toBe(1);
  // ---- crear y editar tarea ----
  await expect(win.locator('.capa-oscura .modal-cab h3')).toContainText('Ficha individual'); // SIAF abre la ficha del animal creado
  await captura(win, '03a-ficha-animal-creado');
  while (await win.locator('.capa-oscura .cerrar').count()) await win.locator('.capa-oscura .cerrar').last().click();
  await menu(app, 'Visualización', 'Agenda y tareas');
  await win.click('.vista-cabecera [data-n]');
  await win.fill('#f-titulo', 'Revisar bebedero E2E');
  await win.click('.capa-oscura [data-guardar]');
  await expect(win.locator('#toasts')).toContainText('Tarea guardada');
  const tarea = await win.evaluate(() => DB.todos('tareas').find(t => t.titulo === 'Revisar bebedero E2E'));
  await win.evaluate(id => Acc.tarea(DB.get('tareas', id)), tarea.id); // misma ventana de edición que «✏️ Editar»
  await win.fill('#f-titulo', 'Revisar bebedero E2E (editada)');
  await win.click('.capa-oscura [data-guardar]');
  await expect.poll(() => win.evaluate(id => DB.get('tareas', id).titulo, tarea.id)).toBe('Revisar bebedero E2E (editada)');
  // ---- consultar con el buscador global (menú Edición → Buscar) ----
  await menu(app, 'Edición', 'Buscar en SIAF…');
  await win.fill('#bq', 'Lucero');
  await expect(win.locator('#bq-res')).toContainText('Lucero');
  await captura(win, '03-busqueda-registro-creado');
  await win.keyboard.press('Escape');
  // ---- bitácora (auditoría) registra los cambios ----
  const aud = await win.evaluate(() => DB.todos('auditoria').map(a => a.desc).join(' | '));
  expect(aud).toContain('E2E-001');
  // ---- sin red: ninguna petición externa durante todo el uso ----
  expect(await externas(app)).toEqual([]);
  expect(errores).toEqual([]);
  const antes = listarRespaldos(DIR).length;
  await cerrar(app); // ⌘Q: respaldo al salir porque hubo cambios
  const idx = JSON.parse(fs.readFileSync(path.join(DIR, 'Respaldos', 'indice.json'), 'utf8'));
  expect(idx.respaldos.some(r => r.motivo === 'salida')).toBe(true);
  expect(listarRespaldos(DIR).length).toBe(antes + 1);

  // ---- reabrir: los datos persisten ----
  ({ app, win } = await abrir(DIR));
  await win.waitForSelector('#app .topbar');
  const persiste = await win.evaluate(() => ({ animal: DB.todos('animales').some(a => a.arete === 'E2E-001'), tarea: DB.todos('tareas').some(t => t.titulo.includes('(editada)')) }));
  expect(persiste).toEqual({ animal: true, tarea: true });
  expect(await win.evaluate(() => DB.contarFotos())).toBeGreaterThanOrEqual(1);
  // ---- apertura y cierre repetidos ----
  await cerrar(app);
  for (let i = 0; i < 3; i++) {
    ({ app, win } = await abrir(DIR));
    await win.waitForSelector('#app .topbar');
    expect(await win.evaluate(() => DB.todos('animales').some(a => a.arete === 'E2E-001'))).toBe(true);
    await cerrar(app);
  }
});
