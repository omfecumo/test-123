'use strict';
// P07–P08 y P11: importación/exportación, restauración con punto de recuperación previo y roles/permisos.
const { test } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { abrir, primerIngreso, ingresar, menu, listarRespaldos, esperarArchivo, captura, cerrar, externas, datos, expect } = require('./fixture');

const DIR = datos('p02');
const cerrarModales = async win => { while (await win.locator('.capa-oscura .cerrar').count()) await win.locator('.capa-oscura .cerrar').last().click(); };

test('P07 exportación (Excel, JSON, plantillas) e importación de animales desde CSV con vista previa', async () => {
  const { app, win } = await abrir(DIR, { limpiar: true });
  await primerIngreso(win, '2580');
  await menu(app, 'Visualización', 'Configuración');
  await win.locator('.pestanas button', { hasText: 'Respaldo' }).first().click();
  await win.waitForSelector('[data-plant-an]');
  const desc = path.join(DIR, 'descargas');
  await win.click('[data-plant-an]');
  const plantilla = await esperarArchivo(() => fs.existsSync(desc) && fs.readdirSync(desc).find(f => /\.xlsx$/i.test(f)));
  expect(plantilla).toBeTruthy();
  await win.click('[data-exp]');
  const json = await esperarArchivo(() => fs.readdirSync(desc).find(f => /^finca_backup_.*\.json$/.test(f)));
  const j = JSON.parse(fs.readFileSync(path.join(desc, json), 'utf8'));
  expect(j.app).toBe('SIAF'); expect(j.integridad.alg).toBe('SHA-256');
  await win.click('[data-xls]');
  await esperarArchivo(() => fs.readdirSync(desc).filter(f => /\.xlsx$/i.test(f)).length >= 2);
  // ---- importación CSV con los encabezados oficiales de la plantilla ----
  const enc = await win.evaluate(() => Importar.CAMPOS.animales.map(c => c[1]));
  const fila = (arete, sexo, nombre) => enc.map(e => /arete/i.test(e) ? arete : /^sexo/i.test(e) ? sexo : /^nombre/i.test(e) ? nombre : '').join(';');
  const csv = path.join(DIR, 'animales.csv');
  fs.writeFileSync(csv, '﻿' + [enc.join(';'), fila('IMP-001', 'H', 'Importada Uno'), fila('IMP-002', 'M', 'Importado Dos'), fila('', 'H', 'Sin arete')].join('\r\n'));
  const [fc] = await Promise.all([win.waitForEvent('filechooser'), win.click('[data-imp-an]')]);
  await fc.setFiles(csv);
  await expect(win.locator('.capa-oscura .modal-cab h3').last()).toContainText('vista previa');
  await captura(win, '04-importacion-vista-previa');
  await win.locator('.capa-oscura button', { hasText: /Importar \d+/ }).last().click();
  await win.locator('.capa-oscura button', { hasText: /Confirmar|Importar|Sí/ }).last().click();
  await expect.poll(() => win.evaluate(() => DB.todos('animales').filter(a => /^IMP-00[12]$/.test(a.arete)).length)).toBe(2);
  expect(await win.evaluate(() => DB.todos('animales').some(a => a.nombre === 'Sin arete'))).toBe(false); // fila inválida omitida
  expect(await externas(app)).toEqual([]);
  await cerrar(app);
});

test('P08 restauración desde un respaldo de la app, con punto de recuperación previo y verificación de integridad', async () => {
  const { app, win } = await abrir(DIR);
  await win.waitForSelector('#app .topbar');
  await menu(app, 'Archivo', 'Crear respaldo ahora');
  await expect(win.locator('#toasts')).toContainText('Respaldo guardado y verificado');
  const manual = listarRespaldos(DIR).find(f => f.startsWith('SIAF_manual_'));
  expect(manual).toBeTruthy();
  // pérdida accidental: se eliminan los animales importados
  await win.evaluate(async () => { for (const a of DB.todos('animales').filter(x => /^IMP-/.test(x.arete))) await DB.del('animales', a.id); });
  expect(await win.evaluate(() => DB.todos('animales').filter(a => /^IMP-/.test(a.arete)).length)).toBe(0);
  const animalesAntes = await win.evaluate(() => DB.todos('animales').length);
  const puntosAntes = listarRespaldos(DIR).filter(f => f.startsWith('SIAF_punto_')).length;
  await menu(app, 'Archivo', 'Restaurar desde un respaldo de la app…');
  const fila = win.locator('.capa-oscura tr', { hasText: manual });
  await fila.locator('[data-ver]').click();
  await expect(win.locator('#toasts')).toContainText('Integridad verificada');
  await fila.locator('[data-res]').click();
  await expect(win.locator('.capa-oscura .modal-cab h3').last()).toContainText('Vista previa de la restauración');
  await expect(win.locator('.capa-oscura').last()).toContainText('Integridad verificada');
  await captura(win, '05-restauracion-vista-previa');
  await win.locator('.capa-oscura [data-si]').last().click();
  // la app recarga tras restaurar
  await win.waitForEvent('load', { timeout: 60000 }).catch(() => { });
  await win.waitForSelector('#app .topbar', { timeout: 60000 });
  await expect.poll(() => win.evaluate(() => DB.todos('animales').filter(a => /^IMP-/.test(a.arete)).length), { timeout: 30000 }).toBe(2);
  const puntos = listarRespaldos(DIR).filter(f => f.startsWith('SIAF_punto_'));
  expect(puntos.length).toBe(puntosAntes + 1);
  const idx = JSON.parse(fs.readFileSync(path.join(DIR, 'Respaldos', 'indice.json'), 'utf8'));
  const punto = idx.respaldos.find(r => r.nombre === puntos.sort().pop());
  expect(punto.motivo).toBe('pre-restauracion');
  expect(punto.conteos.animales).toBe(animalesAntes); // el punto guardó el estado previo exacto (sin los animales borrados)
  // verificación global de respaldos (menú) sin errores
  await app.evaluate(({ dialog }) => { global.__dlg = []; dialog.showMessageBox = async (_w, o) => { global.__dlg.push(o || _w); return { response: 0 }; }; });
  await menu(app, 'Archivo', 'Verificar integridad de los respaldos');
  await expect.poll(() => app.evaluate(() => (global.__dlg[0] || {}).message || '')).toMatch(/pasaron la verificación SHA-256/);
  await cerrar(app);
});

test('P11 roles y permisos: operario sin permiso de respaldo/restauración; consulta solo lectura', async () => {
  let { app, win } = await abrir(DIR);
  await win.waitForSelector('#app .topbar');
  await win.evaluate(() => Auth.cerrarSesion());
  await win.waitForSelector('.login');
  await ingresar(win, 'usr-operario', '4444');
  const p = await win.evaluate(() => ({ rol: Auth.actual.rol, ver: Auth.puede('ver'), mover: Auth.puede('mover'), exportar: Auth.puede('exportar'), importar: Auth.puede('importar'), eliminar: Auth.puede('eliminar') }));
  expect(p).toEqual({ rol: 'operario', ver: true, mover: true, exportar: false, importar: false, eliminar: false });
  await menu(app, 'Archivo', 'Crear respaldo ahora');
  await expect(win.locator('#toasts')).toContainText('Su rol no permite crear respaldos');
  await menu(app, 'Archivo', 'Restaurar desde un respaldo de la app…');
  await expect(win.locator('#toasts')).toContainText('no permite restaurar');
  await menu(app, 'SIAF', 'Preferencias de respaldo…').catch(() => win.evaluate(() => 0)); // menú SIAF solo existe en macOS
  await menu(app, 'Visualización', 'Ganado');
  await win.click('[data-nuevo]');
  await expect(win.locator('#toasts')).toContainText('no permite');
  await captura(win, '06-rol-operario-sin-permiso');
  await win.evaluate(() => Auth.cerrarSesion());
  await win.waitForSelector('.login');
  await ingresar(win, 'usr-consulta', '5555');
  expect(await win.evaluate(() => ['mover', 'tarea', 'animal', 'exportar'].map(x => Auth.puede(x)))).toEqual([false, false, false, false]);
  // bloqueo por intentos fallidos sigue funcionando
  await win.evaluate(() => Auth.cerrarSesion());
  await win.waitForSelector('.login');
  await win.selectOption('#lg-u', 'usr-veterinario');
  for (let i = 0; i < 5; i++) { for (const d of '0000') await win.keyboard.press(d); await win.keyboard.press('Enter'); await win.waitForTimeout(400); }
  await expect(win.locator('#lg-ayuda')).toContainText('Demasiados intentos');
  await cerrar(app);
});
