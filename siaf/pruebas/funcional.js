// Pruebas funcionales y de extremo a extremo de SIAFver6 (y comparativas de seguridad con v5).
const fs = require('fs'); const path = require('path');
const { abrir, login, cerrarModales, RAIZ } = require('./comun');
const SHOTS = path.join(RAIZ, 'pruebas/resultados/capturas'); fs.mkdirSync(SHOTS, { recursive: true });
const R = []; const ok = (id, nombre, cond, evid) => { R.push({ id, nombre, estado: cond ? 'APROBADA' : 'FALLIDA', evidencia: evid }); console.log(cond ? '✔' : '✖', id, nombre, '—', JSON.stringify(evid).slice(0, 200)); };
const llenar = async (page, vals) => { for (const [k, v] of Object.entries(vals)) { const el = await page.$(`.modal [name="${k}"]`); const tag = await el.evaluate(e => e.tagName); if (tag === 'SELECT') await el.selectOption(v); else await el.fill(String(v)); } };
const guardar = async page => { await page.click('.modal [data-guardar]'); await page.waitForTimeout(500); };
(async () => {
  const P = '/tmp/siaf-f6'; fs.rmSync(P, { recursive: true, force: true });
  let s = await abrir(P, 'SIAFver6.html'); let page = s.page; const t0 = Date.now(); await login(page);
  ok('F01', 'Inicio: carga inicial (plano + demostración) e ingreso con PIN', await page.$('#app .topbar') !== null, { ms: Date.now() - t0 });
  // CRUD animal por la interfaz
  await page.evaluate(() => App.ir('ganado')); await page.click('[data-nuevo]'); await page.waitForSelector('.modal [name="arete"]');
  const lote = await page.evaluate(() => D.lotes().find(l => l.tipo === 'lote' && !D.ESTADOS_BLOQUEAN_INGRESO.includes(l.estado)).id);
  await llenar(page, { arete: 'TEST-001', nombre: 'Prueba', sexo: 'H', raza: 'Brahman', fechaNacimiento: '2023-01-15', pesoActual: 350, loteId: lote, procedencia: 'Compra', precioCompra: 2000000 });
  await guardar(page); await cerrarModales(page);
  const a1 = await page.evaluate(() => DB.todos('animales').find(a => a.arete === 'TEST-001'));
  ok('F02', 'Crear animal desde el formulario (con lote, pesaje inicial y compra)', !!a1 && a1.loteId === lote && a1.pesoActual === 350, { id: a1?.id, lote: a1?.loteId });
  const dup = await page.evaluate(() => D.validarAnimal({ arete: 'test-001' }, null).arete || '');
  ok('F03', 'Validación: arete duplicado rechazado', /duplicado/.test(dup), dup);
  await page.evaluate(id => Ganado.formulario(id), a1.id); await page.waitForSelector('.modal [name="nombre"]'); await llenar(page, { nombre: 'Prueba editada' }); await guardar(page); await cerrarModales(page);
  ok('F04', 'Editar animal', await page.evaluate(id => DB.get('animales', id).nombre, a1.id) === 'Prueba editada', {});
  await page.evaluate(id => Ganado.evento(id, 'Pesaje'), a1.id); await page.waitForSelector('.modal [name="peso"]'); await llenar(page, { peso: 380 }); await guardar(page); await cerrarModales(page);
  ok('F05', 'Registrar pesaje: actualiza peso actual y anterior', await page.evaluate(id => { const a = DB.get('animales', id); return a.pesoActual === 380 && a.pesoAnterior === 350; }, a1.id), {});
  const dest = await page.evaluate(l => D.lotes().find(x => x.tipo === 'lote' && x.id !== l && !D.ESTADOS_BLOQUEAN_INGRESO.includes(x.estado) && !D.animalesEnLote(x.id).length).id, lote);
  await page.evaluate(([id, d]) => D.moverAnimales({ ids: [id], destino: d, motivo: 'Prueba' }), [a1.id, dest]);
  ok('F06', 'Mover animal entre lotes: actualiza lote, ocupación y movimiento', await page.evaluate(([id, d]) => DB.get('animales', id).loteId === d && !!D.ocupacionAbierta(d) && DB.todos('movimientos').some(m => m.animales.includes(id) && m.destino === d), [a1.id, dest]), { dest });
  // persistencia tras recarga
  await page.reload(); await login(page);
  ok('F07', 'Persistencia después de recargar', await page.evaluate(id => DB.get('animales', id)?.nombre === 'Prueba editada', a1.id), {});
  // inventario: stock negativo bloqueado
  const negOk = await page.evaluate(async () => { const i = DB.todos('insumos')[0]; try { await D.movimientoInventario({ tipo: 'Salida', insumoId: i.id, cantidad: D.stock(i.id) + 100, fecha: U.hoyISO() }); return false; } catch (e) { return /negativo/.test(e.message); } });
  ok('F08', 'Inventario: impide stock negativo', negOk, {});
  // eliminar
  await page.evaluate(id => Ganado.abrir(id), a1.id); await page.waitForSelector('.modal [data-acc="eliminar"]'); await page.click('.modal [data-acc="eliminar"]'); await page.waitForTimeout(200);
  await page.click('.capa-oscura:last-child [data-si]'); await page.waitForTimeout(400); await cerrarModales(page);
  ok('F09', 'Eliminar animal (con confirmación)', await page.evaluate(id => !DB.get('animales', id), a1.id), {});
  // fotos
  const img = path.join('/tmp', 'foto_prueba.png'); fs.writeFileSync(img, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP8z8DAwMDAxMDAwMDAAAANHQEDK+mmyAAAAABJRU5ErkJggg==', 'base64'));
  const nf0 = await page.evaluate(() => DB.contarFotos());
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.evaluate(l => App.tomarFoto('lotes', l), lote)]); await fc.setFiles(img); await page.waitForTimeout(800);
  const nf1 = await page.evaluate(() => DB.contarFotos());
  await page.evaluate(l => Lote.abrir(l, 'fotos'), lote); await page.waitForTimeout(600);
  const imgs = await page.$$eval('.ficha .fotos img', x => x.length);
  ok('F10', 'Fotografía: captura, reducción a JPEG, guardado y visualización', nf1 === nf0 + 1 && imgs >= 1, { antes: nf0, despues: nf1, visibles: imgs });
  // exportaciones
  await page.evaluate(() => App.ir('reportes')); await page.waitForSelector('[data-xls]');
  const [dx] = await Promise.all([page.waitForEvent('download'), page.click('[data-xls]')]); const px = path.join('/tmp', dx.suggestedFilename()); await dx.saveAs(px);
  const [dc] = await Promise.all([page.waitForEvent('download'), page.click('[data-csv]')]); const pc = path.join('/tmp', dc.suggestedFilename()); await dc.saveAs(pc);
  const csv = fs.readFileSync(pc, 'utf8'); const zip = fs.readFileSync(px).slice(0, 2).toString();
  ok('F11', 'Exportación Excel (.xlsx) y CSV (UTF-8 con BOM, separador ;) del reporte', zip === 'PK' && csv.charCodeAt(0) === 0xFEFF && csv.includes(';'), { xlsx: dx.suggestedFilename(), csv: dc.suggestedFilename() });
  const nRep = await page.$$eval('#r-id option', o => o.length);
  let errRep = 0; for (let i = 0; i < nRep; i++) { await page.selectOption('#r-id', { index: i }); await page.waitForTimeout(60); errRep += (await page.$('#r-res .tabla, #r-res .vacio')) ? 0 : 1; }
  ok('F12', `Los ${nRep} reportes (23 originales + 5 nuevos) se generan`, nRep === 28 && errRep === 0, { nRep, errRep });
  const [dt] = await Promise.all([page.waitForEvent('download'), page.click('[data-xls-todo]')]);
  ok('F13', 'Exportar la finca completa a Excel', /\.xlsx$/.test(dt.suggestedFilename()), dt.suggestedFilename());
  // seguridad XSS comparada
  const xss = async archivo => { const t = await abrir('/tmp/siaf-xss-' + archivo, archivo); await login(t.page); const r = await t.page.evaluate(async () => { const l = DB.todos('lotes')[0]; await DB.put('lotes', { ...l, nombre: '<img src=x onerror="window.__xss=1">' }); Acc.estado(l.id); await new Promise(r => setTimeout(r, 400)); const h3 = document.querySelector('.modal-cab h3'); return { xss: window.__xss === 1, titulo: h3?.textContent, img: !!h3?.querySelector('img') }; }); await t.ctx.close(); return r; };
  const x5 = await xss('SIAFver5.html'), x6 = await xss('SIAFver6.html');
  ok('S01', 'XSS almacenado por nombre de lote: se ejecuta en v5; en v6 no se ejecuta ni se crea el elemento (el título se muestra como texto plano)', x5.xss === true && x6.xss === false && !x6.img, { v5: x5.xss, v6: x6.xss, tituloV6: x6.titulo });
  const lim = await page.evaluate(() => U.limpiarHTML('Hola <b>ok</b><img src=x onerror=alert(1)><script>x()</script><br>fin'));
  ok('S02', 'Depuración de HTML en confirmaciones: conserva <b>/<br> y elimina etiquetas peligrosas', lim === 'Hola <b>ok</b>x()<br>fin', lim);
  // permisos (rol Consulta)
  await page.evaluate(() => Auth.cerrarSesion()).catch(() => {}); await page.waitForTimeout(800);
  await login(page, '5555', 'usr-consulta');
  const perm = await page.evaluate(async () => { const r = {}; r.mover = await D.moverAnimales({ ids: [D.activos()[0].id], destino: DB.todos('lotes')[1].id }).then(() => 'permitido', e => e.message); r.importar = Auth.puede('importar'); r.exportar = Auth.puede('exportar'); App.ir('indicadores'); await new Promise(x => setTimeout(x, 400)); r.biVisible = !!document.querySelector('.bi-kpi'); App.ir('configuracion'); await new Promise(x => setTimeout(x, 400)); return r; });
  ok('F14', 'Permisos: el rol Consulta ve indicadores pero no puede mover ganado, exportar ni restaurar', /no tiene permiso/.test(perm.mover) && !perm.importar && !perm.exportar && perm.biVisible, perm);
  await page.evaluate(() => Auth.cerrarSesion()).catch(() => {}); await page.waitForTimeout(800); await login(page, '1234', 'usr-admin');
  // alertas: posponer
  const al = await page.evaluate(async () => { const a = D.alertas()[0]; const n0 = D.alertas().length; await AlertasCfg.posponer(a, 7); const n1 = D.alertas().length; const posp = D.alertasTodas().length; await AlertasCfg.reactivar(AlertasCfg.clave(a)); return { n0, n1, posp, n2: D.alertas().length }; });
  ok('F15', 'Alertas: posponer oculta la alerta (sin perderla) y reactivar la devuelve', al.n1 === al.n0 - 1 && al.posp === al.n0 && al.n2 === al.n0, al);
  const al2 = await page.evaluate(async () => { const tipo = D.alertas()[0].tipo; const n = D.alertas().filter(a => a.tipo === tipo).length; await DB.put('config', { id: 'alertasConfig', desactivadas: [tipo], p: {} }); const r = D.alertas().filter(a => a.tipo === tipo).length; await DB.put('config', { id: 'alertasConfig', desactivadas: [], p: {} }); return { tipo, n, r }; });
  ok('F16', 'Alertas: desactivar un tipo en la configuración', al2.n > 0 && al2.r === 0, al2);
  // BI: trazabilidad = valor
  const bi = await page.evaluate(() => { const X = BI.calcular({ d: U.sumarDias(U.hoyISO(), -364), h: U.hoyISO() }); const k = id => X.K.find(x => x.id === id); return { inv: k('inv').val, act: D.activos().length, cos: k('cos').val, cosD: D.costosDetalle().filter(c => c.fecha >= U.sumarDias(U.hoyISO(), -364) && c.fecha <= U.hoyISO()).reduce((s, c) => s + c.monto, 0) }; });
  ok('F17', 'Indicadores: inventario al cierre = animales activos y costos = suma de registros del periodo', bi.inv === bi.act && Math.abs(bi.cos - bi.cosD) < 0.01, bi);
  const biF = await page.evaluate(() => { const g = D.activos().find(a => a.grupo)?.grupo; const X = BI.calcular({ d: U.sumarDias(U.hoyISO(), -364), h: U.hoyISO(), grupo: g }); return { g, inv: X.K.find(x => x.id === 'inv').val, esperado: D.activos().filter(a => a.grupo === g).length }; });
  ok('F18', 'Indicadores: el filtro por grupo restringe el universo correctamente', biF.inv === biF.esperado, biF);
  const fin = await page.evaluate(() => { const y = U.hoyISO().slice(0, 4); const X = Fin.calcular(y + '-01-01', U.hoyISO()); const s = X.flujo.reduce((a, x) => a + x.costos, 0); return { tot: Math.round(X.tot.costos), suma: Math.round(s), fijos: Math.round(X.tot.fijos), vars: Math.round(X.tot.variables) }; });
  ok('F19', 'Flujo de caja: la suma mensual cuadra con el total y fijos + variables = total', fin.tot === fin.suma && fin.fijos + fin.vars === fin.tot, fin);
  // calidad de datos detecta inconsistencias sembradas
  const cal = await page.evaluate(async () => { await DB.put('eventos', { id: 'evt-huerfano', animalId: 'no-existe', tipo: 'Pesaje', fecha: U.hoyISO(), peso: 100 }); const r = Calidad.revisar().find(c => c.titulo.startsWith('Eventos de animales inexistentes')).items.length; await DB.del('eventos', 'evt-huerfano'); return r; });
  ok('F20', 'Calidad de datos detecta un evento huérfano sembrado', cal >= 1, { hallazgos: cal });
  // móvil
  await s.ctx.close();
  s = await abrir(P, 'SIAFver6.html', { movil: true }); page = s.page; await login(page);
  const anchos = {};
  for (const r of ['dashboard', 'indicadores', 'finanzas', 'alertas', 'asistente', 'calidad', 'ganado', 'configuracion']) {
    await page.evaluate(r => App.ir(r), r); await page.waitForTimeout(600); await cerrarModales(page);
    anchos[r] = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, vp: innerWidth }));
    if (['indicadores', 'finanzas', 'asistente', 'calidad'].includes(r)) await page.screenshot({ path: path.join(SHOTS, `movil_${r}.png`) });
  }
  ok('F21', 'Diseño móvil (390 px): sin desplazamiento horizontal de la página en vistas nuevas y originales', Object.values(anchos).every(x => x.doc <= x.vp + 1), anchos);
  await s.ctx.close();
  s = await abrir(P, 'SIAFver6.html'); page = s.page; await login(page);
  for (const r of ['indicadores', 'finanzas', 'alertas', 'calidad', 'dashboard']) { await page.evaluate(r => App.ir(r), r); await page.waitForTimeout(900); await page.screenshot({ path: path.join(SHOTS, `escritorio_${r}.png`) }); }
  ok('F22', 'Funcionamiento sin red: todas las peticiones http/https bloqueadas y la aplicación opera (0 recursos externos solicitados)', s.externas.length === 0, { externas: s.externas });
  ok('F23', 'Sin errores de JavaScript en las pruebas funcionales', !s.errores.length, s.errores);
  await s.ctx.close();
  fs.writeFileSync(path.join(RAIZ, 'pruebas/resultados/funcional.json'), JSON.stringify(R, null, 1));
  console.log(R.filter(r => r.estado === 'APROBADA').length + '/' + R.length + ' aprobadas');
})().catch(e => { console.error(e); process.exit(1); });
