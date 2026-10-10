// Línea base: ejecuta SIAFver5.html, recorre todas las vistas y guarda la instantánea de cálculos.
const fs = require('fs'); const path = require('path');
const { abrir, login, cerrarModales, instantanea, RAIZ } = require('./comun');
(async () => {
  const perfil = process.argv[2] || '/tmp/siaf-perfil-base';
  const t0 = Date.now();
  const { ctx, page, errores, externas } = await abrir(perfil, 'SIAFver5.html');
  await login(page);
  const tCarga = Date.now() - t0;
  const rutas = await page.evaluate(() => App.RUTAS.map(r => r[0]));
  const vistas = {};
  for (const r of rutas) {
    const e0 = errores.length; const t = Date.now();
    await page.evaluate(r => App.ir(r), r); await page.waitForTimeout(250); await cerrarModales(page);
    const txt = await page.evaluate(() => document.querySelector('#contenido').innerText.slice(0, 80).replace(/\s+/g, ' '));
    vistas[r] = { ms: Date.now() - t, errores: errores.slice(e0), inicio: txt };
  }
  const snap = await page.evaluate(instantanea);
  const res = { archivo: 'SIAFver5.html', fecha: new Date().toISOString(), tCargaMs: tCarga, rutas: rutas.length, vistas, errores, externas, snap };
  fs.mkdirSync(path.join(RAIZ, 'pruebas/resultados'), { recursive: true });
  fs.writeFileSync(path.join(RAIZ, 'pruebas/resultados/linea_base_v5.json'), JSON.stringify(res, null, 1));
  console.log('rutas', rutas.length, 'errores', errores.length, 'externas', externas.length, 'carga ms', tCarga);
  console.log(Object.entries(vistas).map(([k, v]) => `${k}:${v.ms}ms${v.errores.length ? ' ERR' : ''}`).join(' | '));
  console.log('conteos', JSON.stringify(snap.conteos));
  await ctx.close();
})().catch(e => { console.error(e); process.exit(1); });
