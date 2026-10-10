// Regresión: abre SIAFver6 sobre el perfil con datos creados por SIAFver5 (misma base IndexedDB file://),
// verifica la migración y compara la instantánea de cálculos con la línea base de v5.
const fs = require('fs'); const path = require('path');
const { abrir, login, instantanea, RAIZ } = require('./comun');
(async () => {
  const perfil = process.argv[2] || '/tmp/siaf-perfil-base';
  const base = JSON.parse(fs.readFileSync(path.join(RAIZ, 'pruebas/resultados/linea_base_v5.json'), 'utf8'));
  // 1) instantánea v5 de este momento (las fechas relativas a «hoy» no cambian entre ejecuciones del mismo día)
  let s = await abrir(perfil, 'SIAFver5.html'); await login(s.page); const v5 = await s.page.evaluate(instantanea); await s.ctx.close();
  // 2) misma base con v6
  s = await abrir(perfil, 'SIAFver6.html'); await login(s.page);
  await s.page.waitForTimeout(800);
  const v6 = await s.page.evaluate(instantanea);
  const mig = await s.page.evaluate(async () => ({ esquema: DB.get('config', 'esquema'), puntos: (await Recuperacion.listar()).map(p => ({ motivo: p.motivo, conteos: p.conteos.animales })) }));
  const errores = s.errores; await s.ctx.close();
  // 3) comparación
  const difs = []; const cmp = (a, b, ruta) => { if (JSON.stringify(a) === JSON.stringify(b)) return; if (a && b && typeof a === 'object' && typeof b === 'object') { for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) cmp(a[k], b[k], ruta + '.' + k); } else difs.push({ ruta, v5: a, v6: b }); };
  for (const k of Object.keys(v5)) cmp(v5[k], v6[k], k);
  const esperado = d => /^costos\.(n|monto|porOrigen\.Cultivo)|^dash\.\d+\.(costos|margen)|^indicadores|^alertas\.(Riesgo de agotamiento|Animales sin pesaje|Gasto atípico)|^conteos\.(config|auditoria)$/.test(d.ruta);
  const inesperadas = difs.filter(d => !esperado(d));
  const out = { fecha: new Date().toISOString(), mismaBaseQueLineaBase: JSON.stringify({ ...v5.conteos, auditoria: 0 }) === JSON.stringify({ ...base.snap.conteos, auditoria: 0 }), migracion: mig, totalDiferencias: difs.length, esperadas: difs.filter(esperado), inesperadas, errores,
    resumen: { aforos: Object.keys(v5.aforos).length, stock: Object.keys(v5.stock).length, fert: Object.keys(v5.fert).length, potreros: Object.keys(v5.potreros).length, animales: Object.keys(v5.animales).length } };
  fs.writeFileSync(path.join(RAIZ, 'pruebas/resultados/regresion_v5_v6.json'), JSON.stringify(out, null, 1));
  console.log(JSON.stringify({ ...out, esperadas: out.esperadas.map(d => `${d.ruta}: ${JSON.stringify(d.v5)} → ${JSON.stringify(d.v6)}`) }, null, 1).slice(0, 4000));
})().catch(e => { console.error(e); process.exit(1); });
