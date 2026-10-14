'use strict';
// Recorre TODAS las secciones registradas por SIAF (App.RUTAS) con los datos de demostración y comprueba que cada
// vista se dibuja sin errores de JavaScript. Guarda el inventario en evidencias/modulos.json.
const { test } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { abrir, primerIngreso, cerrar, externas, datos, expect, RAIZ, captura } = require('./fixture');

test('Módulos originales: cada sección de SIAF se abre y se dibuja sin errores', async () => {
  const { app, win, errores } = await abrir(datos('p06-' + Date.now()), { limpiar: true });
  await primerIngreso(win, '2580');
  const rutas = await win.evaluate(() => App.RUTAS.map(r => ({ ruta: r[0], etiqueta: r[2], seccion: r[3] })));
  const resultado = [];
  for (const r of rutas) {
    const n0 = errores.length;
    await win.evaluate(ruta => App.ir(ruta), r.ruta);
    await win.waitForTimeout(700);
    const info = await win.evaluate(() => {
      const c = document.querySelector('#contenido') || document.querySelector('main') || document.body;
      return { texto: (c.innerText || '').trim().length, svg: c.querySelectorAll('svg').length, canvas: c.querySelectorAll('canvas').length, tablas: c.querySelectorAll('table').length, botones: c.querySelectorAll('button').length, cargando: /Cargando…/.test(c.innerText || '') };
    });
    resultado.push({ ...r, ...info, errores: errores.slice(n0) });
    if (['mapa', 'dashboard', 'ganado', 'reportes', 'configuracion'].includes(r.ruta)) await captura(win, `mod-${r.ruta}`);
  }
  // asistente de consultas local (si existe en esta versión)
  const asistente = await win.evaluate(() => {
    if (typeof Asistente === 'undefined') return null;
    const r = Asistente.responder('¿cuáles fueron los costos del mes?');
    const txt = typeof r === 'string' ? r : JSON.stringify(r);
    return { funciones: Object.keys(Asistente), pregunta: '¿cuáles fueron los costos del mes?', respuesta: String(txt).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 300) };
  });
  expect(asistente.respuesta).not.toMatch(/No entendí/);
  expect(asistente.respuesta.length).toBeGreaterThan(20);
  fs.writeFileSync(path.join(RAIZ, 'evidencias', 'modulos.json'), JSON.stringify({ fecha: new Date().toISOString(), plataforma: `${process.platform}/${process.arch}`, secciones: resultado, asistente }, null, 2));
  for (const r of resultado) {
    expect(r.errores, `errores en ${r.ruta}`).toEqual([]);
    expect(r.texto, `vista vacía: ${r.ruta}`).toBeGreaterThan(20);
  }
  expect(resultado.find(r => r.ruta === 'mapa').svg).toBeGreaterThan(0);
  expect(await externas(app)).toEqual([]);
  await cerrar(app);
});
