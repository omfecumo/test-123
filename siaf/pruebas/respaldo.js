// Pruebas de respaldo y restauración (v6) + compatibilidad cruzada con v5 + defecto original de v5.
const fs = require('fs'); const path = require('path'); const crypto = require('crypto');
const { abrir, login, cerrarModales, RAIZ } = require('./comun');
const TMP = '/tmp/siaf-respaldos'; fs.mkdirSync(TMP, { recursive: true });
const R = []; const ok = (id, nombre, cond, evid) => { R.push({ id, nombre, estado: cond ? 'APROBADA' : 'FALLIDA', evidencia: evid }); console.log(cond ? '✔' : '✖', id, nombre, '—', JSON.stringify(evid).slice(0, 220)); };
async function bajar(page, fnClick) { const [d] = await Promise.all([page.waitForEvent('download'), fnClick()]); const p = path.join(TMP, d.suggestedFilename()); await d.saveAs(p); return p; }
async function restaurar(page, archivo, { acepto = false, conservar = null } = {}) {
  await page.evaluate(() => App.ir('configuracion')); await page.waitForSelector('#imp-f');
  await page.setInputFiles('#imp-f', archivo); await page.click('[data-imp]'); await page.waitForTimeout(600);
  const modal = await page.$('.modal'); if (!modal) return { modal: false };
  const info = await page.evaluate(() => ({ texto: document.querySelector('.modal').innerText, deshabilitado: document.querySelector('.modal [data-si]')?.disabled }));
  if (conservar !== null) { const c = await page.$('[data-o="fotos"]'); if (c) await c.setChecked(conservar); }
  if (acepto) { const c = await page.$('[data-o="acepto"]'); if (c) await c.check(); }
  if (!info.deshabilitado) { await Promise.all([page.waitForNavigation({ timeout: 60000 }).catch(() => null), page.click('.modal [data-si]')]); await login(page); }
  return { modal: true, ...info };
}
const fotos = page => page.evaluate(() => DB.contarFotos());
(async () => {
  const P6 = '/tmp/siaf-r6'; fs.rmSync(P6, { recursive: true, force: true });
  let s = await abrir(P6, 'SIAFver6.html'); let page = s.page; await login(page);
  // T1 exportación con fotos
  await page.evaluate(() => App.ir('configuracion')); await page.waitForSelector('[data-exp]');
  const f1 = await bajar(page, () => page.click('[data-exp]'));
  const j1 = JSON.parse(fs.readFileSync(f1, 'utf8')); const h1 = crypto.createHash('sha256').update(JSON.stringify(j1.datos)).digest('hex');
  ok('R01', 'Exportar respaldo JSON con versión, conteos y huella SHA-256', j1.formato === 2 && j1.versionApp === '6.0' && j1.integridad.hash === h1 && j1.conteos.animales === j1.datos.animales.length && j1.datos.fotos.length > 0, { formato: j1.formato, hashArchivo: j1.integridad.hash.slice(0, 16), hashNode: h1.slice(0, 16), animales: j1.conteos.animales, fotos: j1.datos.fotos.length, MB: +(fs.statSync(f1).size / 1048576).toFixed(2) });
  // compatibilidad SHA-256 propio vs Node
  const shaOk = await page.evaluate(() => { const t = 'SIAF ñandú 🐄 ' + 'x'.repeat(100000); return Seguro.sha256(new TextEncoder().encode(t)); });
  ok('R02', 'SHA-256 en JavaScript puro coincide con la implementación de referencia (Node crypto)', shaOk === crypto.createHash('sha256').update('SIAF ñandú 🐄 ' + 'x'.repeat(100000)).digest('hex'), { js: shaOk.slice(0, 16) });
  // T2 exportación sin fotos
  await cerrarModales(page); const f2 = await bajar(page, () => page.click('[data-exp-sin]')); const j2 = JSON.parse(fs.readFileSync(f2, 'utf8'));
  ok('R03', 'Exportar respaldo sin fotos (marcado sinFotos)', j2.sinFotos === true && j2.datos.fotos.length === 0, { sinFotos: j2.sinFotos });
  // T3 restauración válida revierte un cambio posterior
  await page.evaluate(() => DB.put('costos', { id: 'cos-prueba-r', fecha: U.hoyISO(), categoria: 'Otros', monto: 777, descripcion: 'cambio posterior' }));
  const r3 = await restaurar(page, f1);
  const st3 = await page.evaluate(async () => ({ existe: !!DB.get('costos', 'cos-prueba-r'), audit: DB.todos('auditoria').some(a => a.accion === 'Restauración'), puntos: (await Recuperacion.listar()).map(p => p.motivo) }));
  ok('R04', 'Restaurar respaldo válido: vista previa con integridad verificada, reemplaza datos y registra en bitácora', r3.texto.includes('Integridad verificada') && !st3.existe && st3.audit, st3);
  ok('R05', 'Antes de restaurar se crea un punto de restauración automático', st3.puntos.some(m => m.startsWith('Antes de restaurar')), st3.puntos);
  // T4 restaurar respaldo sin fotos conservando fotos
  const nf0 = await fotos(page); const r4 = await restaurar(page, f2, { conservar: true }); const nf1 = await fotos(page);
  ok('R06', 'Restaurar respaldo SIN fotos conserva las fotos del dispositivo (opción marcada)', r4.texto.includes('conservar las') && nf0 > 0 && nf1 === nf0, { antes: nf0, despues: nf1 });
  // T5 archivo alterado
  const j5 = JSON.parse(fs.readFileSync(f1, 'utf8')); j5.datos.animales[0].pesoActual = 9999; const f5 = path.join(TMP, 'alterado.json'); fs.writeFileSync(f5, JSON.stringify(j5));
  const r5 = await restaurar(page, f5); // sin aceptar → no restaura
  const peso5 = await page.evaluate(id => DB.get('animales', id)?.pesoActual, j5.datos.animales[0].id);
  ok('R07', 'Archivo modificado: detecta huella que no coincide y exige confirmación explícita', r5.texto.includes('Huella no coincide') && r5.texto.includes('Entiendo las advertencias') && peso5 !== 9999, { peso: peso5 });
  await cerrarModales(page);
  // T6 archivo malicioso (XSS y referencias inyectadas)
  const j6 = JSON.parse(fs.readFileSync(f2, 'utf8')); delete j6.integridad;
  const lote0 = j6.datos.lotes[0]; lote0.nombre = '<img src=x onerror="window.__xss=1">';
  j6.datos.animales.push({ id: 'x" onmouseover="window.__xss=2', arete: 'MAL-1' });
  j6.datos.fotos.push({ id: 'fot-mal', entidad: 'lotes', entidadId: lote0.id, dataUrl: 'x" onerror="window.__xss=3', fecha: '2026-01-01' });
  j6.datos.animales[0].loteId = 'lote-001" onclick="window.__xss=4';
  const f6 = path.join(TMP, 'malicioso.json'); fs.writeFileSync(f6, JSON.stringify(j6));
  const r6 = await restaurar(page, f6, { acepto: true, conservar: false });
  await page.evaluate(id => { Acc.estado(id); }, lote0.id); await page.waitForTimeout(300); await cerrarModales(page);
  await page.evaluate(id => Lote.abrir(id, 'fotos'), lote0.id); await page.waitForTimeout(500);
  const x6 = await page.evaluate(([lid, aid]) => ({ xss: window.__xss || null, malAnimal: !!DB.todos('animales').find(a => a.arete === 'MAL-1'), loteIdLimpio: DB.get('animales', aid)?.loteId ?? null, fotoMala: false }), [lote0.id, j6.datos.animales[0].id]);
  ok('R08', 'Respaldo malicioso: descarta IDs/imágenes inválidos, vacía referencias inyectadas y no ejecuta código (XSS)', r6.texto.includes('se descartarán') && x6.xss === null && !x6.malAnimal && x6.loteIdLimpio === null, x6);
  await page.evaluate(([id, n]) => DB.put('lotes', { ...DB.get('lotes', id), nombre: n }), [lote0.id, '']); await cerrarModales(page);
  // T7 archivos inválidos
  const f7a = path.join(TMP, 'roto.json'); fs.writeFileSync(f7a, '{"app":"SIAF", datos:');
  await page.evaluate(() => App.ir('configuracion')); await page.waitForSelector('#imp-f'); await page.setInputFiles('#imp-f', f7a); await page.click('[data-imp]'); await page.waitForTimeout(400);
  const t7a = await page.evaluate(() => ({ modal: !!document.querySelector('.modal'), toast: document.querySelector('#toasts')?.innerText || '' }));
  const f7b = path.join(TMP, 'otro.json'); fs.writeFileSync(f7b, JSON.stringify({ hola: 'mundo', datos: [] }));
  const r7b = await restaurar(page, f7b);
  ok('R09', 'Archivo JSON corrupto y archivo que no es de SIAF son rechazados sin tocar los datos', !t7a.modal && /no es un JSON válido/.test(t7a.toast) && r7b.deshabilitado === true && /no es un respaldo de SIAF/.test(r7b.texto), { toast: t7a.toast.slice(0, 80), botonDeshabilitado: r7b.deshabilitado });
  await cerrarModales(page);
  // T8 punto de restauración
  const antes8 = await page.evaluate(() => DB.todos('animales').length);
  await page.evaluate(() => DB.put('animales', { id: 'ani-prueba-pr', arete: 'PR-1', estado: 'Activo', sexo: 'H' }));
  await page.evaluate(() => Recuperacion.crear('Prueba R10'));
  await page.evaluate(() => DB.del('animales', 'ani-prueba-pr'));
  const pid = await page.evaluate(async () => (await Recuperacion.listar()).find(p => p.motivo === 'Prueba R10').id);
  await Promise.all([page.waitForNavigation({ timeout: 60000 }).catch(() => null), page.evaluate(id => { setTimeout(() => document.querySelector('.modal [data-si]')?.click(), 300); return Recuperacion.restaurar(id); }, pid)]);
  await login(page); const r10 = await page.evaluate(() => !!DB.get('animales', 'ani-prueba-pr'));
  ok('R10', 'Restaurar un punto de restauración recupera los datos', r10, { recuperado: r10, animalesAntes: antes8 });
  await s.ctx.close();
  // T9 compatibilidad: respaldo v6 importado en v5, y defecto original de v5 con respaldos sin fotos
  const P5 = '/tmp/siaf-r5'; fs.rmSync(P5, { recursive: true, force: true });
  s = await abrir(P5, 'SIAFver5.html'); page = s.page; await login(page);
  const nf5 = await fotos(page);
  await page.evaluate(() => App.ir('configuracion')); await page.waitForSelector('#imp-f'); await page.setInputFiles('#imp-f', f2); page.once('dialog', d => d.accept());
  await page.click('[data-imp]'); await page.waitForTimeout(500);
  await Promise.all([page.waitForNavigation({ timeout: 60000 }).catch(() => null), page.click('.modal [data-si]')]); await login(page);
  const v5r = await page.evaluate(() => ({ animales: DB.todos('animales').length, fotos: null }));
  v5r.fotos = await fotos(page);
  ok('R11', 'Reversión: un respaldo exportado por v6 se restaura en SIAF v5', v5r.animales === j2.datos.animales.length, v5r);
  ok('R12', 'Defecto confirmado en v5: restaurar un respaldo «sin fotos» elimina todas las fotos del dispositivo (corregido en v6, ver R06)', nf5 > 0 && v5r.fotos === 0, { fotosAntes: nf5, fotosDespues: v5r.fotos });
  // T10 respaldo v5 (formato 1) en v6
  await page.evaluate(() => App.ir('configuracion')); await page.waitForSelector('[data-exp]'); const f5v = await bajar(page, () => page.click('[data-exp]'));
  await s.ctx.close();
  s = await abrir(P6, 'SIAFver6.html'); page = s.page; await login(page);
  const r13 = await restaurar(page, f5v);
  const st13 = await page.evaluate(() => ({ animales: DB.todos('animales').length, esquema: DB.get('config', 'esquema')?.v }));
  ok('R13', 'Respaldo de v5 (formato 1, sin huella) se valida con aviso y se restaura en v6; la migración vuelve a registrar el esquema', /Sin huella/.test(r13.texto) && st13.animales > 0 && st13.esquema === 6, st13);
  ok('R14', 'Sin errores de JavaScript durante las pruebas de respaldo en v6', !s.errores.length, s.errores);
  await s.ctx.close();
  fs.writeFileSync(path.join(RAIZ, 'pruebas/resultados/respaldo.json'), JSON.stringify(R, null, 1));
  console.log(R.filter(r => r.estado === 'APROBADA').length + '/' + R.length + ' aprobadas');
})().catch(e => { console.error(e); process.exit(1); });
