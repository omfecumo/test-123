// Rendimiento con volumen representativo: ~3.000 animales, ~40.000 eventos, 6.000 costos. Compara v5 y v6.
const fs = require('fs'); const path = require('path');
const { abrir, login, RAIZ } = require('./comun');
const sembrar = async page => page.evaluate(async () => {
  const lotes = D.lotes().filter(l => l.tipo === 'lote').slice(0, 120); const hoy = U.hoyISO(); let ops = [];
  const flush = async () => { if (ops.length) { await DB.lote(ops, { sinBitacora: true }); ops = []; } };
  for (let i = 0; i < 2900; i++) {
    const id = 'ani-vol-' + i; const l = lotes[i % lotes.length];
    ops.push({ c: 'animales', obj: { id, arete: 'VOL-' + i, sexo: i % 2 ? 'M' : 'H', raza: 'Brahman', fechaNacimiento: U.sumarDias(hoy, -400 - (i % 900)), fechaIngreso: U.sumarDias(hoy, -380), procedencia: 'Compra', estado: 'Activo', loteId: l.id, grupo: 'Vol ' + (i % 10), pesoActual: 300 + i % 150, demo: true } });
    for (let k = 0; k < 12; k++) ops.push({ c: 'eventos', obj: { id: `evt-vol-${i}-${k}`, animalId: id, tipo: k % 4 === 3 ? 'Vacunación' : 'Pesaje', fecha: U.sumarDias(hoy, -360 + k * 30), peso: 250 + k * 9 + (i % 40), demo: true } });
    if (ops.length > 4000) await flush();
  }
  for (let i = 0; i < 6000; i++) ops.push({ c: 'costos', obj: { id: 'cos-vol-' + i, fecha: U.sumarDias(hoy, -(i % 365)), categoria: D.CAT_COSTO[i % 10], monto: 10000 + i, loteId: lotes[i % lotes.length].id, demo: true } });
  await flush();
  return { animales: DB.todos('animales').length, eventos: DB.todos('eventos').length, costos: DB.todos('costos').length };
});
const medir = async (page, rutas) => { const o = {}; for (const r of rutas) { const t = await page.evaluate(async r => { const t0 = performance.now(); App.ir(r); await new Promise(x => setTimeout(x, 0)); return Math.round(performance.now() - t0); }, r); o[r] = t; } return o; };
(async () => {
  const P = '/tmp/siaf-vol'; fs.rmSync(P, { recursive: true, force: true });
  let s = await abrir(P, 'SIAFver6.html'); await login(s.page); const vol = await sembrar(s.page); await s.ctx.close();
  s = await abrir(P, 'SIAFver5.html'); let t0 = Date.now(); await login(s.page); const carga5 = Date.now() - t0; const m5 = await medir(s.page, ['dashboard', 'ganado', 'costos', 'alertas', 'reportes']); await s.ctx.close();
  s = await abrir(P, 'SIAFver6.html'); t0 = Date.now(); await login(s.page); const carga6 = Date.now() - t0; const m6 = await medir(s.page, ['dashboard', 'ganado', 'costos', 'alertas', 'reportes', 'indicadores', 'finanzas', 'calidad']);
  const err = s.errores; await s.ctx.close();
  const out = { volumen: vol, cargaMs: { v5: carga5, v6: carga6 }, vistaMs: { v5: m5, v6: m6 }, errores: err };
  fs.writeFileSync(path.join(RAIZ, 'pruebas/resultados/rendimiento.json'), JSON.stringify(out, null, 1)); console.log(JSON.stringify(out));
})().catch(e => { console.error(e); process.exit(1); });
