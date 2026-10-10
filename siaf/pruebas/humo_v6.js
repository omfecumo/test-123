// Recorrido de humo de SIAFver6.html en perfil nuevo: todas las vistas, pestañas y trazas de indicadores.
const { abrir, login, cerrarModales } = require('./comun');
(async () => {
  const perfil = process.argv[2] || '/tmp/siaf-perfil-v6';
  const { ctx, page, errores, externas } = await abrir(perfil, 'SIAFver6.html');
  await login(page);
  const rutas = await page.evaluate(() => App.RUTAS.map(r => r[0]));
  const res = {};
  for (const r of rutas) {
    const e0 = errores.length; const t = Date.now();
    await page.evaluate(r => App.ir(r), r); await page.waitForTimeout(300); await cerrarModales(page);
    // recorrer pestañas
    const nP = await page.$$eval('#contenido .pestanas button', b => b.length);
    for (let i = 0; i < nP; i++) { await page.click(`#contenido .pestanas button >> nth=${i}`).catch(() => {}); await page.waitForTimeout(150); await cerrarModales(page); }
    res[r] = { ms: Date.now() - t, pest: nP, err: errores.slice(e0) };
  }
  // trazas BI
  await page.evaluate(() => App.ir('indicadores')); await page.waitForTimeout(500);
  const kpis = await page.$$eval('.bi-kpi', b => b.map(x => x.dataset.k));
  for (const k of kpis) { await page.click(`.bi-kpi[data-k="${k}"]`); await page.waitForTimeout(120); await cerrarModales(page); }
  // asistente
  await page.evaluate(() => App.ir('asistente')); await page.waitForTimeout(200);
  const n = await page.$$eval('[data-s]', b => b.length);
  for (let i = 0; i < n; i++) await page.click(`[data-s="${i}"]`);
  const resp = await page.$$eval('.asis-r h3', h => h.map(x => x.textContent));
  // ficha animal + genealogía
  await page.evaluate(() => Ganado.abrir(DB.todos('animales').find(a => DB.todos('animales').some(x => x.madreId === a.id)).id)); await page.waitForTimeout(400);
  await page.click('.modal .pestanas button[data-k="genea"]'); await page.waitForTimeout(200);
  const genea = await page.$eval('.modal', m => m.innerText.includes('Descendencia'));
  await cerrarModales(page);
  console.log(JSON.stringify({ rutas: rutas.length, kpis: kpis.length, asistente: resp, genea, externas: externas.length, errores }, null, 0));
  console.log(Object.entries(res).map(([k, v]) => `${k}:${v.ms}ms/${v.pest}p${v.err.length ? ' ERR ' + v.err.join(';') : ''}`).join(' | '));
  await ctx.close();
})().catch(e => { console.error(e); process.exit(1); });
