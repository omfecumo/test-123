/* SIAF v6 — módulo de evolución. Se carga después de los módulos originales y antes de v_config.js.
   Contenido: Seguro (SHA-256), Recuperacion (puntos de restauración), Respaldo (formato 2 con integridad,
   validación y vista previa), Migracion (esquema versionado), Traza (rastreo de indicadores), BI (indicadores
   con filtros), Fin (flujo de caja y rentabilidad), AlertasCfg / Alertas6 (alertas configurables), Asistente
   (consultas locales sobre los datos), Calidad (verificación de integridad de datos), Genea (genealogía) y
   reportes adicionales. Todo funciona sin Internet y sin servidor.
   © 2026 Omar Fernando Cuadro Mogollón. Todos los derechos reservados. */
'use strict';

// =====================================================================================================
// Seguro: SHA-256 eficiente sobre bytes (respaldos grandes con fotos). crypto.subtle cuando exista.
// =====================================================================================================
const Seguro = (() => {
  const K = [0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2].map(x => x | 0);
  const hex = arr => Array.from(arr, x => (x >>> 0).toString(16).padStart(8, '0')).join('');
  /** SHA-256 de un Uint8Array, en JavaScript puro (funciona en file://). */
  function sha256(m) {
    const l = m.length, nb = ((l + 9 + 63) >> 6) << 6;
    const b = new Uint8Array(nb); b.set(m); b[l] = 0x80;
    const dv = new DataView(b.buffer); dv.setUint32(nb - 8, Math.floor(l / 0x20000000)); dv.setUint32(nb - 4, (l << 3) >>> 0);
    let h0 = 0x6a09e667, h1 = 0xbb67ae85 | 0, h2 = 0x3c6ef372, h3 = 0xa54ff53a | 0, h4 = 0x510e527f, h5 = 0x9b05688c | 0, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;
    const w = new Int32Array(64);
    for (let o = 0; o < nb; o += 64) {
      for (let i = 0; i < 16; i++) w[i] = dv.getInt32(o + i * 4);
      for (let i = 16; i < 64; i++) { const x = w[i - 15], y = w[i - 2]; const s0 = ((x >>> 7) | (x << 25)) ^ ((x >>> 18) | (x << 14)) ^ (x >>> 3); const s1 = ((y >>> 17) | (y << 15)) ^ ((y >>> 19) | (y << 13)) ^ (y >>> 10); w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0; }
      let a = h0, bb = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
      for (let i = 0; i < 64; i++) {
        const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7)); const ch = (e & f) ^ (~e & g); const t1 = (h + S1 + ch + K[i] + w[i]) | 0;
        const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10)); const mj = (a & bb) ^ (a & c) ^ (bb & c); const t2 = (S0 + mj) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = bb; bb = a; a = (t1 + t2) | 0;
      }
      h0 = (h0 + a) | 0; h1 = (h1 + bb) | 0; h2 = (h2 + c) | 0; h3 = (h3 + d) | 0; h4 = (h4 + e) | 0; h5 = (h5 + f) | 0; h6 = (h6 + g) | 0; h7 = (h7 + h) | 0;
    }
    return hex([h0, h1, h2, h3, h4, h5, h6, h7]);
  }
  async function hashTexto(s) {
    const b = new TextEncoder().encode(s);
    try { if (window.crypto && crypto.subtle && window.isSecureContext) { const d = new Uint8Array(await crypto.subtle.digest('SHA-256', b)); return Array.from(d, x => x.toString(16).padStart(2, '0')).join(''); } } catch (e) { }
    return sha256(b);
  }
  return { sha256, hashTexto };
})();

// =====================================================================================================
// Recuperacion: puntos de restauración guardados en una base IndexedDB separada (siaf_recuperacion).
// Se crean automáticamente antes de restaurar, migrar o borrar todo. Se conservan los 3 más recientes.
// =====================================================================================================
const Recuperacion = (() => {
  const NOMBRE = 'siaf_recuperacion', MAX = 3;
  let dbp = null;
  function abrir() {
    if (dbp) return dbp;
    dbp = new Promise((res, rej) => {
      const r = indexedDB.open(NOMBRE, 1);
      r.onupgradeneeded = () => { const d = r.result; if (!d.objectStoreNames.contains('meta')) d.createObjectStore('meta', { keyPath: 'id' }); if (!d.objectStoreNames.contains('datos')) d.createObjectStore('datos', { keyPath: 'id' }); };
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); r.onblocked = () => rej(new Error('La base de recuperación está bloqueada por otra pestaña.'));
    });
    dbp.catch(() => { dbp = null; });
    return dbp;
  }
  const req = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const fin = t => new Promise((res, rej) => { t.oncomplete = res; t.onerror = () => rej(t.error); t.onabort = () => rej(t.error || new Error('Transacción cancelada (¿espacio insuficiente?)')); });
  async function listar() { const d = await abrir(); const xs = await req(d.transaction('meta').objectStore('meta').getAll()); return xs.sort((a, b) => b.fecha.localeCompare(a.fecha)); }
  async function crear(motivo) {
    const j = await DB.exportar();
    const conteos = {}; let bytes = 0; for (const c of DB.COLECCIONES) { conteos[c] = (j.datos[c] || []).length; }
    for (const f of j.datos.fotos || []) bytes += (f.dataUrl || '').length;
    const id = U.uid('pr-');
    const meta = { id, fecha: U.ahoraISO(), motivo, usuario: Auth.actual?.nombre || 'Sistema', conteos, bytesFotos: bytes, esquema: (DB.get('config', 'esquema') || {}).v || 5 };
    const d = await abrir(); const t = d.transaction(['meta', 'datos'], 'readwrite');
    t.objectStore('meta').put(meta); t.objectStore('datos').put({ id, j }); await fin(t);
    const xs = await listar();
    if (xs.length > MAX) { const t2 = d.transaction(['meta', 'datos'], 'readwrite'); for (const x of xs.slice(MAX)) { t2.objectStore('meta').delete(x.id); t2.objectStore('datos').delete(x.id); } await fin(t2); }
    return meta;
  }
  async function obtener(id) { const d = await abrir(); const x = await req(d.transaction('datos').objectStore('datos').get(id)); return x && x.j; }
  async function eliminar(id) { const d = await abrir(); const t = d.transaction(['meta', 'datos'], 'readwrite'); t.objectStore('meta').delete(id); t.objectStore('datos').delete(id); await fin(t); }
  async function restaurar(id) {
    Auth.exigir('importar');
    const meta = (await listar()).find(x => x.id === id); const j = await obtener(id); if (!j) throw new Error('El punto de restauración no existe.');
    if (!await U.confirmar(`Se restaurarán los datos del <b>${U.fechaHora(meta.fecha)}</b> («${U.esc(meta.motivo)}»): ${meta.conteos.animales} animales, ${meta.conteos.lotes} lotes, ${meta.conteos.fotos} fotos.<br><br>Antes se creará otro punto de restauración con los datos actuales. ¿Continuar?`, { si: 'Restaurar punto', peligro: true })) return false;
    await crear('Antes de restaurar el punto del ' + U.fechaHora(meta.fecha)).catch(e => console.warn(e));
    await DB.importar(j);
    await DB.put('auditoria', { fecha: U.ahoraISO(), usuario: Auth.actual?.nombre || 'Sistema', rol: Auth.actual?.rol || '', accion: 'Restauración', desc: `Restauración del punto del ${U.fechaHora(meta.fecha)} (${meta.motivo})` }, { sinBitacora: true });
    U.toast('Punto de restauración aplicado. Reiniciando…', 'ok'); setTimeout(() => location.reload(), 900);
    return true;
  }
  async function panel(el) {
    if (!el) return;
    let xs = []; try { xs = await listar(); } catch (e) { el.innerHTML = `<h3>🛟 Puntos de restauración</h3><p class="sub">No disponibles en este navegador: ${U.esc(e.message)}</p>`; return; }
    const MB = b => U.num(b / 1048576, 1) + ' MB';
    el.innerHTML = `<h3>🛟 Puntos de restauración</h3><p class="sub">Copias automáticas de los datos de este dispositivo, creadas antes de restaurar un respaldo, actualizar la versión o borrar todo. Se conservan las ${MAX} más recientes. No reemplazan el respaldo en un archivo externo.</p>
      ${xs.length ? U.tabla([{ k: 'fecha', l: 'Fecha', f: x => U.fechaHora(x.fecha) }, { k: 'motivo', l: 'Motivo' }, { k: 'usuario', l: 'Usuario' },
        { k: 'c', l: 'Contenido', f: x => `${x.conteos.animales} animales · ${x.conteos.lotes} lotes · ${x.conteos.eventos} eventos · ${x.conteos.fotos} fotos (${MB(x.bytesFotos || 0)})` },
        { k: 'a', l: '', f: x => `<button class="btn peq" data-pr-d="${x.id}">⬇️</button> <button class="btn peq" data-pr-r="${x.id}">↩️ Restaurar</button> <button class="btn peq" data-pr-x="${x.id}" aria-label="Eliminar">🗑️</button>` }], xs) : '<div class="vacio">Aún no hay puntos de restauración.</div>'}
      <div class="acciones" style="margin-top:.5rem"><button class="btn peq" data-pr-n>＋ Crear punto ahora</button></div>`;
    el.onclick = async e => {
      const b = e.target.closest('button'); if (!b) return;
      try {
        if (b.dataset.prN !== undefined) { Auth.exigir('importar'); b.disabled = true; await crear('Creado manualmente'); U.toast('Punto de restauración creado', 'ok'); panel(el); }
        if (b.dataset.prD) { Auth.exigir('exportar'); const j = await obtener(b.dataset.prD); const { texto } = await Respaldo.construirDesde(j, true); U.descargar(`finca_punto_${b.dataset.prD}.json`, texto, 'application/json'); }
        if (b.dataset.prR) await restaurar(b.dataset.prR);
        if (b.dataset.prX) { Auth.exigir('importar'); if (await U.confirmar('¿Eliminar este punto de restauración?', { peligro: true, si: 'Eliminar' })) { await eliminar(b.dataset.prX); panel(el); } }
      } catch (ex) { U.toast(ex.message, 'error'); b.disabled = false; }
    };
  }
  return { crear, listar, obtener, eliminar, restaurar, panel, MAX };
})();

// =====================================================================================================
// Respaldo: formato 2 (versión, conteos, huella SHA-256), validación estricta y vista previa.
// Compatibilidad: v6 lee respaldos v5 (formato 1) y v5 puede leer los de v6 (mismos campos base).
// =====================================================================================================
const Respaldo = (() => {
  const FORMATO = 2, VERSION_APP = '6.0';
  const ID_OK = /^[A-Za-z0-9_\-.:]{1,120}$/;
  async function construirDesde(j, conFotos = true) {
    const datos = { ...j.datos }; if (!conFotos) datos.fotos = [];
    const datosStr = JSON.stringify(datos); const hash = await Seguro.hashTexto(datosStr);
    const conteos = {}; for (const [c, xs] of Object.entries(datos)) conteos[c] = Array.isArray(xs) ? xs.length : 0;
    const meta = { app: 'SIAF', formato: FORMATO, versionApp: VERSION_APP, esquema: (DB.get('config', 'esquema') || {}).v || 6, exportado: j.exportado || U.ahoraISO(), exportadoPor: j.exportadoPor || (Auth.actual?.nombre || ''),
      finca: D.param('nombreFinca'), sinFotos: !conFotos, conteos, integridad: { alg: 'SHA-256', alcance: 'datos', hash } };
    return { texto: JSON.stringify(meta).slice(0, -1) + ',"datos":' + datosStr + '}', meta };
  }
  async function descargar(conFotos = true) {
    const { texto } = await construirDesde(await DB.exportar(), conFotos);
    U.descargar(`finca_backup_${U.hoyISO()}${conFotos ? '' : '_sin_fotos'}.json`, texto, 'application/json');
    return texto.length;
  }
  /** Valida estructura, versión, integridad e identificadores. Devuelve {errores, avisos, integridad, datos, ...}. */
  async function validar(j) {
    const R = { errores: [], avisos: [], integridad: 'sin-firma', descartes: {}, refsLimpias: 0, datos: null, formato: 1 };
    if (!j || typeof j !== 'object' || Array.isArray(j)) { R.errores.push('El archivo no contiene un objeto JSON.'); return R; }
    if (j.app !== 'SIAF') R.errores.push('El archivo no es un respaldo de SIAF (falta «app: SIAF»).');
    if (!j.datos || typeof j.datos !== 'object' || Array.isArray(j.datos)) { R.errores.push('El respaldo no contiene la sección «datos».'); return R; }
    R.formato = +j.formato || 1;
    const faltan = ['lotes', 'animales', 'usuarios'].filter(c => !Array.isArray(j.datos[c])); if (faltan.length) R.errores.push('Respaldo incompleto: faltan ' + faltan.join(', ') + '.');
    if (j.integridad && typeof j.integridad.hash === 'string') {
      const h = await Seguro.hashTexto(JSON.stringify(j.datos)); R.integridad = h === j.integridad.hash ? 'verificada' : 'alterada';
      if (R.integridad === 'alterada') R.avisos.push('La huella SHA-256 NO coincide: el archivo fue modificado después de exportarse o está dañado. Restáurelo solo si conoce el origen del cambio.');
    } else R.avisos.push('Respaldo sin huella de integridad (formato de SIAF v5): no se puede comprobar que no haya sido modificado.');
    if (R.formato > FORMATO) R.avisos.push(`Fue creado con un formato más nuevo (${R.formato}); algunos datos podrían no interpretarse.`);
    const ignoradas = Object.keys(j.datos).filter(c => !DB.COLECCIONES.includes(c)); if (ignoradas.length) R.avisos.push('Colecciones desconocidas que se ignorarán: ' + ignoradas.map(U.esc).join(', ') + '.');
    const ausentes = DB.COLECCIONES.filter(c => !(c in j.datos)); if (ausentes.length) R.avisos.push('El respaldo no contiene: ' + ausentes.map(c => DB.ETIQUETAS[c] || c).join(', ') + '. Esas colecciones quedarán vacías.');
    const limpio = {}; const rolesMal = [];
    for (const c of DB.COLECCIONES) {
      const xs = j.datos[c]; if (xs == null) { limpio[c] = []; R.descartes[c] = { inval: 0, dupl: 0, total: 0 }; continue; }
      if (!Array.isArray(xs)) { R.errores.push(`«${c}» no es una lista.`); limpio[c] = []; continue; }
      const vistos = new Map(); let inval = 0;
      for (const o of xs) {
        if (!o || typeof o !== 'object' || Array.isArray(o) || typeof o.id !== 'string' || !ID_OK.test(o.id)) { inval++; continue; }
        if (c === 'fotos' && (!U.srcSeguro(o.dataUrl) || !DB.COLECCIONES.includes(o.entidad))) { inval++; continue; }
        const x = { ...o };
        for (const k of Object.keys(x)) if (/Id$/.test(k) && x[k] != null && x[k] !== '' && (typeof x[k] !== 'string' || !ID_OK.test(x[k]))) { x[k] = null; R.refsLimpias++; }
        if (c === 'movimientos') {
          for (const k of ['origen', 'destino']) if (x[k] != null && x[k] !== '' && (typeof x[k] !== 'string' || !ID_OK.test(x[k]))) { x[k] = null; R.refsLimpias++; }
          if (Array.isArray(x.animales)) { const a = x.animales.filter(v => typeof v === 'string' && ID_OK.test(v)); R.refsLimpias += x.animales.length - a.length; x.animales = a; }
        }
        if (c === 'usuarios' && !Auth.ROLES[x.rol]) rolesMal.push(U.esc(U.textoPlano(x.nombre)));
        vistos.set(x.id, x);
      }
      limpio[c] = [...vistos.values()]; R.descartes[c] = { inval, dupl: xs.length - inval - vistos.size, total: xs.length };
    }
    const nInv = Object.values(R.descartes).reduce((s, d) => s + d.inval, 0), nDup = Object.values(R.descartes).reduce((s, d) => s + d.dupl, 0);
    if (nInv) R.avisos.push(`${nInv} registro(s) con identificador o imagen no válidos se descartarán.`);
    if (nDup) R.avisos.push(`${nDup} registro(s) con identificador repetido: se conserva la última versión de cada uno.`);
    if (R.refsLimpias) R.avisos.push(`${R.refsLimpias} referencia(s) con formato no válido se vaciarán (posible archivo manipulado).`);
    if (rolesMal.length) R.avisos.push('Usuarios con rol desconocido (no tendrán permisos): ' + rolesMal.join(', ') + '.');
    if (!limpio.usuarios.some(u => u.rol === 'admin' && u.activo !== false) && limpio.usuarios.length) R.avisos.push('El respaldo no tiene un administrador activo: no podrá cambiar parámetros ni usuarios.');
    R.datos = { app: 'SIAF', formato: R.formato, exportado: j.exportado, exportadoPor: j.exportadoPor, datos: limpio };
    R.sinFotos = !!j.sinFotos || !limpio.fotos.length;
    R.meta = { exportado: j.exportado, exportadoPor: j.exportadoPor, versionApp: j.versionApp || '5 o anterior', esquema: j.esquema || 5, finca: j.finca || '' };
    return R;
  }
  async function restaurarArchivo(file) {
    if (file.size > 400 * 1048576) return U.toast('El archivo supera 400 MB; no parece un respaldo de SIAF.', 'error');
    let j; try { j = JSON.parse(await file.text()); } catch (e) { return U.toast('El archivo no es un JSON válido: ' + e.message, 'error'); }
    const R = await validar(j);
    const nFotosAct = await DB.contarFotos();
    const filas = DB.COLECCIONES.filter(c => c !== 'config').map(c => ({ c, act: c === 'fotos' ? nFotosAct : DB.todos(c).length, nuevo: (R.datos?.datos[c] || []).length, d: R.descartes[c] || { inval: 0, dupl: 0 } }));
    const tagInt = { verificada: '<span class="tag ok">✔ Integridad verificada (SHA-256)</span>', alterada: '<span class="tag peligro">✖ Huella no coincide</span>', 'sin-firma': '<span class="tag warn">Sin huella (formato v5)</span>' }[R.integridad];
    const ofrecerFotos = R.sinFotos && nFotosAct > 0;
    const exigeAcepto = R.integridad === 'alterada' || Object.values(R.descartes).some(d => d.inval) || R.refsLimpias > 0;
    const m = U.modal({ titulo: '♻️ Vista previa de la restauración', ancho: true, cuerpo: `
      <p><b>${U.esc(file.name)}</b> · ${U.num(file.size / 1048576, 2)} MB<br><span class="sub">Exportado ${U.fechaHora(R.meta?.exportado)} por ${U.esc(R.meta?.exportadoPor || '—')} · SIAF ${U.esc(R.meta?.versionApp || '—')} · formato ${R.formato}${R.meta?.finca ? ' · ' + U.esc(R.meta.finca) : ''}</span></p>
      <div class="acciones" style="margin-bottom:.6rem">${tagInt}</div>
      ${R.errores.length ? `<div class="aviso-error">${R.errores.map(x => '⛔ ' + U.esc(x)).join('<br>')}</div>` : ''}
      ${R.avisos.length ? `<div class="aviso-demo">${R.avisos.map(x => '⚠️ ' + x).join('<br>')}</div>` : ''}
      ${U.tabla([{ k: 'c', l: 'Colección', f: x => U.esc(DB.ETIQUETAS[x.c] || x.c) }, { k: 'act', l: 'Datos actuales', num: 1, f: x => U.num(x.act) }, { k: 'nuevo', l: 'En el respaldo', num: 1, f: x => `<b>${U.num(x.nuevo)}</b>` },
        { k: 'dif', l: 'Diferencia', num: 1, f: x => { const d = x.nuevo - x.act; return d ? `<span class="tag ${d < 0 ? 'warn' : 'info'}">${d > 0 ? '+' : ''}${U.num(d)}</span>` : '='; } },
        { k: 'd', l: 'Descartados', num: 1, f: x => x.d.inval || x.d.dupl ? `${x.d.inval} inválidos · ${x.d.dupl} repetidos` : '—' }], filas)}
      <div class="panel" style="margin-top:.8rem">
        <p><b>Se reemplazarán todos los datos actuales de este dispositivo.</b> Antes se creará automáticamente un <b>punto de restauración</b> con los datos actuales (Configuración → Respaldo).</p>
        ${ofrecerFotos ? `<label class="chk"><input type="checkbox" data-o="fotos" checked> El respaldo no trae fotografías: <b>conservar las ${nFotosAct} fotos actuales</b> del dispositivo.</label>` : ''}
        ${U.incrustada() ? '' : '<label class="chk"><input type="checkbox" data-o="descargar"> Descargar además un archivo con los datos actuales antes de restaurar.</label>'}
        ${exigeAcepto ? '<label class="chk"><input type="checkbox" data-o="acepto"> Entiendo las advertencias y deseo restaurar de todas formas.</label>' : ''}
      </div>
      <div class="acciones" style="justify-content:flex-end"><button class="btn" data-no>Cancelar</button><button class="btn peligro" data-si ${R.errores.length ? 'disabled' : ''}>♻️ Restaurar</button></div>` });
    const op = k => { const x = U.$(`[data-o="${k}"]`, m.el); return !!(x && x.checked); };
    U.$('[data-no]', m.el).onclick = m.cerrar;
    U.$('[data-si]', m.el).onclick = async () => {
      if (R.errores.length) return;
      if (exigeAcepto && !op('acepto')) return U.toast('Marque la casilla de confirmación para continuar.', 'warn');
      const b = U.$('[data-si]', m.el); b.disabled = true; b.textContent = 'Restaurando…';
      try {
        let punto = null; try { punto = await Recuperacion.crear(`Antes de restaurar «${file.name}»`); } catch (e) { console.warn(e); }
        if (!punto && !await U.confirmar('No se pudo crear el punto de restauración (posible falta de espacio). Si continúa, los datos actuales no podrán recuperarse desde la aplicación. ¿Restaurar de todas formas?', { si: 'Restaurar sin punto', peligro: true })) { b.disabled = false; b.textContent = '♻️ Restaurar'; return; }
        if (op('descargar')) await descargar(true);
        await DB.importar(R.datos, { conservarFotos: ofrecerFotos && op('fotos') });
        await DB.put('auditoria', { fecha: U.ahoraISO(), usuario: Auth.actual?.nombre || 'Sistema', rol: Auth.actual?.rol || '', accion: 'Restauración', desc: `Restauración desde «${file.name}» · integridad: ${R.integridad}${punto ? ' · punto previo ' + punto.id : ''}` }, { sinBitacora: true });
        m.cerrar(); U.toast('Finca restaurada. Reiniciando…', 'ok'); setTimeout(() => location.reload(), 900);
      } catch (e) { console.error(e); U.toast('No se pudo restaurar: ' + e.message, 'error'); b.disabled = false; b.textContent = '♻️ Restaurar'; }
    };
    return R;
  }
  return { construirDesde, descargar, validar, restaurarArchivo, FORMATO, VERSION_APP, ID_OK };
})();

// =====================================================================================================
// Migracion: esquema de datos versionado. v5 → v6 no altera registros existentes; solo agrega el
// documento config/esquema con su historial. Antes de migrar se crea un punto de restauración.
// =====================================================================================================
const Migracion = (() => {
  const ESQUEMA = 6;
  async function ejecutar(primera) {
    const e = DB.get('config', 'esquema'); const v = (e && e.v) || 5;
    if (v > ESQUEMA) { setTimeout(() => U.toast(`Los datos fueron creados con una versión más nueva de SIAF (esquema ${v}). Use esa versión para no perder información.`, 'warn'), 1500); return { v, migrado: false }; }
    if (v === ESQUEMA) return { v, migrado: false };
    let punto = null;
    if (!primera) { try { punto = await Recuperacion.crear('Antes de actualizar los datos a SIAF v6'); } catch (err) { console.warn('Punto de restauración no creado:', err); } }
    const historial = [...((e && e.historial) || []), { de: v, a: ESQUEMA, fecha: U.ahoraISO(), punto: punto ? punto.id : null, cambios: 'Sin cambios destructivos: se agregan documentos de configuración (esquema, alertas, clases de costo). Los registros existentes no se modifican. Compatible con SIAF v5.' }];
    await DB.put('config', { id: 'esquema', v: ESQUEMA, historial }, { accion: 'Migración', desc: `Datos verificados y actualizados al esquema v${ESQUEMA}${punto ? ' (punto de restauración ' + punto.id + ')' : ''}` });
    if (!primera) setTimeout(() => U.toast('SIAF v6: sus datos se conservaron y se creó un punto de restauración previo (Configuración → Respaldo).', 'ok'), 1800);
    return { v: ESQUEMA, migrado: true, punto };
  }
  return { ejecutar, ESQUEMA };
})();

// =====================================================================================================
// Traza: lista los registros que originan un indicador, con exportación CSV.
// =====================================================================================================
const Traza = (() => {
  const slug = t => String(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 60);
  const fmtVal = (v, c) => v == null || v === '' ? '—' : c.fecha ? U.fecha(v) : c.dinero ? U.dinero(v) : typeof v === 'number' ? U.num(v, c.dec ?? (Number.isInteger(v) ? 0 : 2)) : String(v);
  function abrir({ titulo, nota = '', cols, filas, alClic }) {
    const m = U.modal({ titulo, ancho: true, cuerpo: `${nota ? `<p class="sub">${nota}</p>` : ''}<div class="acciones" style="margin-bottom:.5rem"><span class="tag info">${U.num(filas.length)} registro(s)</span><button class="btn peq" data-csv>📄 Exportar CSV</button></div><div data-t></div>` });
    const vis = filas.slice(0, 1000);
    U.$('[data-t]', m.el).innerHTML = U.tabla(cols.map(c => ({ k: c.k, l: c.l, num: c.num || c.dinero, f: c.f || (x => U.esc(fmtVal(x[c.k], c))) })), vis, { onClic: alClic ? x => { m.cerrar(); alClic(x); } : undefined, vacio: 'Sin registros en el periodo y filtros seleccionados.' })
      + (filas.length > 1000 ? '<p class="sub">Se muestran 1.000 registros; exporte el CSV para verlos todos.</p>' : '');
    U.$('[data-csv]', m.el).onclick = () => {
      try { Auth.exigir('exportar'); } catch (e) { return U.toast(e.message, 'error'); }
      U.descargar(`${slug(U.textoPlano(titulo))}_${U.hoyISO()}.csv`, U.csv(cols.map(c => ({ k: c.k, l: c.l })), filas.map(f => Object.fromEntries(cols.map(c => [c.k, c.csv ? c.csv(f) : (c.fecha ? U.fecha(f[c.k]) : f[c.k])])))), 'text/csv;charset=utf-8');
    };
    return m;
  }
  return { abrir, slug };
})();

// =====================================================================================================
// Utilidades de análisis compartidas (BI, finanzas, asistente, reportes)
// =====================================================================================================
const An = (() => {
  const enR = (f, d, h) => !!f && f >= d && f <= h;
  const ingreso = a => a.fechaIngreso || a.fechaNacimiento || '0000-00-00';
  /** ¿El animal estaba en el inventario al final del día f? (misma regla del Resumen original) */
  const vivoEn = (a, f) => ingreso(a) <= f && (!a.fechaSalida || a.fechaSalida > f) && ((a.estado || 'Activo') === 'Activo' || !!a.fechaSalida);
  const NAT = { reg: 'Registrado', der: 'Derivado de inventario', est: 'Estimado' };
  /** Naturaleza de cada fila de D.costosDetalle(): movimiento registrado, valorización de consumo o estimación. */
  const naturaleza = c => /Consumo de insumo/.test(c.origen) ? NAT.der : c.origen === 'Fertilización' ? NAT.est : NAT.reg;
  const SANIT = ['Tratamiento', 'Vacunación', 'Desparasitación', 'Enfermedad'];
  /** Meses (YYYY-MM) entre dos fechas, máximo n. */
  function meses(d, h, max = 36) { const out = []; let y = +d.slice(0, 4), m = +d.slice(5, 7); const yh = +h.slice(0, 4), mh = +h.slice(5, 7); while ((y < yh || (y === yh && m <= mh)) && out.length < max) { out.push(`${y}-${String(m).padStart(2, '0')}`); m++; if (m > 12) { m = 1; y++; } } return out; }
  const finMes = ym => { const [y, m] = ym.split('-').map(Number); const f = new Date(y, m, 0); return `${ym}-${String(f.getDate()).padStart(2, '0')}`; };
  const etqMes = ym => U.MESES[+ym.slice(5, 7) - 1].slice(0, 3) + ' ' + ym.slice(2, 4);
  /** Proyección de agotamiento de inventario según consumo de los últimos `dias` días. */
  function proyeccion(dias = 90) {
    const desde = U.sumarDias(U.hoyISO(), -dias); const out = [];
    for (const i of DB.todos('insumos')) {
      const sal = DB.de('movinv', 'insumoId', i.id).filter(m => m.tipo === 'Salida' && m.fecha >= desde && m.fecha <= U.hoyISO()).reduce((s, m) => s + (+m.cantidad || 0), 0);
      if (!(sal > 0)) continue; const st = D.stock(i.id); const tasa = sal / dias;
      out.push({ i, st, tasa, consumo: sal, dias: st > 0 ? st / tasa : 0 });
    }
    return out.sort((a, b) => a.dias - b.dias);
  }
  /** Ganancia de peso por animal en el periodo (requiere ≥ 2 pesajes separados al menos 14 días). */
  function ganancias(animales, d, h) {
    const out = [];
    for (const a of animales) {
      const ps = D.pesajes(a.id).filter(p => enR(p.fecha, d, h)); if (ps.length < 2) continue;
      const p0 = ps[0], p1 = ps[ps.length - 1]; const dd = U.dias(p0.fecha, p1.fecha); if (dd < 14) continue;
      out.push({ a, p0, p1, dias: dd, kg: p1.peso - p0.peso, gdp: (p1.peso - p0.peso) / dd });
    }
    return out;
  }
  /** Intervalos entre partos (días) de cada vaca; el segundo parto define el periodo. */
  function intervalosParto(animales) {
    const out = [];
    for (const a of animales) { if (a.sexo !== 'H') continue; const ps = DB.de('eventos', 'animalId', a.id).filter(e => e.tipo === 'Parto').sort((x, y) => x.fecha.localeCompare(y.fecha)); for (let i = 1; i < ps.length; i++) out.push({ a, desde: ps[i - 1].fecha, hasta: ps[i].fecha, dias: U.dias(ps[i - 1].fecha, ps[i].fecha) }); }
    return out;
  }
  /** Ocupaciones cerradas con su descanso posterior (si hubo una nueva entrada). */
  function rotaciones(lotes) {
    const out = [];
    for (const l of lotes) { const os = DB.de('ocupaciones', 'loteId', l.id).slice().sort((a, b) => a.entrada.localeCompare(b.entrada)); os.forEach((o, i) => { if (!o.salida) return; const sig = os.slice(i + 1).find(x => x.entrada >= o.salida); out.push({ l, o, ocup: U.dias(o.entrada, o.salida), desc: sig ? U.dias(o.salida, sig.entrada) : null, sig }); }); }
    return out;
  }
  const pct = (a, b) => b ? a / b * 100 : null;
  return { enR, ingreso, vivoEn, naturaleza, NAT, SANIT, meses, finMes, etqMes, proyeccion, ganancias, intervalosParto, rotaciones, pct };
})();

// =====================================================================================================
// BI: «Indicadores y análisis» con filtros (periodo, lote, categoría, grupo, sexo), comparación con el
// periodo anterior y trazabilidad de cada indicador hasta sus registros.
// =====================================================================================================
const BI = (() => {
  const CLAVE = 'siaf_bi_filtros';
  const NATTAG = { medido: ['Medido', 'ok'], registrado: ['Registrado', 'info'], calculado: ['Calculado', 'info'], estimado: ['Estimado', 'warn'], proyeccion: ['Proyección', 'warn'] };
  function filtrosIniciales() {
    let g = {}; try { g = JSON.parse(localStorage.getItem(CLAVE) || '{}') || {}; } catch (e) { }
    const h = U.hoyISO(); return { d: g.d || U.sumarDias(h, -364), h: g.h || h, lote: g.lote || '', cat: g.cat || '', grupo: g.grupo || '', sexo: g.sexo || '' };
  }
  function universo(F) {
    let xs = DB.todos('animales');
    if (F.cat) xs = xs.filter(a => D.categoria(a) === F.cat);
    if (F.grupo) xs = xs.filter(a => a.grupo === F.grupo);
    if (F.sexo) xs = xs.filter(a => a.sexo === F.sexo);
    if (F.lote) {
      const ids = new Set();
      for (const m of DB.todos('movimientos')) if ((m.destino === F.lote || m.origen === F.lote) && An.enR(m.fecha, F.d, F.h)) (m.animales || []).forEach(i => ids.add(i));
      for (const a of xs) if (a.loteId === F.lote || (a.loteAnterior === F.lote && An.enR(a.fechaSalida, F.d, F.h))) ids.add(a.id);
      xs = xs.filter(a => ids.has(a.id));
    }
    return xs;
  }
  const filtrado = F => !!(F.lote || F.cat || F.grupo || F.sexo);
  /** Calcula todos los indicadores para el periodo [d,h] y el periodo anterior de igual duración. */
  function calcular(F) {
    const hoy = U.hoyISO(); const len = U.dias(F.d, F.h) + 1; const pd = U.sumarDias(F.d, -len), ph = U.sumarDias(F.d, -1);
    const uni = universo(F); const idsU = new Set(uni.map(a => a.id));
    const lotesL = F.lote ? [DB.get('lotes', F.lote)].filter(Boolean) : DB.filtrar('lotes', l => l.tipo === 'lote');
    const K = [];
    const kpi = o => { K.push(o); return o; };
    const colAnimal = [{ k: 'arete', l: 'Arete' }, { k: 'nombre', l: 'Nombre' }, { k: 'cat', l: 'Categoría' }, { k: 'lote', l: 'Lote' }];
    const filaA = a => ({ id: a.id, arete: a.arete, nombre: a.nombre || '', cat: D.categoria(a), lote: a.loteId ? D.nombreLoteId(a.loteId) : (a.estado || '—'), a });
    // ---------- hato ----------
    const vivos = f => uni.filter(a => An.vivoEn(a, f));
    const invFin = vivos(F.h > hoy ? hoy : F.h), invIni = vivos(ph);
    kpi({ g: 'Hato', id: 'inv', etq: 'Inventario al cierre', val: invFin.length, ant: invIni.length, fmt: x => U.num(x), uni: 'animales', nat: 'registrado', nota: 'Animales en inventario al final del periodo (ingreso ≤ fecha y sin salida).',
      traza: () => Traza.abrir({ titulo: 'Inventario al cierre del periodo', nota: `Al ${U.fecha(F.h)} · ${filtrado(F) ? 'con filtros' : 'toda la finca'}`, cols: [...colAnimal, { k: 'ing', l: 'Ingreso', fecha: 1 }], filas: invFin.map(a => ({ ...filaA(a), ing: An.ingreso(a) })), alClic: x => Ganado.abrir(x.id) }) });
    const entradas = (d, h) => uni.filter(a => An.enR(An.ingreso(a), d, h)).map(a => ({ a, tipo: /nacim/i.test(a.procedencia || '') ? 'Nacimiento' : (/compra/i.test(a.procedencia || '') || a.precioCompra) ? 'Compra' : 'Otro ingreso' }));
    const salidas = (d, h) => uni.filter(a => a.fechaSalida && An.enR(a.fechaSalida, d, h)).map(a => ({ a, tipo: a.estado || 'Salida' }));
    const E = entradas(F.d, F.h), S = salidas(F.d, F.h), E0 = entradas(pd, ph), S0 = salidas(pd, ph);
    const cuenta = (xs, t) => xs.filter(x => x.tipo === t).length;
    const trazaES = (titulo, xs) => () => Traza.abrir({ titulo, nota: `${U.fecha(F.d)} a ${U.fecha(F.h)}`, cols: [{ k: 'fecha', l: 'Fecha', fecha: 1 }, { k: 'tipo', l: 'Tipo' }, ...colAnimal, { k: 'proc', l: 'Procedencia / detalle' }, { k: 'valor', l: 'Valor', dinero: 1 }],
      filas: xs.map(x => ({ ...filaA(x.a), fecha: x.a.fechaSalida && x.tipo !== 'Nacimiento' && x.tipo !== 'Compra' && x.tipo !== 'Otro ingreso' ? x.a.fechaSalida : An.ingreso(x.a), tipo: x.tipo, proc: x.a.procedencia || '', valor: x.tipo === 'Vendido' ? (DB.de('eventos', 'animalId', x.a.id).find(e => e.tipo === 'Venta')?.valor || null) : x.tipo === 'Compra' ? x.a.precioCompra || null : null })), alClic: x => Ganado.abrir(x.id) });
    kpi({ g: 'Hato', id: 'ent', etq: 'Entradas', val: E.length, ant: E0.length, fmt: x => U.num(x), uni: '', nat: 'registrado', det: `${cuenta(E, 'Nacimiento')} nacimientos · ${cuenta(E, 'Compra')} compras · ${cuenta(E, 'Otro ingreso')} otros`, nota: 'Animales cuyo ingreso (o nacimiento) cae en el periodo.', traza: trazaES('Entradas al hato', E) });
    kpi({ g: 'Hato', id: 'sal', etq: 'Salidas', val: S.length, ant: S0.length, fmt: x => U.num(x), uni: '', nat: 'registrado', bueno: 'neutro', det: `${cuenta(S, 'Vendido')} ventas · ${cuenta(S, 'Muerto')} muertes · ${cuenta(S, 'Baja')} bajas`, nota: 'Ventas, muertes y bajas registradas en el periodo.', traza: trazaES('Salidas del hato', S) });
    const mort = (Sx, ini, Ex) => { const exp = ini + Ex.length; return exp ? cuenta(Sx, 'Muerto') / exp * 100 : null; };
    kpi({ g: 'Hato', id: 'mort', etq: 'Mortalidad', val: mort(S, invIni.length, E), ant: mort(S0, vivos(U.sumarDias(pd, -1)).length, E0), fmt: x => U.num(x, 1), uni: '%', nat: 'calculado', bueno: 'baja', nota: 'Muertes ÷ (inventario al inicio + entradas del periodo) × 100.', traza: trazaES('Muertes del periodo', S.filter(x => x.tipo === 'Muerto')) });
    const partosEn = (d, h) => uni.filter(a => a.sexo === 'H').flatMap(a => DB.de('eventos', 'animalId', a.id).filter(e => e.tipo === 'Parto' && An.enR(e.fecha, d, h)).map(e => ({ a, e })));
    const vientres = f => uni.filter(a => a.sexo === 'H' && An.vivoEn(a, f) && a.fechaNacimiento && U.mesesEntre(U.aFecha(a.fechaNacimiento), U.aFecha(f)) >= 24);
    const P = partosEn(F.d, F.h), P0 = partosEn(pd, ph); const V = vientres(F.d), V0 = vientres(pd);
    kpi({ g: 'Hato', id: 'nat', etq: 'Natalidad del periodo', val: An.pct(P.length, V.length), ant: An.pct(P0.length, V0.length), fmt: x => U.num(x, 0), uni: '%', nat: 'calculado', det: `${P.length} partos / ${V.length} hembras ≥ 24 meses al inicio`, nota: 'Partos registrados en el periodo ÷ hembras de 24 meses o más en inventario al inicio × 100. En periodos menores a un año no es una tasa anual.',
      traza: () => Traza.abrir({ titulo: 'Partos del periodo', cols: [{ k: 'fecha', l: 'Fecha', fecha: 1 }, ...colAnimal, { k: 'res', l: 'Resultado' }], filas: P.map(x => ({ ...filaA(x.a), fecha: x.e.fecha, res: x.e.resultado || '' })), alClic: x => Ganado.abrir(x.id) }) });
    const IEP = An.intervalosParto(uni).filter(x => An.enR(x.hasta, F.d, F.h)), IEP0 = An.intervalosParto(uni).filter(x => An.enR(x.hasta, pd, ph));
    const media = xs => xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null;
    kpi({ g: 'Hato', id: 'iep', etq: 'Intervalo entre partos', val: media(IEP.map(x => x.dias)), ant: media(IEP0.map(x => x.dias)), fmt: x => U.num(x, 0), uni: 'días', nat: 'calculado', bueno: 'baja', det: `${IEP.length} intervalos`, nota: 'Días entre partos consecutivos de la misma vaca; se cuentan los intervalos que terminan en el periodo.',
      traza: () => Traza.abrir({ titulo: 'Intervalos entre partos', cols: [...colAnimal, { k: 'desde', l: 'Parto anterior', fecha: 1 }, { k: 'hasta', l: 'Parto', fecha: 1 }, { k: 'dias', l: 'Días', num: 1 }], filas: IEP.map(x => ({ ...filaA(x.a), desde: x.desde, hasta: x.hasta, dias: x.dias })), alClic: x => Ganado.abrir(x.id) }) });
    // ---------- producción ----------
    const G = An.ganancias(uni, F.d, F.h), G0 = An.ganancias(uni, pd, ph);
    kpi({ g: 'Producción', id: 'gdp', etq: 'Ganancia diaria (GDP)', val: media(G.map(x => x.gdp)), ant: media(G0.map(x => x.gdp)), fmt: x => U.num(x, 3), uni: 'kg/día', nat: 'calculado', det: `${G.length} animales con ≥ 2 pesajes`, nota: 'Promedio por animal de (último − primer pesaje del periodo) ÷ días; solo animales con pesajes separados 14 días o más.',
      traza: () => Traza.abrir({ titulo: 'Ganancia de peso por animal', cols: [...colAnimal, { k: 'f0', l: 'Primer pesaje', fecha: 1 }, { k: 'p0', l: 'kg', num: 1 }, { k: 'f1', l: 'Último pesaje', fecha: 1 }, { k: 'p1', l: 'kg', num: 1 }, { k: 'dias', l: 'Días', num: 1 }, { k: 'gdp', l: 'GDP kg/d', num: 1, dec: 3 }],
        filas: G.map(x => ({ ...filaA(x.a), f0: x.p0.fecha, p0: x.p0.peso, f1: x.p1.fecha, p1: x.p1.peso, dias: x.dias, gdp: Math.round(x.gdp * 1000) / 1000 })), alClic: x => Ganado.abrir(x.id) }) });
    const kgProd = G.reduce((s, x) => s + x.kg, 0), kgProd0 = G0.reduce((s, x) => s + x.kg, 0);
    kpi({ g: 'Producción', id: 'kg', etq: 'Kilos producidos', val: kgProd, ant: kgProd0, fmt: x => U.num(x, 0), uni: 'kg', nat: 'calculado', nota: 'Suma de (último − primer pesaje) de los animales pesados dos veces en el periodo. No incluye animales sin pesajes.', traza: () => K.find(k => k.id === 'gdp').traza() });
    const pesados = f => { const xs = []; for (const a of uni) { const ps = D.pesajes(a.id).filter(p => An.enR(p.fecha, ...f)); if (ps.length) xs.push({ a, p: ps[ps.length - 1] }); } return xs; };
    const PP = pesados([F.d, F.h]), PP0 = pesados([pd, ph]);
    kpi({ g: 'Producción', id: 'peso', etq: 'Peso promedio (pesados)', val: media(PP.map(x => x.p.peso)), ant: media(PP0.map(x => x.p.peso)), fmt: x => U.num(x, 0), uni: 'kg', nat: 'medido', bueno: 'neutro', det: `${PP.length} animales pesados`, nota: 'Promedio del último pesaje de cada animal pesado en el periodo (depende de qué animales se pesaron).',
      traza: () => Traza.abrir({ titulo: 'Último pesaje del periodo por animal', cols: [...colAnimal, { k: 'f', l: 'Fecha', fecha: 1 }, { k: 'peso', l: 'Peso kg', num: 1 }], filas: PP.map(x => ({ ...filaA(x.a), f: x.p.fecha, peso: x.p.peso })), alClic: x => Ganado.abrir(x.id) }) });
    // ---------- reproducción y sanidad ----------
    const hemb = uni.filter(a => D.ACTIVO(a) && a.sexo === 'H' && a.fechaNacimiento && U.mesesEntre(U.aFecha(a.fechaNacimiento), new Date()) >= 24);
    const pren = hemb.filter(a => a.estadoReproductivo === 'Preñada');
    kpi({ g: 'Reproducción y sanidad', id: 'pren', etq: 'Hembras preñadas hoy', val: An.pct(pren.length, hemb.length), ant: null, fmt: x => U.num(x, 0), uni: '%', nat: 'registrado', det: `${pren.length} de ${hemb.length} hembras ≥ 24 meses`, nota: 'Estado reproductivo actual registrado (no depende del periodo).',
      traza: () => Traza.abrir({ titulo: 'Hembras ≥ 24 meses y estado reproductivo', cols: [...colAnimal, { k: 'rep', l: 'Estado reproductivo' }, { k: 'parto', l: 'Parto probable', fecha: 1 }], filas: hemb.map(a => ({ ...filaA(a), rep: a.estadoReproductivo || '—', parto: a.fechaProbableParto || '' })), alClic: x => Ganado.abrir(x.id) }) });
    const evS = (d, h) => DB.filtrar('eventos', e => An.SANIT.includes(e.tipo) && idsU.has(e.animalId) && An.enR(e.fecha, d, h));
    const ES = evS(F.d, F.h);
    kpi({ g: 'Reproducción y sanidad', id: 'san', etq: 'Eventos sanitarios', val: ES.length, ant: evS(pd, ph).length, fmt: x => U.num(x), uni: '', nat: 'registrado', bueno: 'neutro', det: An.SANIT.map(t => `${ES.filter(e => e.tipo === t).length} ${t.toLowerCase()}`).join(' · '), nota: 'Tratamientos, vacunaciones, desparasitaciones y enfermedades registradas.',
      traza: () => Traza.abrir({ titulo: 'Eventos sanitarios', cols: [{ k: 'fecha', l: 'Fecha', fecha: 1 }, { k: 'tipo', l: 'Tipo' }, { k: 'arete', l: 'Animal' }, { k: 'prod', l: 'Producto / detalle' }, { k: 'resp', l: 'Responsable' }], filas: ES.sort((a, b) => b.fecha.localeCompare(a.fecha)).map(e => ({ id: e.animalId, fecha: e.fecha, tipo: e.tipo, arete: DB.get('animales', e.animalId)?.arete || '?', prod: [e.producto, e.dosis, e.detalle].filter(Boolean).join(' · '), resp: e.responsable || '' })), alClic: x => Ganado.abrir(x.id, 'sanidad') }) });
    const venc = DB.filtrar('eventos', e => e.proximaFecha && !e.proximaHecha && e.proximaFecha < hoy && idsU.has(e.animalId) && D.ACTIVO(DB.get('animales', e.animalId) || {}));
    kpi({ g: 'Reproducción y sanidad', id: 'venc', etq: 'Aplicaciones vencidas hoy', val: venc.length, ant: null, fmt: x => U.num(x), uni: '', nat: 'registrado', bueno: 'baja', nota: 'Próximas aplicaciones con fecha pasada y no marcadas como hechas.',
      traza: () => Traza.abrir({ titulo: 'Aplicaciones sanitarias vencidas', cols: [{ k: 'f', l: 'Debía aplicarse', fecha: 1 }, { k: 'tipo', l: 'Tipo' }, { k: 'arete', l: 'Animal' }, { k: 'prod', l: 'Producto' }], filas: venc.map(e => ({ id: e.animalId, f: e.proximaFecha, tipo: e.tipo, arete: DB.get('animales', e.animalId)?.arete, prod: e.producto || e.detalle || '' })), alClic: x => Ganado.abrir(x.id, 'sanidad') }) });
    // ---------- potreros ----------
    const ocupHoy = lotesL.filter(l => D.animalesEnLote(l.id).length);
    const conAct = lotesL.filter(l => DB.de('ocupaciones', 'loteId', l.id).length || D.animalesEnLote(l.id).length);
    kpi({ g: 'Potreros y forraje', id: 'ocup', etq: 'Potreros ocupados hoy', val: ocupHoy.length, ant: null, fmt: x => U.num(x), uni: `de ${conAct.length}`, nat: 'registrado', bueno: 'neutro', nota: 'Lotes con animales hoy, sobre los lotes con actividad de pastoreo registrada.',
      traza: () => Traza.abrir({ titulo: 'Potreros con actividad', cols: [{ k: 'lote', l: 'Lote' }, { k: 'est', l: 'Estado' }, { k: 'n', l: 'Animales', num: 1 }, { k: 'dias', l: 'Días ocupación/descanso' }], filas: conAct.map(l => { const ip = D.infoPotrero(l); return { id: l.id, lote: D.nombreLote(l), est: ip.n ? 'Ocupado' : l.estado, n: ip.n, dias: ip.n ? `${ip.diasOcup ?? '—'} d ocupado` : ip.diasDesc != null ? `${ip.diasDesc} d descanso` : '—' }; }), alClic: x => Lote.abrir(x.id, 'potrero') }) });
    const ROT = An.rotaciones(lotesL); const rotP = ROT.filter(r => An.enR(r.o.salida, F.d, F.h)), rotP0 = ROT.filter(r => An.enR(r.o.salida, pd, ph));
    const descP = rotP.filter(r => r.desc != null && An.enR(r.sig.entrada, F.d, F.h)), descP0 = rotP0.filter(r => r.desc != null);
    const trazaRot = () => Traza.abrir({ titulo: 'Ocupaciones cerradas en el periodo y descanso posterior', nota: `Descanso mínimo configurado: ${D.param('descansoMin')} días`, cols: [{ k: 'lote', l: 'Lote' }, { k: 'ent', l: 'Entrada', fecha: 1 }, { k: 'sal', l: 'Salida', fecha: 1 }, { k: 'ocup', l: 'Días ocupación', num: 1 }, { k: 'desc', l: 'Descanso hasta nueva entrada (d)', num: 1 }],
      filas: rotP.map(r => ({ id: r.l.id, lote: D.nombreLote(r.l), ent: r.o.entrada, sal: r.o.salida, ocup: r.ocup, desc: r.desc })), alClic: x => Lote.abrir(x.id, 'potrero') });
    kpi({ g: 'Potreros y forraje', id: 'docup', etq: 'Ocupación promedio', val: media(rotP.map(r => r.ocup)), ant: media(rotP0.map(r => r.ocup)), fmt: x => U.num(x, 1), uni: 'días', nat: 'calculado', bueno: 'neutro', det: `${rotP.length} ocupaciones cerradas · máximo ${D.param('ocupacionMax')} d`, nota: 'Días entre entrada y salida de las ocupaciones que terminaron en el periodo.', traza: trazaRot });
    const okD = descP.filter(r => r.desc >= D.param('descansoMin')).length;
    kpi({ g: 'Potreros y forraje', id: 'desc', etq: 'Descanso real promedio', val: media(descP.map(r => r.desc)), ant: media(descP0.map(r => r.desc)), fmt: x => U.num(x, 0), uni: 'días', nat: 'calculado', bueno: 'neutro', det: descP.length ? `${U.num(okD / descP.length * 100, 0)} % cumplió el mínimo de ${D.param('descansoMin')} d` : 'sin reingresos en el periodo', nota: 'Días entre la salida del ganado y la siguiente entrada al mismo lote (indicador de recuperación de la pastura).', traza: trazaRot });
    const usoL = F.lote ? lotesL : DB.filtrar('lotes', l => DB.de('ocupaciones', 'loteId', l.id).some(o => !o.salida || o.salida >= U.sumarDias(hoy, -365)));
    const areaU = usoL.reduce((s, l) => s + (D.area(l) || 0), 0); const estA = usoL.some(l => !l.areaHa && l.areaEstHa);
    const pesoU = D.activos().filter(a => usoL.some(l => l.id === a.loteId)).reduce((s, a) => s + (a.pesoActual || 0), 0);
    kpi({ g: 'Potreros y forraje', id: 'carga', etq: 'Carga animal hoy', val: areaU ? pesoU / 450 / areaU : null, ant: null, fmt: x => U.num(x, 2), uni: 'UGG/ha', nat: estA ? 'estimado' : 'calculado', bueno: 'neutro', det: `${U.num(areaU, 1)} ha en uso${estA ? ' (incluye áreas estimadas del plano)' : ''}`, nota: 'Peso vivo de los animales en los lotes en uso ÷ 450 kg ÷ hectáreas de esos lotes. Con áreas estimadas del plano el valor es aproximado.',
      traza: () => Traza.abrir({ titulo: 'Lotes en uso para la carga animal', cols: [{ k: 'lote', l: 'Lote' }, { k: 'area', l: 'Área ha', num: 1 }, { k: 'tipoA', l: 'Tipo de área' }, { k: 'n', l: 'Animales', num: 1 }, { k: 'kg', l: 'Peso vivo kg', num: 1 }], filas: usoL.map(l => { const an = D.animalesEnLote(l.id); return { id: l.id, lote: D.nombreLote(l), area: D.area(l), tipoA: l.areaHa ? 'Registrada' : l.areaEstHa ? 'Estimada (plano)' : 'Sin área', n: an.length, kg: an.reduce((s, a) => s + (a.pesoActual || 0), 0) }; }), alClic: x => Lote.abrir(x.id, 'potrero') }) });
    const forr = lotesL.map(l => ({ l, e: Aforo.msEstimadaHoy(l.id) })).filter(x => x.e);
    const totF = forr.reduce((s, x) => s + Math.max(0, x.e.ms) * (D.area(x.l) || 0), 0);
    kpi({ g: 'Potreros y forraje', id: 'forr', etq: 'Forraje disponible estimado', val: totF / 1000, ant: null, fmt: x => U.num(x, 1), uni: 't MS', nat: 'estimado', bueno: 'neutro', det: `${forr.length} lotes con aforo`, nota: 'Último aforo (medido) + crecimiento estimado × días transcurridos, por el área del lote. Es una ESTIMACIÓN; repita el aforo para confirmarla.',
      traza: () => Traza.abrir({ titulo: 'Forraje estimado hoy por lote', cols: [{ k: 'lote', l: 'Lote' }, { k: 'f', l: 'Último aforo', fecha: 1 }, { k: 'med', l: 'kg MS/ha medidos', num: 1 }, { k: 'tasa', l: 'Crecimiento kg MS/ha/d', num: 1 }, { k: 'est', l: 'kg MS/ha estimados hoy', num: 1 }, { k: 'area', l: 'ha', num: 1 }],
        filas: forr.map(x => ({ id: x.l.id, lote: D.nombreLote(x.l), f: Aforo.ultimo(x.l.id)?.fecha, med: Math.round(x.e.r.msHa), tasa: x.e.r.tasa ? Math.round(x.e.r.tasa) : null, est: Math.round(x.e.ms), area: D.area(x.l) })), alClic: x => Lote.abrir(x.id, 'aforo') }) });
    const pdia = Lluvia.porDia(); const llu = (d, h) => Object.entries(pdia).filter(([f]) => An.enR(f, d, h));
    const L1 = llu(F.d, F.h);
    kpi({ g: 'Potreros y forraje', id: 'lluvia', etq: 'Lluvia del periodo', val: L1.reduce((s, [, v]) => s + v, 0), ant: llu(pd, ph).reduce((s, [, v]) => s + v, 0), fmt: x => U.num(x, 0), uni: 'mm', nat: 'medido', bueno: 'neutro', det: `${L1.filter(([, v]) => v > 0).length} días con lluvia`, nota: 'Suma de los totales diarios (promedio entre pluviómetros que midieron cada día).',
      traza: () => Traza.abrir({ titulo: 'Lluvia diaria del periodo', cols: [{ k: 'f', l: 'Fecha', fecha: 1 }, { k: 'mm', l: 'mm', num: 1, dec: 1 }], filas: L1.sort((a, b) => b[0].localeCompare(a[0])).map(([f, v]) => ({ f, mm: Math.round(v * 10) / 10 })) }) });
    // ---------- recursos ----------
    const crit = DB.todos('insumos').filter(i => D.estadoStock(i).some(([, n]) => n !== 'ok'));
    kpi({ g: 'Recursos y gestión', id: 'crit', etq: 'Inventarios críticos', val: crit.length, ant: null, fmt: x => U.num(x), uni: `de ${DB.todos('insumos').length}`, nat: 'registrado', bueno: 'baja', nota: 'Productos agotados, con stock bajo el mínimo, vencidos o próximos a vencer.',
      traza: () => Traza.abrir({ titulo: 'Inventarios críticos', cols: [{ k: 'n', l: 'Producto' }, { k: 'st', l: 'Stock', num: 1 }, { k: 'u', l: 'Unidad' }, { k: 'min', l: 'Mínimo', num: 1 }, { k: 'e', l: 'Estado' }], filas: crit.map(i => ({ id: i.id, n: i.nombre, st: D.stock(i.id), u: i.unidad, min: i.stockMin, e: D.estadoStock(i).map(x => x[0]).join(', ') })), alClic: x => Inv.abrir(x.id) }) });
    const proy = An.proyeccion().filter(x => x.dias <= 30);
    kpi({ g: 'Recursos y gestión', id: 'proy', etq: 'Agotamiento en ≤ 30 días', val: proy.length, ant: null, fmt: x => U.num(x), uni: 'productos', nat: 'proyeccion', bueno: 'baja', nota: 'Stock actual ÷ consumo diario promedio de los últimos 90 días. Supone que el consumo se mantiene.',
      traza: () => Traza.abrir({ titulo: 'Proyección de agotamiento de inventario', cols: [{ k: 'n', l: 'Producto' }, { k: 'st', l: 'Stock', num: 1 }, { k: 'u', l: 'Unidad' }, { k: 'tasa', l: 'Consumo/día (90 d)', num: 1, dec: 2 }, { k: 'dias', l: 'Días restantes', num: 1, dec: 0 }], filas: proy.map(x => ({ id: x.i.id, n: x.i.nombre, st: x.st, u: x.i.unidad, tasa: x.tasa, dias: x.dias })), alClic: x => Inv.abrir(x.id) }) });
    const tar = DB.filtrar('tareas', t => t.estado !== 'Completada' && (!F.lote || t.loteId === F.lote)); const tv = tar.filter(t => Tareas.estadoReal(t) === 'Vencida');
    kpi({ g: 'Recursos y gestión', id: 'tar', etq: 'Tareas pendientes', val: tar.length, ant: null, fmt: x => U.num(x), uni: '', nat: 'registrado', bueno: 'baja', det: `${tv.length} vencidas`, nota: 'Tareas no completadas (hoy).',
      traza: () => Traza.abrir({ titulo: 'Tareas pendientes', cols: [{ k: 't', l: 'Tarea' }, { k: 'v', l: 'Vence', fecha: 1 }, { k: 'e', l: 'Estado' }, { k: 'p', l: 'Prioridad' }, { k: 'r', l: 'Responsable' }], filas: tar.map(t => ({ id: t.id, t: t.titulo, v: t.vence || t.fecha, e: Tareas.estadoReal(t), p: t.prioridad, r: t.responsable || '' })), alClic: x => Tareas.abrir(x.id) }) });
    // ---------- economía ----------
    const ecoFiltro = c => F.lote ? c.loteId === F.lote : (F.cat || F.grupo || F.sexo) ? (c.animalId && idsU.has(c.animalId)) : true;
    const cd = D.costosDetalle().filter(ecoFiltro); const enP = (d, h) => cd.filter(c => An.enR(c.fecha, d, h));
    const C1 = enP(F.d, F.h), C0 = enP(pd, ph); const sum = (xs, k) => xs.reduce((s, c) => s + (c[k] || 0), 0);
    const notaEco = F.lote ? 'Solo costos e ingresos asignados al lote filtrado.' : filtrado(F) ? 'Solo costos e ingresos asignados a los animales filtrados.' : 'Toda la finca.';
    const trazaCostos = (titulo, xs) => () => Traza.abrir({ titulo, nota: notaEco, cols: [{ k: 'fecha', l: 'Fecha', fecha: 1 }, { k: 'categoria', l: 'Categoría' }, { k: 'origen', l: 'Origen' }, { k: 'nat', l: 'Naturaleza' }, { k: 'desc', l: 'Detalle' }, { k: 'monto', l: 'Costo', dinero: 1 }, { k: 'ingreso', l: 'Ingreso', dinero: 1 }], filas: xs.map(c => ({ ...c, nat: An.naturaleza(c) })) });
    kpi({ g: 'Economía', id: 'cos', etq: 'Costos del periodo', val: sum(C1, 'monto'), ant: sum(C0, 'monto'), fmt: U.dinero, uni: '', nat: 'calculado', bueno: 'baja', det: Object.values(An.NAT).map(n => `${n}: ${U.dinero(sum(C1.filter(c => An.naturaleza(c) === n), 'monto'))}`).join(' · '), nota: notaEco + ' Incluye costos registrados, consumo de inventario valorizado y estimaciones por precio de catálogo.', traza: trazaCostos('Costos del periodo', C1.filter(c => c.monto)) });
    kpi({ g: 'Economía', id: 'ing', etq: 'Ingresos del periodo', val: sum(C1, 'ingreso'), ant: sum(C0, 'ingreso'), fmt: U.dinero, uni: '', nat: 'registrado', nota: notaEco + ' Ventas de animales y registros de categoría «Venta».', traza: trazaCostos('Ingresos del periodo', C1.filter(c => c.ingreso)) });
    kpi({ g: 'Economía', id: 'mar', etq: 'Margen (ingresos − costos)', val: sum(C1, 'ingreso') - sum(C1, 'monto'), ant: sum(C0, 'ingreso') - sum(C0, 'monto'), fmt: U.dinero, uni: '', nat: 'calculado', pct: false, nota: notaEco, traza: trazaCostos('Costos e ingresos del periodo', C1) });
    kpi({ g: 'Economía', id: 'ckg', etq: 'Costo por kg producido', val: kgProd > 0 ? sum(C1, 'monto') / kgProd : null, ant: kgProd0 > 0 ? sum(C0, 'monto') / kgProd0 : null, fmt: U.dinero, uni: '/kg', nat: 'calculado', bueno: 'baja', nota: 'Costos del periodo ÷ kilos producidos (pesajes). Si muchos animales no se pesaron, el valor se sobreestima.', traza: () => K.find(k => k.id === 'gdp').traza() });
    // ---------- series mensuales ----------
    const ms = An.meses(F.d, F.h, 24); const finM = ym => { const f = An.finMes(ym); return f > F.h ? F.h : f; };
    const series = {
      etq: ms.map(An.etqMes),
      inventario: ms.map(ym => vivos(finM(ym) > hoy ? hoy : finM(ym)).length),
      entradas: ms.map(ym => E.filter(x => An.ingreso(x.a).startsWith(ym)).length),
      salidas: ms.map(ym => S.filter(x => x.a.fechaSalida.startsWith(ym)).length),
      peso: ms.map(ym => { const v = []; for (const a of uni) for (const p of D.pesajes(a.id)) if (p.fecha.startsWith(ym)) v.push(p.peso); return v.length ? Math.round(v.reduce((s, x) => s + x, 0) / v.length) : null; }),
      costos: ms.map(ym => Math.round(sum(C1.filter(c => String(c.fecha).startsWith(ym)), 'monto'))),
      ingresos: ms.map(ym => Math.round(sum(C1.filter(c => String(c.fecha).startsWith(ym)), 'ingreso'))),
      lluvia: ms.map(ym => Math.round(L1.filter(([f]) => f.startsWith(ym)).reduce((s, [, v]) => s + v, 0))),
    };
    const porCat = {}; for (const c of C1) if (c.monto) porCat[c.categoria] = (porCat[c.categoria] || 0) + c.monto;
    return { K, series, porCat, F, pd, ph, uni };
  }
  // ---------- presentación ----------
  function delta(k) {
    const { val, ant } = k;
    if (val == null || ant == null || isNaN(val) || isNaN(ant)) return '<span class="bi-delta">sin comparación</span>';
    const d = val - ant; if (Math.abs(d) < 1e-9) return `<span class="bi-delta" title="Periodo anterior: ${U.esc(k.fmt(ant))}">= igual</span>`;
    const dir = d > 0 ? 'sube' : 'baja'; const bueno = k.bueno || 'sube'; const cls = bueno === 'neutro' ? '' : (dir === bueno ? 'bien' : 'mal');
    const txt = k.pct !== false && ant ? `${d > 0 ? '+' : '−'}${U.num(Math.abs(d / ant * 100), 0)} %` : `${d > 0 ? '+' : '−'}${k.fmt(Math.abs(d))}`;
    return `<span class="bi-delta ${cls}" title="Periodo anterior: ${U.esc(k.fmt(ant))}">${d > 0 ? '▲' : '▼'} ${txt}</span>`;
  }
  const valTxt = k => k.val == null || (typeof k.val === 'number' && isNaN(k.val)) ? '—' : k.fmt(k.val);
  function multi(etqs, series, { tipo = 'bar', fmt = v => U.num(v), apilado = false, etiqueta = '' } = {}) {
    if (!etqs.length) return '<div class="vacio">Sin datos</div>';
    return Graf.lienzo(t => ({ type: tipo, data: { labels: etqs, datasets: series.map((s, i) => ({ label: s.l, data: s.v, borderColor: t.pal[s.c ?? i], backgroundColor: tipo === 'line' ? t.pal[s.c ?? i] : t.pal[s.c ?? i], spanGaps: true, pointRadius: 3, maxBarThickness: 26, borderSkipped: 'start' })) },
      options: { scales: Graf.ejes(t, { fmtY: fmt, apilado }), plugins: { legend: Graf.leyenda(t, series.length > 1), tooltip: Graf.tooltip(t, fmt) } } }),
      { etiqueta, tabla: Graf.tablaDatos(etqs, series.map(s => ({ l: s.l, v: s.v })), x => x == null ? '—' : fmt(x)) });
  }
  function vista(c) {
    let F = filtrosIniciales();
    const grupos = [...new Set(DB.todos('animales').map(a => a.grupo).filter(Boolean))].sort();
    const v = U.h(`<div class="vista"><div class="vista-cabecera"><h2>Indicadores y análisis</h2><button class="btn" data-x>⬇️ Exportar tabla CSV</button><button class="btn" data-pdf>🖨️ Imprimir</button></div>
      <div class="filtros bi-filtros">
        <label>Desde<input class="input" type="date" data-f="d"></label><label>Hasta<input class="input" type="date" data-f="h"></label>
        <label>Rápido<select class="input" data-f="rap"><option value="">—</option><option value="30">Últimos 30 días</option><option value="90">Últimos 90 días</option><option value="365">Últimos 12 meses</option><option value="anio">Año actual</option><option value="anioAnt">Año anterior</option></select></label>
        <label>Lote<select class="input" data-f="lote"><option value="">Todos</option>${D.lotes().filter(l => l.tipo === 'lote' || DB.de('ocupaciones', 'loteId', l.id).length).map(l => `<option value="${U.esc(l.id)}">${U.esc(D.nombreLote(l))}</option>`).join('')}</select></label>
        <label>Categoría<select class="input" data-f="cat"><option value="">Todas</option>${D.CATEGORIAS.map(x => `<option>${x}</option>`).join('')}</select></label>
        <label>Grupo<select class="input" data-f="grupo"><option value="">Todos</option>${grupos.map(x => `<option>${U.esc(x)}</option>`).join('')}</select></label>
        <label>Sexo<select class="input" data-f="sexo"><option value="">Ambos</option><option value="H">Hembras</option><option value="M">Machos</option></select></label>
        <button class="btn peq" data-limpiar>Limpiar filtros</button></div><div id="bi-res"></div></div>`);
    c.appendChild(v);
    const $f = k => U.$(`[data-f="${k}"]`, v);
    for (const k of ['d', 'h', 'lote', 'cat', 'grupo', 'sexo']) $f(k).value = F[k] || '';
    let X = null;
    const pintar = () => {
      const t0 = performance.now();
      if (F.d > F.h) { U.$('#bi-res', v).innerHTML = '<div class="aviso-error">La fecha inicial es posterior a la final.</div>'; return; }
      X = calcular(F); const S = X.series;
      const grupos = [...new Set(X.K.map(k => k.g))];
      const hayDemo = DB.todos('animales').some(a => a.demo);
      const tarj = k => { const [nt, nc] = NATTAG[k.nat] || ['', '']; return `<button class="bi-kpi" data-k="${k.id}" title="${U.esc(k.nota)}"><span class="bi-etq">${U.esc(k.etq)}</span><span class="bi-val">${valTxt(k)}<small>${U.esc(k.uni || '')}</small></span>${k.det ? `<span class="bi-det">${U.esc(k.det)}</span>` : ''}<span class="bi-pie">${delta(k)}<span class="tag ${nc}">${nt}</span></span></button>`; };
      const cats = Object.entries(X.porCat).sort((a, b) => b[1] - a[1]);
      U.$('#bi-res', v).innerHTML = `${hayDemo ? '<div class="aviso-demo">Incluye DATOS DE DEMOSTRACIÓN.</div>' : ''}
        <p class="sub">Periodo <b>${U.fecha(F.d)} – ${U.fecha(F.h)}</b> (${U.dias(F.d, F.h) + 1} días) comparado con <b>${U.fecha(X.pd)} – ${U.fecha(X.ph)}</b>. ${filtrado(F) ? `Filtros activos: ${X.uni.length} animales en el universo analizado.` : 'Sin filtros: toda la finca.'} Toque un indicador para ver los registros que lo originan.
        <br><span class="tag ok">Medido</span> dato tomado en campo · <span class="tag info">Registrado</span> movimiento o estado registrado · <span class="tag info">Calculado</span> fórmula sobre registros · <span class="tag warn">Estimado / Proyección</span> aproximación, no es una medición.</p>
        ${grupos.map(g => `<h3 class="bi-grupo">${U.esc(g)}</h3><div class="bi-rejilla">${X.K.filter(k => k.g === g).map(tarj).join('')}</div>`).join('')}
        <div class="rejilla-2" style="margin-top:1rem">
          <div class="panel"><h3>Inventario al cierre de cada mes</h3>${multi(S.etq, [{ l: 'Animales', v: S.inventario }], { etiqueta: 'Inventario mensual' })}</div>
          <div class="panel"><h3>Entradas y salidas por mes</h3>${multi(S.etq, [{ l: 'Entradas', v: S.entradas, c: 2 }, { l: 'Salidas', v: S.salidas, c: 1 }], { etiqueta: 'Entradas y salidas' })}</div>
          <div class="panel"><h3>Peso promedio de los pesajes del mes (kg)</h3>${S.peso.filter(x => x != null).length >= 2 ? multi(S.etq, [{ l: 'Peso promedio', v: S.peso }], { tipo: 'line', etiqueta: 'Peso promedio' }) : '<div class="vacio">Se necesitan pesajes en al menos dos meses.</div>'}</div>
          <div class="panel"><h3>Costos e ingresos por mes</h3>${multi(S.etq, [{ l: 'Ingresos', v: S.ingresos, c: 2 }, { l: 'Costos', v: S.costos, c: 1 }], { fmt: U.dinero, etiqueta: 'Costos e ingresos' })}</div>
          <div class="panel"><h3>Gastos por categoría</h3>${cats.length ? Graf.barrasH(cats.map(([l, x]) => ({ l, v: Math.round(x) })), { fmt: U.dinero }) : '<div class="vacio">Sin costos en el periodo.</div>'}</div>
          <div class="panel"><h3>Lluvia por mes (mm)</h3>${multi(S.etq, [{ l: 'Lluvia', v: S.lluvia }], { etiqueta: 'Lluvia mensual' })}</div>
        </div>
        <div class="panel"><h3>Comparación con el periodo anterior</h3>${U.tabla([{ k: 'g', l: 'Grupo' }, { k: 'etq', l: 'Indicador' }, { k: 'a', l: 'Periodo actual', num: 1, f: k => U.esc(valTxt(k)) + ' ' + U.esc(k.uni || '') }, { k: 'b', l: 'Periodo anterior', num: 1, f: k => k.ant == null ? '—' : U.esc(k.fmt(k.ant)) }, { k: 'c', l: 'Variación', f: delta }, { k: 'n', l: 'Cómo se calcula', f: k => `<small>${U.esc(k.nota)}</small>` }], X.K)}</div>
        <p class="sub">Calculado en ${U.num(performance.now() - t0, 0)} ms sobre los registros del dispositivo.</p>`;
    };
    v.addEventListener('change', e => {
      const k = e.target.dataset.f; if (!k) return;
      if (k === 'rap') { const r = e.target.value, h = U.hoyISO(), y = h.slice(0, 4); if (r === 'anio') { F.d = y + '-01-01'; F.h = h; } else if (r === 'anioAnt') { F.d = (y - 1) + '-01-01'; F.h = (y - 1) + '-12-31'; } else if (r) { F.d = U.sumarDias(h, -(+r - 1)); F.h = h; } $f('d').value = F.d; $f('h').value = F.h; e.target.value = ''; }
      else F[k] = e.target.value;
      if (!F.d) F.d = U.sumarDias(U.hoyISO(), -364); if (!F.h) F.h = U.hoyISO();
      try { localStorage.setItem(CLAVE, JSON.stringify(F)); } catch (x) { }
      pintar();
    });
    v.addEventListener('click', e => {
      const b = e.target.closest('[data-k]'); if (b && X) { const k = X.K.find(x => x.id === b.dataset.k); k && k.traza && k.traza(); return; }
      if (e.target.closest('[data-limpiar]')) { F = { d: U.sumarDias(U.hoyISO(), -364), h: U.hoyISO(), lote: '', cat: '', grupo: '', sexo: '' }; for (const k of ['d', 'h', 'lote', 'cat', 'grupo', 'sexo']) $f(k).value = F[k]; try { localStorage.removeItem(CLAVE); } catch (x) { } pintar(); }
      if (e.target.closest('[data-x]') && X) { try { Auth.exigir('exportar'); } catch (ex) { return U.toast(ex.message, 'error'); } U.descargar(`indicadores_${F.d}_${F.h}.csv`, U.csv([{ k: 'g', l: 'Grupo' }, { k: 'etq', l: 'Indicador' }, { k: 'a', l: 'Periodo actual' }, { k: 'u', l: 'Unidad' }, { k: 'b', l: 'Periodo anterior' }, { k: 'n', l: 'Naturaleza' }, { k: 'nota', l: 'Cálculo' }], X.K.map(k => ({ g: k.g, etq: k.etq, a: valTxt(k), u: k.uni, b: k.ant == null ? '' : k.fmt(k.ant), n: (NATTAG[k.nat] || [''])[0], nota: k.nota }))), 'text/csv;charset=utf-8'); }
      if (e.target.closest('[data-pdf]') && X) Reportes.imprimir({ titulo: 'Indicadores y análisis', periodo: `Periodo: ${U.fecha(F.d)} a ${U.fecha(F.h)}${filtrado(F) ? ' · con filtros' : ''}`, cols: [{ k: 'g', l: 'Grupo' }, { k: 'etq', l: 'Indicador' }, { k: 'a', l: 'Actual' }, { k: 'b', l: 'Anterior' }, { k: 'n', l: 'Naturaleza' }], filas: X.K.map(k => ({ g: k.g, etq: k.etq, a: valTxt(k) + ' ' + (k.uni || ''), b: k.ant == null ? '—' : k.fmt(k.ant), n: (NATTAG[k.nat] || [''])[0] })) });
    });
    pintar(); v.refrescar = pintar;
  }
  return { calcular, vista, universo };
})();

// =====================================================================================================
// Fin: flujo de caja, costos fijos/variables, rentabilidad, comparación de periodos y posibles duplicados.
// =====================================================================================================
const Fin = (() => {
  const CLASES_DEF = { 'Mano de obra': 'Fijo', 'Servicios': 'Fijo', 'Mantenimiento': 'Fijo', 'Combustible': 'Variable', 'Alimentación': 'Variable', 'Medicamentos': 'Variable', 'Fertilizantes': 'Variable',
    'Agroquímicos': 'Variable', 'Compra de animales': 'Variable', 'Cultivos (costos directos)': 'Variable', 'Otros': 'Variable' };
  const clases = () => ({ ...CLASES_DEF, ...((DB.get('config', 'clasesCosto') || {}).mapa || {}) });
  const claseDe = cat => clases()[cat] || 'Variable';
  /** Compras de inventario valorizadas (entradas × valor unitario ACTUAL del producto; aproximación). */
  const comprasInv = (d, h) => DB.filtrar('movinv', m => m.tipo === 'Entrada' && An.enR(m.fecha, d, h)).map(m => { const i = DB.get('insumos', m.insumoId); return { m, i, valor: i && i.valorUnitario ? m.cantidad * i.valorUnitario : 0 }; }).filter(x => x.valor);
  function calcular(d, h, lote = '') {
    const cd = D.costosDetalle().filter(c => An.enR(c.fecha, d, h) && (!lote || c.loteId === lote));
    const ms = An.meses(d, h, 36); const sum = (xs, k) => xs.reduce((s, c) => s + (c[k] || 0), 0);
    const ci = lote ? [] : comprasInv(d, h);
    let acum = 0;
    const flujo = ms.map(ym => {
      const xs = cd.filter(c => String(c.fecha).startsWith(ym));
      const ingresos = sum(xs, 'ingreso'), reg = sum(xs.filter(c => An.naturaleza(c) === An.NAT.reg), 'monto'), der = sum(xs.filter(c => An.naturaleza(c) === An.NAT.der), 'monto'), est = sum(xs.filter(c => An.naturaleza(c) === An.NAT.est), 'monto');
      const compras = ci.filter(x => x.m.fecha.startsWith(ym)).reduce((s, x) => s + x.valor, 0);
      const neto = ingresos - reg - compras; acum += neto;
      return { ym, mes: An.etqMes(ym), ingresos, reg, der, est, costos: reg + der + est, compras, neto, acum };
    });
    const tot = { ingresos: sum(cd, 'ingreso'), costos: sum(cd, 'monto') };
    const porCat = {}; for (const c of cd) if (c.monto) porCat[c.categoria] = (porCat[c.categoria] || 0) + c.monto;
    tot.fijos = Object.entries(porCat).filter(([k]) => claseDe(k) === 'Fijo').reduce((s, [, v]) => s + v, 0);
    tot.variables = tot.costos - tot.fijos;
    tot.contribucion = tot.ingresos - tot.variables; tot.resultado = tot.ingresos - tot.costos;
    tot.margenPct = tot.ingresos ? tot.resultado / tot.ingresos * 100 : null;
    tot.equilibrio = tot.ingresos > tot.variables && tot.ingresos ? tot.fijos / (1 - tot.variables / tot.ingresos) : null;
    return { cd, flujo, tot, porCat, ci };
  }
  function duplicados(d, h) {
    const sanit = DB.filtrar('eventos', e => An.SANIT.includes(e.tipo) && e.costo > 0 && e.insumoId && e.cantidad > 0 && An.enR(e.fecha, d, h)).map(e => { const i = DB.get('insumos', e.insumoId); return { tipo: 'Costo sanitario + consumo de inventario', fecha: e.fecha, desc: `${e.tipo} · ${DB.get('animales', e.animalId)?.arete || '?'} · costo del evento ${U.dinero(e.costo)} y ${e.cantidad} ${i?.unidad || ''} de ${i?.nombre || '?'} (${U.dinero(e.cantidad * (i?.valorUnitario || 0))})`, ir: () => Ganado.abrir(e.animalId, 'sanidad') }; });
    const g = {}; for (const c of DB.filtrar('costos', c => An.enR(c.fecha, d, h))) { const k = [c.fecha, c.categoria, c.monto, c.loteId || '', c.animalId || ''].join('|'); (g[k] = g[k] || []).push(c); }
    const reps = Object.values(g).filter(x => x.length > 1).map(x => ({ tipo: 'Registros de costo idénticos', fecha: x[0].fecha, desc: `${x.length} registros de ${x[0].categoria} por ${U.dinero(x[0].monto)} el mismo día${x[0].descripcion ? ' · ' + x[0].descripcion : ''}`, ir: () => App.ir('costos') }));
    return [...sanit, ...reps];
  }
  function vista(c) {
    const anio = new Date().getFullYear();
    const v = U.h(`<div class="vista"><div class="vista-cabecera"><h2>Flujo de caja y rentabilidad</h2><button class="btn" data-clases>⚙️ Costos fijos / variables</button><button class="btn" data-csv>📄 CSV del flujo</button></div>
      <div class="filtros bi-filtros"><label>Desde<input class="input" type="date" data-f="d" value="${anio}-01-01"></label><label>Hasta<input class="input" type="date" data-f="h" value="${U.hoyISO()}"></label>
      <label>Lote<select class="input" data-f="lote"><option value="">Toda la finca</option>${D.lotes().map(l => `<option value="${U.esc(l.id)}">${U.esc(D.nombreLote(l))}</option>`).join('')}</select></label></div><div id="fin-res"></div></div>`);
    c.appendChild(v);
    const val = k => U.$(`[data-f="${k}"]`, v).value;
    let X = null;
    const pintar = () => {
      const d = val('d') || `${anio}-01-01`, h = val('h') || U.hoyISO(), lote = val('lote'); if (d > h) { U.$('#fin-res', v).innerHTML = '<div class="aviso-error">Rango de fechas no válido.</div>'; return; }
      X = calcular(d, h, lote); const T = X.tot; const len = U.dias(d, h) + 1; const A = calcular(U.sumarDias(d, -len), U.sumarDias(d, -1), lote);
      const dup = lote ? [] : duplicados(d, h);
      const tj = (t, val, sub, cls = '') => `<div class="tarjeta" style="cursor:default"><div class="t-valor ${cls}">${val}</div><div class="t-etq">${t}</div>${sub ? `<div class="sub" style="font-size:.75rem">${sub}</div>` : ''}</div>`;
      const cats = [...new Set([...Object.keys(X.porCat), ...Object.keys(A.porCat)])].sort((a, b) => (X.porCat[b] || 0) - (X.porCat[a] || 0));
      U.$('#fin-res', v).innerHTML = `${X.cd.some(x => x.demo) ? '<div class="aviso-demo">Incluye DATOS DE DEMOSTRACIÓN.</div>' : ''}
        <div class="tarjetas">${tj('Ingresos', U.dinero(T.ingresos))}${tj('Costos totales', U.dinero(T.costos), `Fijos ${U.dinero(T.fijos)} · variables ${U.dinero(T.variables)}`)}${tj('Margen de contribución', U.dinero(T.contribucion), 'Ingresos − costos variables', T.contribucion < 0 ? 'neg' : '')}${tj('Resultado operativo', U.dinero(T.resultado), T.margenPct == null ? 'sin ingresos' : `Margen ${U.num(T.margenPct, 1)} %`, T.resultado < 0 ? 'neg' : '')}</div>
        <p class="sub">Punto de equilibrio del periodo: ${T.equilibrio == null ? '— (los ingresos no cubren los costos variables o no hay ingresos)' : `<b>${U.dinero(T.equilibrio)}</b> de ingresos (costos fijos ÷ (1 − costos variables ÷ ingresos))`}. Clasificación fijo/variable editable con «⚙️».</p>
        <div class="panel"><h3>Flujo de caja mensual ${lote ? '— ' + U.esc(D.nombreLoteId(lote)) : ''}</h3>
          <p class="sub"><b>Flujo de caja (aprox.)</b> = ingresos − costos registrados − compras de inventario. Las compras de inventario se valorizan con el valor unitario <b>actual</b> del producto (estimado). El consumo de inventario y las estimaciones por precio de catálogo son costos (devengados) pero no salidas de caja, por eso se muestran aparte y no se restan dos veces.${lote ? ' Con filtro de lote no se incluyen compras de inventario.' : ''}</p>
          ${U.tabla([{ k: 'mes', l: 'Mes' }, { k: 'ingresos', l: 'Ingresos', num: 1, f: x => U.dinero(x.ingresos) }, { k: 'reg', l: 'Costos registrados', num: 1, f: x => U.dinero(x.reg) }, { k: 'compras', l: 'Compras inventario (est.)', num: 1, f: x => U.dinero(x.compras) },
            { k: 'neto', l: 'Flujo neto', num: 1, f: x => `<b class="${x.neto < 0 ? 'neg' : ''}">${U.dinero(x.neto)}</b>` }, { k: 'acum', l: 'Acumulado', num: 1, f: x => `<span class="${x.acum < 0 ? 'neg' : ''}">${U.dinero(x.acum)}</span>` }, { k: 'der', l: 'Consumo inventario (costo)', num: 1, f: x => U.dinero(x.der) }, { k: 'est', l: 'Estimados', num: 1, f: x => U.dinero(x.est) }], X.flujo, { onClic: x => trazaMes(x.ym) })}
        </div>
        <div class="rejilla-2"><div class="panel"><h3>Flujo neto mensual</h3>${Graf.columnas(X.flujo.map(x => ({ l: x.mes, v: Math.round(x.neto), c: x.neto < 0 ? '#c2352b' : '#2f9a5f' })), { fmt: v => U.num(v / 1e6, 1) + ' M', nombre: 'Flujo neto' })}</div>
          <div class="panel"><h3>Costos por clase</h3>${Graf.dona([{ l: 'Fijos', v: Math.round(T.fijos), c: '#1f6fb2' }, { l: 'Variables', v: Math.round(T.variables), c: '#c77700' }], { fmt: U.dinero, sub: 'costos' })}</div></div>
        <div class="panel"><h3>Comparación por categoría con el periodo anterior</h3><p class="sub">Periodo anterior: ${U.fecha(U.sumarDias(d, -len))} – ${U.fecha(U.sumarDias(d, -1))}.</p>
          ${U.tabla([{ k: 'c', l: 'Categoría', f: x => U.esc(x.c) }, { k: 'cl', l: 'Clase', f: x => U.esc(claseDe(x.c)) }, { k: 'a', l: 'Actual', num: 1, f: x => U.dinero(x.a) }, { k: 'b', l: 'Anterior', num: 1, f: x => U.dinero(x.b) },
            { k: 'v', l: 'Variación', num: 1, f: x => x.b ? `${x.a >= x.b ? '+' : '−'}${U.num(Math.abs((x.a - x.b) / x.b * 100), 0)} %` : x.a ? 'nuevo' : '—' }], cats.map(k => ({ c: k, a: X.porCat[k] || 0, b: A.porCat[k] || 0 })), { onClic: x => trazaCat(x.c) })}</div>
        <div class="panel"><h3>Posibles duplicados contables (${dup.length})</h3><p class="sub">Revisión automática: no se modifica ningún registro. Un evento sanitario con «costo del evento» y además producto descontado del inventario puede contar dos veces el medicamento si el costo incluía el producto.</p>
          ${dup.length ? `<div class="lista">${dup.map((x, i) => `<button class="item" data-dup="${i}"><span class="av">⚠️</span><span class="cuerpo"><b>${U.esc(x.tipo)}</b><small>${U.fecha(x.fecha)} · ${U.esc(x.desc)}</small></span>›</button>`).join('')}</div>` : '<div class="vacio">Sin posibles duplicados en el periodo. ✅</div>'}</div>`;
      U.$('#fin-res', v).onclick = e => { const b = e.target.closest('[data-dup]'); if (b) dup[+b.dataset.dup].ir(); };
    };
    const colsC = [{ k: 'fecha', l: 'Fecha', fecha: 1 }, { k: 'categoria', l: 'Categoría' }, { k: 'origen', l: 'Origen' }, { k: 'nat', l: 'Naturaleza' }, { k: 'desc', l: 'Detalle' }, { k: 'monto', l: 'Costo', dinero: 1 }, { k: 'ingreso', l: 'Ingreso', dinero: 1 }];
    const trazaMes = ym => Traza.abrir({ titulo: 'Movimientos de ' + An.etqMes(ym), cols: colsC, filas: X.cd.filter(c => String(c.fecha).startsWith(ym)).map(c => ({ ...c, nat: An.naturaleza(c) })) });
    const trazaCat = cat => Traza.abrir({ titulo: 'Costos: ' + cat, cols: colsC, filas: X.cd.filter(c => c.categoria === cat && c.monto).map(c => ({ ...c, nat: An.naturaleza(c) })) });
    v.addEventListener('change', e => { if (e.target.dataset.f) pintar(); });
    U.$('[data-clases]', v).onclick = editarClases;
    U.$('[data-csv]', v).onclick = () => { try { Auth.exigir('exportar'); } catch (e) { return U.toast(e.message, 'error'); } U.descargar(`flujo_caja_${val('d')}_${val('h')}.csv`, U.csv([{ k: 'mes', l: 'Mes' }, { k: 'ingresos', l: 'Ingresos' }, { k: 'reg', l: 'Costos registrados' }, { k: 'compras', l: 'Compras de inventario (estimado)' }, { k: 'neto', l: 'Flujo neto' }, { k: 'acum', l: 'Acumulado' }, { k: 'der', l: 'Consumo de inventario (costo)' }, { k: 'est', l: 'Costos estimados' }], X.flujo.map(x => ({ ...x, ingresos: Math.round(x.ingresos), reg: Math.round(x.reg), compras: Math.round(x.compras), neto: Math.round(x.neto), acum: Math.round(x.acum), der: Math.round(x.der), est: Math.round(x.est) }))), 'text/csv;charset=utf-8'); };
    pintar(); v.refrescar = pintar;
  }
  function editarClases() {
    if (!Auth.puede('costos')) return U.toast('Su rol no permite configurar costos.', 'error');
    const cl = clases(); const cats = [...new Set([...D.CAT_COSTO.filter(c => c !== 'Venta'), ...Object.keys(cl), ...D.costosDetalle().map(c => c.categoria).filter(c => c !== 'Venta')])];
    U.formModal({ titulo: '⚙️ Clasificación de costos', campos: cats.map((c, i) => ({ k: 'c' + i, l: c, t: 'select', op: ['Fijo', 'Variable'], vacio: false, v: cl[c] || 'Variable' })),
      aviso: '<p class="sub">Fijos: no cambian con el volumen producido (jornales permanentes, servicios). Variables: crecen con la producción (alimento, medicamentos, fertilizantes). Ajuste según su finca.</p>',
      onGuardar: async v => { const mapa = {}; cats.forEach((c, i) => mapa[c] = v['c' + i]); await DB.put('config', { id: 'clasesCosto', mapa }, { accion: 'Configuración', desc: 'Clasificación de costos fijos/variables' }); U.toast('Clasificación guardada', 'ok'); } });
  }
  return { calcular, duplicados, vista, clases, claseDe, comprasInv };
})();

// =====================================================================================================
// AlertasCfg: tipos activables, parámetros, posponer/reactivar, fecha de detección y vista mejorada.
// Alertas6: alertas nuevas derivadas de datos existentes (agotamiento, pesaje, gasto atípico).
// =====================================================================================================
const AlertasCfg = (() => {
  const TIPOS = ['Animal enfermo', 'Animal en cuarentena', 'Próximo a parto', 'Animal sin movimiento', 'Animal sin lote', 'Vacuna pendiente', 'Tratamiento pendiente', 'Agotado', 'Stock bajo', 'Vencido', 'Próximo a vencer',
    'Equipo fuera de servicio', 'Mantenimiento próximo', 'Revisión próxima', 'Tarea vencida', 'Ganado lleva demasiado tiempo en el lote', 'Salida programada vencida', 'Lote listo', 'Lote próximo a estar disponible',
    'Lote actualmente ocupado', 'Tiempo de descanso insuficiente', 'Respaldo pendiente', 'Fertilización programada', 'Ganado en lote con restricción', 'Forraje estimado agotado', 'Recalibrar aforo',
    'Riesgo de agotamiento', 'Animales sin pesaje', 'Gasto atípico'];
  const NUEVAS = ['Riesgo de agotamiento', 'Animales sin pesaje', 'Gasto atípico'];
  const P_DEF = { diasProyeccion: 15, diasSinPesaje: 120, factorGasto: 1.5 };
  const cfg = () => { const c = DB.get('config', 'alertasConfig') || {}; return { desactivadas: c.desactivadas || [], p: { ...P_DEF, ...(c.p || {}) } }; };
  const estados = () => (DB.get('config', 'alertasEstado') || {}).mapa || {};
  const clave = a => [a.tipo, a.ir?.t || '', a.ir?.id || a.ir?.ruta || '', a.ir?.animal || ''].join('|');
  function aplicar(lista) { const c = cfg(), es = estados(), hoy = U.hoyISO(), des = new Set(c.desactivadas); return lista.filter(a => !des.has(a.tipo) && !(es[clave(a)] && es[clave(a)].hasta > hoy)); }
  function primeraVez(lista) { let m = {}; try { m = JSON.parse(localStorage.getItem('siaf_alertas_detectadas') || '{}') || {}; } catch (e) { } const hoy = U.hoyISO(); let cambio = false; const vivas = new Set(); for (const a of lista) { const k = clave(a); vivas.add(k); if (!m[k]) { m[k] = hoy; cambio = true; } } for (const k of Object.keys(m)) if (!vivas.has(k)) { delete m[k]; cambio = true; } if (cambio) try { localStorage.setItem('siaf_alertas_detectadas', JSON.stringify(m)); } catch (e) { } return m; }
  async function posponer(a, dias) {
    if (!Auth.puede('tarea')) return U.toast('Su rol no permite gestionar alertas.', 'error');
    const hoy = U.hoyISO(); const mapa = Object.fromEntries(Object.entries(estados()).filter(([, x]) => x.hasta > hoy));
    mapa[clave(a)] = { hasta: U.sumarDias(hoy, dias), por: Auth.actual?.nombre, fecha: U.ahoraISO(), titulo: U.textoPlano(a.titulo) };
    await DB.put('config', { id: 'alertasEstado', mapa }, { accion: 'Alertas', desc: `Alerta pospuesta ${dias} día(s): ${U.textoPlano(a.titulo)}` }); U.toast(`Alerta pospuesta hasta el ${U.fecha(mapa[clave(a)].hasta)}`, 'ok');
  }
  async function reactivar(k) { const mapa = { ...estados() }; const t = mapa[k]?.titulo; delete mapa[k]; await DB.put('config', { id: 'alertasEstado', mapa }, { accion: 'Alertas', desc: 'Alerta reactivada: ' + (t || k) }); }
  function vista(c) {
    const v = U.h(`<div class="vista"><div class="vista-cabecera"><h2>Centro de alertas</h2><span class="sub">Calculadas automáticamente a partir de los registros · configurables en Configuración → Alertas</span></div><div class="filtros" id="al-f"></div><div id="al-l"></div></div>`); c.appendChild(v);
    let filtro = '', nivel = '', lista = [], verPosp = false, limite = 200;
    const NIV = { alta: ['Alta', 'peligro'], media: ['Media', 'warn'], baja: ['Baja', 'info'] };
    const pintar = () => {
      const todas = D.alertas(); const det = primeraVez(D.alertasTodas()); const es = estados(); const hoy = U.hoyISO();
      const posp = D.alertasTodas().filter(a => es[clave(a)] && es[clave(a)].hasta > hoy);
      const tipos = {}; for (const a of todas) tipos[a.tipo] = (tipos[a.tipo] || 0) + 1;
      U.$('#al-f', v).innerHTML = `<button class="capa-btn ${!filtro && !verPosp ? 'activo' : ''}" data-t="">Todas (${todas.length})</button>${['alta', 'media', 'baja'].map(n => `<button class="capa-btn ${nivel === n ? 'activo' : ''}" data-n="${n}">${NIV[n][0]} (${todas.filter(a => a.nivel === n).length})</button>`).join('')}<button class="capa-btn ${verPosp ? 'activo' : ''}" data-posp>Pospuestas (${posp.length})</button>`
        + Object.entries(tipos).map(([t, n]) => `<button class="capa-btn ${filtro === t ? 'activo' : ''}" data-t="${U.esc(t)}">${U.esc(t)} (${n})</button>`).join('');
      lista = verPosp ? posp : todas.filter(a => (!filtro || a.tipo === filtro) && (!nivel || a.nivel === nivel));
      U.$('#al-l', v).innerHTML = lista.length ? `<div class="lista">${lista.slice(0, limite).map((a, i) => { const k = clave(a); const p = es[k]; return `<div class="alerta ${a.nivel}"><span class="ico">${a.ico}</span><div style="flex:1;min-width:0"><b>${U.esc(a.titulo)}</b>
        <small>Motivo: ${U.esc(a.detalle || a.tipo)}</small><small>${U.esc(a.tipo)} · prioridad <span class="tag ${NIV[a.nivel][1]}">${NIV[a.nivel][0]}</span> · detectada ${U.fecha(det[k])}${p && p.hasta > hoy ? ` · <span class="tag">pospuesta hasta ${U.fecha(p.hasta)} por ${U.esc(p.por || '—')}</span>` : ' · <span class="tag ok">activa</span>'}</small>
        <div class="acciones" style="margin-top:.35rem">${a.ir && a.ir.t ? `<button class="btn peq" data-ir="${i}">Ver registro relacionado</button>` : ''}${p && p.hasta > hoy ? `<button class="btn peq" data-re="${i}">Reactivar</button>` : `<button class="btn peq" data-p="${i}:1">Posponer 1 d</button><button class="btn peq" data-p="${i}:7">7 d</button><button class="btn peq" data-p="${i}:30">30 d</button>`}</div></div></div>`; }).join('')}</div>${lista.length > limite ? `<div class="acciones" style="justify-content:center;margin-top:.6rem"><span class="sub">Mostrando ${limite} de ${lista.length}</span><button class="btn peq" data-mas>Mostrar 200 más</button></div>` : ''}` : '<div class="panel vacio">Sin alertas ✅</div>';
    };
    v.addEventListener('click', async e => {
      const t = e.target.closest('[data-t]'), n = e.target.closest('[data-n]'), pp = e.target.closest('[data-posp]');
      if (e.target.closest('[data-mas]')) { limite += 200; return pintar(); }
      if (t || n || pp) limite = 200;
      if (t) { filtro = t.dataset.t; nivel = ''; verPosp = false; return pintar(); } if (n) { nivel = nivel === n.dataset.n ? '' : n.dataset.n; filtro = ''; verPosp = false; return pintar(); } if (pp) { verPosp = !verPosp; filtro = ''; nivel = ''; return pintar(); }
      const ir = e.target.closest('[data-ir]'); if (ir) return Alertas.ir(lista[+ir.dataset.ir]);
      const p = e.target.closest('[data-p]'); if (p) { const [i, d] = p.dataset.p.split(':').map(Number); return posponer(lista[i], d); }
      const re = e.target.closest('[data-re]'); if (re) return reactivar(clave(lista[+re.dataset.re]));
    });
    pintar(); v.refrescar = pintar;
  }
  function panelConfig(cu) {
    const c = cfg(); const des = new Set(c.desactivadas); const actuales = {}; for (const a of D.alertasTodas()) actuales[a.tipo] = (actuales[a.tipo] || 0) + 1;
    const tipos = [...new Set([...TIPOS, ...Object.keys(actuales)])];
    cu.innerHTML = `<div class="panel"><h3>Tipos de alerta</h3><p class="sub">Desactive solo las alertas que no apliquen a su finca. Las alertas se recalculan con los datos; no generan registros. «Respaldo pendiente» protege sus datos: se recomienda mantenerla.</p>
      <div class="lista-checks" style="max-height:none">${tipos.map(t => `<label><input type="checkbox" data-tipo="${U.esc(t)}" ${des.has(t) ? '' : 'checked'}> ${U.esc(t)} ${NUEVAS.includes(t) ? '<span class="tag info">v6</span>' : ''} <span class="sub">(${actuales[t] || 0} ahora)</span></label>`).join('')}</div>
      <h3 style="margin-top:1rem">Parámetros de las alertas nuevas</h3><div class="form dos" id="al-par">
        <div class="campo"><label>Riesgo de agotamiento: avisar si el stock alcanza para (días)</label><input class="input" type="number" min="1" data-p="diasProyeccion" value="${c.p.diasProyeccion}"></div>
        <div class="campo"><label>Animales sin pesaje: días sin pesar</label><input class="input" type="number" min="15" data-p="diasSinPesaje" value="${c.p.diasSinPesaje}"></div>
        <div class="campo"><label>Gasto atípico: el mes supera el promedio de 6 meses en (×)</label><input class="input" type="number" min="1.1" step="0.1" data-p="factorGasto" value="${c.p.factorGasto}"></div></div>
      <div class="acciones" style="margin-top:1rem"><button class="btn primario" data-g>💾 Guardar configuración de alertas</button></div></div>`;
    U.$('[data-g]', cu).onclick = async () => {
      if (!Auth.puede('usuarios')) return U.toast('Solo el administrador puede configurar alertas.', 'error');
      const desactivadas = U.$$('[data-tipo]', cu).filter(x => !x.checked).map(x => x.dataset.tipo); const p = {};
      for (const x of U.$$('[data-p]', cu)) { const n = U.n(x.value); if (!(n > 0)) return U.toast('Revise los parámetros: deben ser mayores que cero.', 'error'); p[x.dataset.p] = n; }
      if (desactivadas.includes('Respaldo pendiente') && !await U.confirmar('Va a desactivar el recordatorio de respaldo. Sin respaldos, una falla del navegador puede borrar toda la información. ¿Continuar?', { si: 'Desactivar', peligro: true })) return;
      await DB.put('config', { id: 'alertasConfig', desactivadas, p }, { accion: 'Configuración', desc: `Alertas: ${desactivadas.length} tipos desactivados` }); U.toast('Configuración de alertas guardada', 'ok');
    };
  }
  return { aplicar, posponer, reactivar, clave, cfg, vista, panelConfig, TIPOS };
})();

const Alertas6 = (() => {
  function alertas() {
    const A = []; const p = AlertasCfg.cfg().p; const hoy = U.hoyISO();
    // 1) proyección de agotamiento (no repite productos que ya tienen alerta de agotado o stock bajo)
    for (const x of An.proyeccion()) {
      if (!(x.st > 0) || x.dias > p.diasProyeccion) continue;
      if (D.estadoStock(x.i).some(([t]) => t === 'Agotado' || t === 'Stock bajo')) continue;
      A.push({ nivel: x.dias <= 7 ? 'alta' : 'media', tipo: 'Riesgo de agotamiento', ico: '📉', titulo: `${x.i.nombre}: se agotaría en ≈ ${U.num(Math.max(1, Math.floor(x.dias)))} días`, detalle: `Consumo promedio ${U.num(x.tasa, 2)} ${x.i.unidad}/día en los últimos 90 días · stock ${U.num(x.st, 2)} ${x.i.unidad}`, ir: { t: 'insumo', id: x.i.id } });
    }
    // 2) animales sin pesaje reciente, agrupados por lote
    const por = {};
    for (const a of D.activos()) { const ps = D.pesajes(a.id); const ult = ps.length ? ps[ps.length - 1].fecha : (a.fechaPesoActual || a.fechaIngreso || null); if (!ult || U.dias(ult) <= p.diasSinPesaje) continue; (por[a.loteId || ''] = por[a.loteId || ''] || []).push(a); }
    for (const [lid, xs] of Object.entries(por)) A.push({ nivel: 'baja', tipo: 'Animales sin pesaje', ico: '⚖️', titulo: `${lid ? D.nombreLoteId(lid) : 'Sin lote'}: ${xs.length} animal(es) sin pesaje en ${p.diasSinPesaje} días`, detalle: xs.slice(0, 6).map(a => a.arete).join(', ') + (xs.length > 6 ? '…' : ''), ir: lid ? { t: 'lote', id: lid, lote: lid } : { t: 'ruta', ruta: 'ganado' } });
    // 3) gasto del mes atípico frente al promedio de los 6 meses anteriores (mínimo 3 meses con datos)
    const cd = D.costosDetalle(); const ym = hoy.slice(0, 7); const tot = m => cd.reduce((s, c) => String(c.fecha).startsWith(m) ? s + (c.monto || 0) : s, 0);
    const prev = []; const d0 = new Date(); for (let i = 1; i <= 6; i++) { const d = new Date(d0.getFullYear(), d0.getMonth() - i, 1); const t = tot(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`); if (t > 0) prev.push(t); }
    if (prev.length >= 3) { const prom = prev.reduce((s, x) => s + x, 0) / prev.length; const act = tot(ym); if (act > prom * p.factorGasto) A.push({ nivel: 'media', tipo: 'Gasto atípico', ico: '💸', titulo: `Gastos de ${U.MESES[+ym.slice(5) - 1].toLowerCase()}: ${U.dinero(act)} (${U.num(act / prom * 100, 0)} % del promedio)`, detalle: `Promedio mensual de los ${prev.length} meses anteriores con gastos: ${U.dinero(prom)}`, ir: { t: 'ruta', ruta: 'finanzas' } }); }
    return A;
  }
  return { alertas };
})();

// =====================================================================================================
// Asistente: responde preguntas frecuentes calculando sobre los registros locales. No usa Internet ni IA
// externa, no modifica datos y no emite recomendaciones veterinarias. Cada respuesta indica periodo y
// registros utilizados (con trazabilidad).
// =====================================================================================================
const Asistente = (() => {
  const SUG = ['¿Cuáles son los principales costos de este mes?', '¿Qué potreros requieren atención?', '¿Qué tareas están próximas a vencer?', '¿Cómo ha evolucionado el peso promedio de los animales?', '¿Qué inventarios presentan riesgo de agotamiento?', '¿Cuánto ha llovido este mes?', '¿Qué animales tienen aplicaciones sanitarias pendientes?'];
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const R = (titulo, texto, periodo, traza, extra = '') => ({ titulo, texto, periodo, traza, extra });
  function costosMes(q) {
    const hoy = U.hoyISO(); const anio = /\bano\b|anual|este ano/.test(q); const d = anio ? hoy.slice(0, 4) + '-01-01' : hoy.slice(0, 7) + '-01';
    const xs = D.costosDetalle().filter(c => An.enR(c.fecha, d, hoy) && c.monto); const tot = xs.reduce((s, c) => s + c.monto, 0);
    const por = {}; for (const c of xs) por[c.categoria] = (por[c.categoria] || 0) + c.monto; const top = Object.entries(por).sort((a, b) => b[1] - a[1]);
    const texto = xs.length ? `Total de costos: <b>${U.dinero(tot)}</b>. Principales categorías:<ol>${top.slice(0, 5).map(([k, v]) => `<li><b>${U.esc(k)}</b>: ${U.dinero(v)} (${U.num(v / tot * 100, 0)} %)</li>`).join('')}</ol>${xs.some(c => An.naturaleza(c) !== An.NAT.reg) ? `<small>Incluye ${U.dinero(xs.filter(c => An.naturaleza(c) !== An.NAT.reg).reduce((s, c) => s + c.monto, 0))} de consumo de inventario valorizado o estimaciones.</small>` : ''}` : 'No hay costos registrados en el periodo.';
    return R(anio ? 'Principales costos del año' : 'Principales costos del mes', texto, `${U.fecha(d)} – ${U.fecha(hoy)}`, () => Traza.abrir({ titulo: 'Costos utilizados', cols: [{ k: 'fecha', l: 'Fecha', fecha: 1 }, { k: 'categoria', l: 'Categoría' }, { k: 'origen', l: 'Origen' }, { k: 'desc', l: 'Detalle' }, { k: 'monto', l: 'Monto', dinero: 1 }], filas: xs }));
  }
  function potreros() {
    const al = D.alertas().filter(a => a.ir && a.ir.lote); const por = {}; for (const a of al) (por[a.ir.lote] = por[a.ir.lote] || []).push(a);
    const ls = Object.entries(por).map(([id, as]) => ({ id, as, alta: as.some(a => a.nivel === 'alta') })).sort((a, b) => b.alta - a.alta || b.as.length - a.as.length);
    const texto = ls.length ? `${ls.length} potrero(s) con situaciones registradas que requieren atención:<ul>${ls.slice(0, 8).map(x => `<li><b>${U.esc(D.nombreLoteId(x.id))}</b>: ${x.as.map(a => U.esc(a.tipo)).join(', ')}</li>`).join('')}</ul>${ls.length > 8 ? `<small>y ${ls.length - 8} más.</small>` : ''}` : 'Ningún potrero tiene alertas activas según los registros. ✅';
    return R('Potreros que requieren atención', texto, 'Situación actual (hoy)', () => Traza.abrir({ titulo: 'Alertas por potrero', cols: [{ k: 'lote', l: 'Lote' }, { k: 'tipo', l: 'Tipo' }, { k: 'titulo', l: 'Alerta' }, { k: 'detalle', l: 'Detalle' }, { k: 'nivel', l: 'Prioridad' }], filas: al.map(a => ({ id: a.ir.lote, lote: D.nombreLoteId(a.ir.lote), tipo: a.tipo, titulo: a.titulo, detalle: a.detalle, nivel: a.nivel })), alClic: x => Lote.abrir(x.id) }), '<small>Basado en: ocupación excedida, descanso insuficiente, restricción por fertilización, forraje del aforo, tareas y mantenimientos por lote.</small>');
  }
  function tareas(q) {
    const n = +((q.match(/(\d+)\s*dias?/) || [])[1]) || 7; const hoy = U.hoyISO(), lim = U.sumarDias(hoy, n);
    const xs = DB.filtrar('tareas', t => t.estado !== 'Completada' && (t.vence || t.fecha) <= lim).sort((a, b) => (a.vence || a.fecha).localeCompare(b.vence || b.fecha));
    const venc = xs.filter(t => (t.vence || t.fecha) < hoy);
    const texto = xs.length ? `${xs.length} tarea(s) vencen en los próximos ${n} días o ya vencieron (${venc.length} vencidas):<ul>${xs.slice(0, 8).map(t => `<li><b>${U.esc(t.titulo)}</b> — vence ${U.fecha(t.vence || t.fecha)}${t.loteId ? ' · ' + U.esc(D.nombreLoteId(t.loteId)) : ''}${t.responsable ? ' · ' + U.esc(t.responsable) : ''}</li>`).join('')}</ul>` : `No hay tareas pendientes que venzan en los próximos ${n} días. ✅`;
    return R('Tareas próximas a vencer', texto, `Hasta ${U.fecha(lim)}`, () => Traza.abrir({ titulo: 'Tareas', cols: [{ k: 'titulo', l: 'Tarea' }, { k: 'v', l: 'Vence', fecha: 1 }, { k: 'e', l: 'Estado' }, { k: 'prioridad', l: 'Prioridad' }, { k: 'responsable', l: 'Responsable' }], filas: xs.map(t => ({ ...t, v: t.vence || t.fecha, e: Tareas.estadoReal(t) })), alClic: x => Tareas.abrir(x.id) }));
  }
  function peso() {
    const hoy = U.hoyISO(), d = U.sumarDias(hoy, -364); const ms = An.meses(d, hoy, 12);
    const evs = DB.filtrar('eventos', e => e.tipo === 'Pesaje' && e.peso > 0 && An.enR(e.fecha, d, hoy));
    const serie = ms.map(ym => { const v = evs.filter(e => e.fecha.startsWith(ym)); return { ym, n: v.length, p: v.length ? v.reduce((s, e) => s + e.peso, 0) / v.length : null }; });
    const G = An.ganancias(DB.todos('animales'), d, hoy); const gdp = G.length ? G.reduce((s, x) => s + x.gdp, 0) / G.length : null;
    const con = serie.filter(x => x.p != null);
    const texto = con.length ? `Peso promedio de los animales pesados cada mes:<div class="tabla-cont"><table class="tabla"><thead><tr><th>Mes</th><th class="num">Pesajes</th><th class="num">Peso prom. (kg)</th></tr></thead><tbody>${con.map(x => `<tr><td>${An.etqMes(x.ym)}</td><td class="num">${x.n}</td><td class="num">${U.num(x.p, 0)}</td></tr>`).join('')}</tbody></table></div>
      ${gdp != null ? `Ganancia diaria promedio en 12 meses: <b>${U.num(gdp, 3)} kg/día</b> (${G.length} animales con dos o más pesajes).` : ''}<br><small>El promedio mensual depende de qué animales se pesaron ese mes; para comparar crecimiento use la ganancia diaria.</small>` : 'No hay pesajes en los últimos 12 meses.';
    return R('Evolución del peso promedio', texto, `${U.fecha(d)} – ${U.fecha(hoy)}`, () => Traza.abrir({ titulo: 'Pesajes utilizados', cols: [{ k: 'fecha', l: 'Fecha', fecha: 1 }, { k: 'arete', l: 'Animal' }, { k: 'peso', l: 'Peso kg', num: 1 }], filas: evs.map(e => ({ id: e.animalId, fecha: e.fecha, arete: DB.get('animales', e.animalId)?.arete || '?', peso: e.peso })).sort((a, b) => b.fecha.localeCompare(a.fecha)), alClic: x => Ganado.abrir(x.id, 'pesos') }));
  }
  function inventario() {
    const pr = An.proyeccion(); const riesgo = pr.filter(x => x.dias <= 30); const crit = DB.todos('insumos').filter(i => D.estadoStock(i).some(([t]) => ['Agotado', 'Stock bajo', 'Vencido'].includes(t)));
    const texto = (riesgo.length ? `Con el consumo de los últimos 90 días, ${riesgo.length} producto(s) se agotarían en 30 días o menos:<ul>${riesgo.slice(0, 8).map(x => `<li><b>${U.esc(x.i.nombre)}</b>: ≈ ${U.num(Math.floor(x.dias))} días (stock ${U.num(x.st, 2)} ${U.esc(x.i.unidad)}, consumo ${U.num(x.tasa, 2)}/día)</li>`).join('')}</ul>` : 'Ningún producto se agotaría en los próximos 30 días al ritmo de consumo actual. ')
      + (crit.length ? `Además, ${crit.length} producto(s) están agotados, bajo el mínimo o vencidos: ${crit.slice(0, 8).map(i => U.esc(i.nombre)).join(', ')}.` : '');
    return R('Inventarios con riesgo de agotamiento', texto, 'Consumo de los últimos 90 días · stock actual', () => Traza.abrir({ titulo: 'Proyección de consumo', cols: [{ k: 'n', l: 'Producto' }, { k: 'st', l: 'Stock', num: 1 }, { k: 'u', l: 'Unidad' }, { k: 'c', l: 'Consumo 90 d', num: 1 }, { k: 'dias', l: 'Días restantes', num: 1, dec: 0 }], filas: pr.map(x => ({ id: x.i.id, n: x.i.nombre, st: x.st, u: x.i.unidad, c: x.consumo, dias: x.dias })), alClic: x => Inv.abrir(x.id) }), '<small>Proyección: supone que el consumo se mantiene igual.</small>');
  }
  function lluvia(q) {
    const hoy = U.hoyISO(); const anio = /\bano\b|anual/.test(q); const d = anio ? hoy.slice(0, 4) + '-01-01' : hoy.slice(0, 7) + '-01'; const r = Lluvia.resumen(d, hoy);
    const regs = DB.filtrar('lluvias', x => An.enR(x.fecha, d, hoy));
    return R(anio ? 'Lluvia del año' : 'Lluvia del mes', `Lluvia acumulada: <b>${U.num(r.total, 1)} mm</b> en ${r.diasLluvia} días con lluvia${r.max ? `; máximo diario ${U.num(r.max, 1)} mm el ${U.fecha(r.fechaMax)}` : ''}. Días desde la última lluvia: ${Lluvia.diasSinLluvia() ?? '—'}.`, `${U.fecha(d)} – ${U.fecha(hoy)}`, () => Traza.abrir({ titulo: 'Registros de lluvia', cols: [{ k: 'fecha', l: 'Fecha', fecha: 1 }, { k: 'mm', l: 'mm', num: 1, dec: 1 }, { k: 'pluviometro', l: 'Pluviómetro' }, { k: 'responsable', l: 'Responsable' }], filas: regs }));
  }
  function sanidad() {
    const hoy = U.hoyISO(); const xs = DB.filtrar('eventos', e => e.proximaFecha && !e.proximaHecha && D.ACTIVO(DB.get('animales', e.animalId) || {}) && e.proximaFecha <= U.sumarDias(hoy, 15)).sort((a, b) => a.proximaFecha.localeCompare(b.proximaFecha));
    const venc = xs.filter(e => e.proximaFecha < hoy);
    return R('Aplicaciones sanitarias pendientes', xs.length ? `${xs.length} aplicación(es) programadas hasta el ${U.fecha(U.sumarDias(hoy, 15))}; ${venc.length} ya vencieron. Consulte la lista para ver animal, producto y fecha.` : 'No hay aplicaciones sanitarias pendientes en los próximos 15 días. ✅', `Hasta ${U.fecha(U.sumarDias(hoy, 15))}`,
      () => Traza.abrir({ titulo: 'Aplicaciones pendientes', cols: [{ k: 'f', l: 'Fecha programada', fecha: 1 }, { k: 'tipo', l: 'Tipo' }, { k: 'arete', l: 'Animal' }, { k: 'prod', l: 'Producto' }], filas: xs.map(e => ({ id: e.animalId, f: e.proximaFecha, tipo: e.tipo, arete: DB.get('animales', e.animalId)?.arete, prod: e.producto || e.detalle || '' })), alClic: x => Ganado.abrir(x.id, 'sanidad') }),
      '<small>⚕️ El asistente solo resume registros: no recomienda diagnósticos, productos ni dosis. Esas decisiones corresponden al médico veterinario.</small>');
  }
  function animal(q) {
    const toks = q.split(/[\s,¿?]+/).filter(Boolean);
    const a = DB.todos('animales').find(x => toks.includes(norm(x.arete)) || (x.rfid && toks.includes(norm(x.rfid))) || (x.nombre && toks.includes(norm(x.nombre))));
    if (!a) return null; const g = D.gananciaDiaria(a);
    return R('Animal ' + a.arete, `<b>${U.esc(D.nombreAnimal(a))}</b> · ${U.esc(D.categoria(a))} · ${a.sexo === 'M' ? 'macho' : 'hembra'} · ${U.esc(a.raza || '—')} · ${U.edad(a.fechaNacimiento)}<br>Estado: ${U.esc(a.estado || 'Activo')} · ${a.loteId ? 'en ' + U.esc(D.nombreLoteId(a.loteId)) + ` desde ${U.fecha(a.fechaEntradaLote)}` : 'sin lote'}<br>Peso: ${a.pesoActual ? U.num(a.pesoActual) + ' kg (' + U.fecha(a.fechaPesoActual) + ')' : '—'} · GDP: ${g == null ? '—' : U.num(g, 3) + ' kg/d'}<br>Sanitario: ${U.esc(a.estadoSanitario || '—')} · Reproductivo: ${U.esc(a.estadoReproductivo || '—')}`,
      'Situación actual', () => Ganado.abrir(a.id));
  }
  function lote(q) {
    const m = q.match(/lote\s*([\w-]+)/); if (!m) return null; const l = D.lotes().find(x => norm(x.codigo) === m[1]); if (!l) return null; const ip = D.infoPotrero(l); const af = Aforo.msEstimadaHoy(l.id);
    return R(D.nombreLote(l), `Estado: <b>${U.esc(ip.n ? 'Ocupado' : l.estado)}</b> · ${ip.n} animales${ip.n ? ` desde hace ${ip.diasOcup} días` : ip.diasDesc != null ? ` · ${ip.diasDesc} días de descanso` : ''}<br>Área: ${D.area(l) ? U.num(D.area(l), 2) + ' ha' + (l.areaHa ? '' : ' (estimada)') : '—'} · Carga: ${ip.carga != null && ip.n ? U.num(ip.carga, 2) + ' an/ha' : '—'}<br>Forraje: ${af ? U.num(af.ms, 0) + ' kg MS/ha estimados hoy (aforo del ' + U.fecha(Aforo.ultimo(l.id).fecha) + ')' : 'sin aforo'}<br>Alertas: ${D.alertas().filter(a => a.ir?.lote === l.id).map(a => U.esc(a.titulo)).join('; ') || 'ninguna'}`, 'Situación actual', () => Lote.abrir(l.id));
  }
  function responder(texto) {
    const q = norm(texto);
    if (!q.trim()) return null;
    if (/costo|gasto|egreso/.test(q)) return costosMes(q);
    if (/sanit|vacun|tratamiento|desparasit|aplicacion/.test(q)) return sanidad();
    if (/lluvi|llovi|pluvio/.test(q)) return lluvia(q);
    if (/inventario|agot|stock|insumo|existencia/.test(q)) return inventario();
    if (/tarea|vence|vencer|agenda|pendiente/.test(q)) return tareas(q);
    if (/peso|engorde|ganancia|gdp/.test(q)) return peso();
    const l = lote(q); if (l) return l;
    if (/potrero|lote|pastoreo|rotacion/.test(q)) return potreros();
    const a = animal(q); if (a) return a;
    return R('No entendí la pregunta', `Puedo responder sobre: costos del mes o del año, potreros que requieren atención, tareas por vencer, evolución del peso, riesgo de agotamiento de inventario, lluvia, aplicaciones sanitarias pendientes, un animal (escriba su arete) o un lote (escriba «lote 12»).`, '—', null);
  }
  function vista(c) {
    const v = U.h(`<div class="vista"><div class="vista-cabecera"><h2>Asistente de consultas</h2></div>
      <div class="aviso-plano">🔒 Responde con cálculos sobre los registros de este dispositivo, <b>sin Internet y sin enviar datos a terceros</b>. Solo consulta: no crea, modifica ni elimina registros, y no reemplaza el criterio del médico veterinario o del agrónomo. Un conector opcional con un proveedor de IA externo está documentado en la hoja de ruta; no está activo.</div>
      <form class="asis-form"><input class="input" id="as-q" placeholder="Escriba su pregunta, p. ej.: ¿qué potreros requieren atención?" autocomplete="off"><button class="btn primario">Consultar</button></form>
      <div class="acciones" style="margin:.6rem 0">${SUG.map((s, i) => `<button class="btn peq" data-s="${i}">${U.esc(s)}</button>`).join('')}</div><div id="as-res"></div></div>`);
    c.appendChild(v); const res = U.$('#as-res', v); const hist = [];
    const pintar = () => { res.innerHTML = hist.map((h, i) => `<div class="panel asis-r"><div class="sub">Pregunta: «${U.esc(h.q)}»</div><h3>${U.esc(h.r.titulo)}</h3><div>${h.r.texto}</div>${h.r.extra ? `<div style="margin-top:.4rem">${h.r.extra}</div>` : ''}<div class="acciones" style="margin-top:.6rem"><span class="tag info">Periodo: ${U.esc(h.r.periodo)}</span>${h.r.traza ? `<button class="btn peq" data-tr="${i}">🔎 Ver registros utilizados</button>` : ''}</div></div>`).join(''); };
    const consultar = q => { const r = responder(q); if (!r) return; hist.unshift({ q, r }); if (hist.length > 10) hist.pop(); pintar(); };
    U.$('.asis-form', v).onsubmit = e => { e.preventDefault(); const i = U.$('#as-q', v); consultar(i.value); i.value = ''; };
    v.addEventListener('click', e => { const s = e.target.closest('[data-s]'); if (s) consultar(SUG[+s.dataset.s]); const t = e.target.closest('[data-tr]'); if (t) hist[+t.dataset.tr].r.traza(); });
  }
  return { responder, vista, SUG };
})();

// =====================================================================================================
// Calidad: verificación de integridad de los datos (solo lectura) y estado del almacenamiento.
// =====================================================================================================
const Calidad = (() => {
  function revisar() {
    const C = []; const hoy = U.hoyISO();
    const add = (sev, area, titulo, items, cols, alClic, ayuda = '') => C.push({ sev, area, titulo, items, cols, alClic, ayuda });
    const A = id => DB.get('animales', id);
    const cA = [{ k: 'arete', l: 'Arete' }, { k: 'det', l: 'Detalle' }];
    add('alta', 'Integridad', 'Eventos de animales inexistentes', DB.filtrar('eventos', e => !A(e.animalId)).map(e => ({ arete: e.animalId || '—', det: `${e.tipo} del ${U.fecha(e.fecha)}` })), cA, null, 'Registros huérfanos (por ejemplo, de un animal eliminado). No afectan el inventario, pero sí pueden afectar costos.');
    add('alta', 'Integridad', 'Animales con lote inexistente', DB.filtrar('animales', a => a.loteId && !DB.get('lotes', a.loteId)).map(a => ({ id: a.id, arete: a.arete, det: 'loteId: ' + a.loteId })), cA, x => Ganado.abrir(x.id));
    add('alta', 'Integridad', 'Movimientos de inventario de productos inexistentes', DB.filtrar('movinv', m => !DB.get('insumos', m.insumoId)).map(m => ({ arete: m.insumoId, det: `${m.tipo} ${m.cantidad} el ${U.fecha(m.fecha)}` })), cA);
    add('media', 'Integridad', 'Movimientos de ganado con lote inexistente', DB.filtrar('movimientos', m => (m.destino && !DB.get('lotes', m.destino)) || (m.origen && !DB.get('lotes', m.origen))).map(m => ({ arete: m.fecha, det: `${m.origen || 'ingreso'} → ${m.destino}` })), cA);
    add('alta', 'Duplicados', 'Aretes repetidos', (() => { const g = {}; for (const a of DB.todos('animales')) { const k = String(a.arete || '').trim().toLowerCase(); if (k) (g[k] = g[k] || []).push(a); } return Object.values(g).filter(x => x.length > 1).flatMap(x => x.map(a => ({ id: a.id, arete: a.arete, det: `${x.length} animales con este arete · ${a.estado || 'Activo'}` }))); })(), cA, x => Ganado.abrir(x.id));
    add('media', 'Duplicados', 'RFID repetidos', (() => { const g = {}; for (const a of DB.todos('animales')) if (a.rfid) (g[a.rfid] = g[a.rfid] || []).push(a); return Object.values(g).filter(x => x.length > 1).flatMap(x => x.map(a => ({ id: a.id, arete: a.arete, det: 'RFID ' + a.rfid }))); })(), cA, x => Ganado.abrir(x.id));
    add('media', 'Consistencia', 'Ocupaciones abiertas sin animales en el lote', DB.filtrar('ocupaciones', o => !o.salida && !D.animalesEnLote(o.loteId).length).map(o => ({ id: o.loteId, arete: D.nombreLoteId(o.loteId), det: 'Entrada ' + U.fecha(o.entrada) })), cA, x => Lote.abrir(x.id, 'potrero'), 'Distorsiona días de ocupación y descanso. Corrija moviendo o registrando la salida.');
    add('media', 'Consistencia', 'Lotes «Ocupado» sin animales', DB.filtrar('lotes', l => l.estado === 'Ocupado' && !D.animalesEnLote(l.id).length).map(l => ({ id: l.id, arete: D.nombreLote(l), det: 'Cambie el estado del lote' })), cA, x => Lote.abrir(x.id));
    add('baja', 'Consistencia', 'Lotes con animales y estado distinto de «Ocupado»', DB.filtrar('lotes', l => l.estado !== 'Ocupado' && D.animalesEnLote(l.id).length).map(l => ({ id: l.id, arete: D.nombreLote(l), det: `${l.estado} · ${D.animalesEnLote(l.id).length} animales` })), cA, x => Lote.abrir(x.id));
    add('alta', 'Inventario', 'Productos con stock negativo', DB.todos('insumos').filter(i => D.stock(i.id) < 0).map(i => ({ id: i.id, arete: i.nombre, det: `Stock ${U.num(D.stock(i.id), 2)} ${i.unidad}` })), cA, x => Inv.abrir(x.id));
    add('media', 'Fechas', 'Eventos con fecha futura', DB.filtrar('eventos', e => e.fecha > hoy).map(e => ({ id: e.animalId, arete: A(e.animalId)?.arete || '?', det: `${e.tipo} ${U.fecha(e.fecha)}` })), cA, x => Ganado.abrir(x.id));
    add('baja', 'Pesajes', 'Pesajes que cambian más de 40 % frente al anterior', (() => { const out = []; for (const a of DB.todos('animales')) { const ps = D.pesajes(a.id); for (let i = 1; i < ps.length; i++) if (ps[i - 1].peso && Math.abs(ps[i].peso - ps[i - 1].peso) / ps[i - 1].peso > 0.4) out.push({ id: a.id, arete: a.arete, det: `${U.num(ps[i - 1].peso)} → ${U.num(ps[i].peso)} kg (${U.fecha(ps[i].fecha)})` }); } return out; })(), cA, x => Ganado.abrir(x.id, 'pesos'), 'Posibles errores de digitación o de báscula.');
    add('baja', 'Completitud', 'Animales activos sin fecha de nacimiento', D.activos().filter(a => !a.fechaNacimiento).map(a => ({ id: a.id, arete: a.arete, det: 'La categoría y la edad no se calculan bien' })), cA, x => Ganado.abrir(x.id));
    add('baja', 'Completitud', 'Lotes con ganado sin área registrada (se usa la estimada del plano)', DB.filtrar('lotes', l => !l.areaHa && D.animalesEnLote(l.id).length).map(l => ({ id: l.id, arete: D.nombreLote(l), det: l.areaEstHa ? `≈ ${U.num(l.areaEstHa, 2)} ha estimadas` : 'sin área' })), cA, x => Lote.abrir(x.id, 'ficha'), 'La carga animal y los costos por hectárea son aproximados hasta registrar el área medida.');
    add('media', 'Costos', 'Posibles duplicados contables', Fin.duplicados('0000-01-01', '9999-12-31').map(x => ({ arete: U.fecha(x.fecha), det: x.tipo + ' · ' + x.desc })), cA, null, 'Revise si el costo del evento ya incluía el producto descontado del inventario.');
    add('media', 'Seguridad', 'Usuarios activos con el PIN inicial', DB.filtrar('usuarios', u => u.pinInicial && u.activo !== false).map(u => ({ arete: u.nombre, det: Auth.ROLES[u.rol]?.nombre || u.rol })), cA, null, 'El PIN inicial se muestra en la pantalla de ingreso. Cámbielo en Configuración → Usuarios.');
    return C;
  }
  async function almacenamiento() {
    const o = {}; try { if (navigator.storage?.estimate) { const e = await navigator.storage.estimate(); o.uso = e.usage; o.cuota = e.quota; } if (navigator.storage?.persisted) o.persistente = await navigator.storage.persisted(); } catch (e) { }
    try { const fs = await DB.todasFotos(); o.fotos = fs.length; o.bytesFotos = fs.reduce((s, f) => s + (f.dataUrl || '').length * 0.75, 0); o.huerfanas = fs.filter(f => !['fotos', 'auditoria'].includes(f.entidad) && DB.COLECCIONES.includes(f.entidad) && !DB.get(f.entidad, f.entidadId)).length; o.invalidas = fs.filter(f => !U.srcSeguro(f.dataUrl)).length; } catch (e) { }
    try { o.puntos = await Recuperacion.listar(); } catch (e) { o.puntos = []; }
    return o;
  }
  async function vista(c) {
    const v = U.h(`<div class="vista"><div class="vista-cabecera"><h2>Calidad de datos</h2><button class="btn" data-csv>📄 CSV de hallazgos</button></div><p class="sub">Revisión automática de solo lectura: no corrige ni elimina nada. Toque cada hallazgo para ver los registros y corregirlos desde su módulo.</p><div id="cal-alm" class="panel"></div><div id="cal-res"></div></div>`);
    c.appendChild(v); let C = [];
    const pintar = async () => {
      C = revisar(); const conProb = C.filter(x => x.items.length);
      const SEV = { alta: ['Alta', 'peligro'], media: ['Media', 'warn'], baja: ['Baja', 'info'] };
      U.$('#cal-res', v).innerHTML = `<div class="tarjetas">${['alta', 'media', 'baja'].map(s => `<div class="tarjeta" style="cursor:default"><div class="t-valor">${conProb.filter(x => x.sev === s).reduce((n, x) => n + x.items.length, 0)}</div><div class="t-etq">Hallazgos de severidad ${SEV[s][0].toLowerCase()}</div></div>`).join('')}<div class="tarjeta" style="cursor:default"><div class="t-valor">${C.length - conProb.length}/${C.length}</div><div class="t-etq">Verificaciones sin hallazgos</div></div></div>
        <div class="lista" style="margin-top:1rem">${C.map((x, i) => `<button class="item" data-c="${i}" ${x.items.length ? '' : 'disabled'}><span class="av">${x.items.length ? '⚠️' : '✅'}</span><span class="cuerpo"><b>${U.esc(x.titulo)}</b><small>${U.esc(x.area)} · ${x.items.length ? `${x.items.length} registro(s)` : 'sin hallazgos'}${x.ayuda ? ' · ' + U.esc(x.ayuda) : ''}</small></span><span class="tag ${x.items.length ? SEV[x.sev][1] : 'ok'}">${x.items.length ? SEV[x.sev][0] : 'OK'}</span></button>`).join('')}</div>`;
      const o = await almacenamiento(); const MB = b => b == null ? '—' : U.num(b / 1048576, 1) + ' MB';
      U.$('#cal-alm', v).innerHTML = `<h3>💽 Almacenamiento del dispositivo</h3><div class="datos"><div><small>Espacio usado / disponible</small><b>${MB(o.uso)} / ${MB(o.cuota)}</b></div><div><small>Almacenamiento persistente</small><b>${o.persistente === true ? '✅ Concedido (el navegador no lo borra por espacio)' : o.persistente === false ? '⚠️ No concedido: el navegador podría borrar datos si falta espacio' : '—'}</b></div>
        <div><small>Fotografías</small><b>${o.fotos ?? '—'} (${MB(o.bytesFotos)})</b></div><div><small>Fotos huérfanas / no válidas</small><b>${o.huerfanas ?? '—'} / ${o.invalidas ?? '—'}</b></div><div><small>Puntos de restauración</small><b>${o.puntos.length} de ${Recuperacion.MAX}</b></div><div><small>Esquema de datos</small><b>v${(DB.get('config', 'esquema') || {}).v || 5}</b></div></div>`;
    };
    v.addEventListener('click', e => {
      const b = e.target.closest('[data-c]'); if (b) { const x = C[+b.dataset.c]; Traza.abrir({ titulo: x.titulo, nota: x.ayuda, cols: x.cols, filas: x.items, alClic: x.alClic }); }
      if (e.target.closest('[data-csv]')) { try { Auth.exigir('exportar'); } catch (ex) { return U.toast(ex.message, 'error'); } U.descargar(`calidad_datos_${U.hoyISO()}.csv`, U.csv([{ k: 's', l: 'Severidad' }, { k: 'a', l: 'Área' }, { k: 't', l: 'Verificación' }, { k: 'r', l: 'Registro' }, { k: 'd', l: 'Detalle' }], C.flatMap(x => x.items.map(i => ({ s: x.sev, a: x.area, t: x.titulo, r: i.arete, d: i.det })))), 'text/csv;charset=utf-8'); }
    });
    await pintar(); v.refrescar = pintar;
  }
  return { revisar, almacenamiento, vista };
})();

// =====================================================================================================
// Genea: pestaña «Genealogía» de la ficha individual (madre, abuela, padre, crías, partos e IEP).
// =====================================================================================================
const Genea = (() => {
  const enlace = a => a ? `<a href="#" data-animal="${U.esc(a.id)}">${U.esc(D.nombreAnimal(a))}</a>` : '—';
  function tab(a, cu) {
    const madre = DB.get('animales', a.madreId); const abuela = madre && DB.get('animales', madre.madreId);
    const crias = DB.filtrar('animales', x => x.madreId === a.id).sort((x, y) => String(x.fechaNacimiento || '').localeCompare(String(y.fechaNacimiento || '')));
    const hijosPadre = a.sexo === 'M' ? DB.filtrar('animales', x => x.padre && [a.arete, a.nombre, D.nombreAnimal(a)].filter(Boolean).some(n => String(x.padre).toLowerCase() === String(n).toLowerCase())) : [];
    const partos = DB.de('eventos', 'animalId', a.id).filter(e => e.tipo === 'Parto').sort((x, y) => x.fecha.localeCompare(y.fecha));
    const iep = An.intervalosParto([a]); const iepM = iep.length ? iep.reduce((s, x) => s + x.dias, 0) / iep.length : null;
    const edad1 = partos.length && a.fechaNacimiento ? U.mesesEntre(U.aFecha(a.fechaNacimiento), U.aFecha(partos[0].fecha)) : null;
    cu.innerHTML = `<div class="datos"><div><small>Madre</small><b>${madre ? enlace(madre) : U.esc(a.madre || '—')}</b></div><div><small>Abuela materna</small><b>${abuela ? enlace(abuela) : U.esc(madre?.madre || '—')}</b></div>
      <div><small>Padre / reproductor</small><b>${U.esc(a.padre || '—')}</b></div><div><small>Crías registradas</small><b>${crias.length + hijosPadre.length}</b></div>
      ${a.sexo === 'H' ? `<div><small>Partos registrados</small><b>${partos.length}</b></div><div><small>Edad al primer parto</small><b>${edad1 == null ? '—' : edad1 + ' meses'}</b></div><div><small>Intervalo entre partos promedio</small><b>${iepM == null ? '—' : U.num(iepM, 0) + ' días'}</b></div>` : ''}</div>
      <h4 style="margin-top:.8rem">Descendencia</h4>${U.tabla([{ k: 'n', l: 'Cría', f: x => enlace(x) }, { k: 'sexo', l: 'Sexo', f: x => x.sexo === 'M' ? 'Macho' : 'Hembra' }, { k: 'nac', l: 'Nacimiento', f: x => U.fecha(x.fechaNacimiento) }, { k: 'p', l: 'Peso actual', num: 1, f: x => x.pesoActual ? U.num(x.pesoActual) + ' kg' : '—' }, { k: 'e', l: 'Estado', f: x => U.esc(x.estado || 'Activo') }], [...crias, ...hijosPadre], { vacio: 'Sin crías registradas.' })}
      ${partos.length ? `<h4 style="margin-top:.8rem">Partos</h4>${U.tabla([{ k: 'f', l: 'Fecha', f: e => U.fecha(e.fecha) }, { k: 'r', l: 'Resultado', f: e => U.esc(e.resultado || '—') }, { k: 'i', l: 'Días desde el parto anterior', num: 1, f: e => { const x = iep.find(z => z.hasta === e.fecha); return x ? U.num(x.dias) : '—'; } }], partos)}` : ''}
      <p class="sub">El padre se registra como texto; las crías por padre se identifican cuando ese texto coincide con el arete o el nombre del reproductor.</p>`;
  }
  return { tab };
})();

// =====================================================================================================
// Reportes adicionales (se agregan a la lista existente; mantienen PDF/Excel/CSV del módulo original)
// =====================================================================================================
(() => {
  const R = Reportes.REPORTES; const ini = d => d || '0000-01-01', fin = h => h || U.hoyISO();
  R.push(['flujo-caja', 'Flujo de caja mensual (v6)', (d, h) => { const X = Fin.calcular(d || U.hoyISO().slice(0, 4) + '-01-01', fin(h)); return { cols: [['mes', 'Mes'], ['ingresos', 'Ingresos', 1], ['reg', 'Costos registrados', 1], ['compras', 'Compras inventario (est.)', 1], ['neto', 'Flujo neto', 1], ['acum', 'Acumulado', 1], ['der', 'Consumo inventario (costo)', 1], ['est', 'Costos estimados', 1]], filas: X.flujo.map(x => ({ ...x, ingresos: Math.round(x.ingresos), reg: Math.round(x.reg), compras: Math.round(x.compras), neto: Math.round(x.neto), acum: Math.round(x.acum), der: Math.round(x.der), est: Math.round(x.est) })) }; }]);
  R.push(['hato-mov', 'Entradas y salidas del hato por mes (v6)', (d, h) => { const D0 = d || U.sumarDias(U.hoyISO(), -364), H0 = fin(h); const as = DB.todos('animales'); return { cols: [['mes', 'Mes'], ['nac', 'Nacimientos', 1], ['com', 'Compras', 1], ['otr', 'Otros ingresos', 1], ['ven', 'Ventas', 1], ['mue', 'Muertes', 1], ['baj', 'Bajas', 1], ['inv', 'Inventario al cierre', 1]],
    filas: An.meses(D0, H0, 36).map(ym => { const ing = as.filter(a => An.ingreso(a).startsWith(ym)); const sal = as.filter(a => (a.fechaSalida || '').startsWith(ym)); const f = An.finMes(ym) > U.hoyISO() ? U.hoyISO() : An.finMes(ym);
      return { mes: An.etqMes(ym), nac: ing.filter(a => /nacim/i.test(a.procedencia || '')).length, com: ing.filter(a => !/nacim/i.test(a.procedencia || '') && (/compra/i.test(a.procedencia || '') || a.precioCompra)).length, otr: ing.filter(a => !/nacim|compra/i.test(a.procedencia || '') && !a.precioCompra).length, ven: sal.filter(a => a.estado === 'Vendido').length, mue: sal.filter(a => a.estado === 'Muerto').length, baj: sal.filter(a => a.estado === 'Baja').length, inv: as.filter(a => An.vivoEn(a, f)).length }; }) }; }]);
  R.push(['potreros-uso', 'Uso y recuperación de potreros (v6)', (d, h) => { const D0 = ini(d), H0 = fin(h); const rot = An.rotaciones(DB.todos('lotes')); const por = {};
    for (const r of rot) { if (!An.enR(r.o.salida, D0, H0)) continue; const x = por[r.l.id] = por[r.l.id] || { l: r.l, n: 0, ocup: 0, desc: [], an: 0 }; x.n++; x.ocup += r.ocup; if (r.desc != null) x.desc.push(r.desc); }
    for (const m of DB.filtrar('movimientos', m => An.enR(m.fecha, D0, H0))) { const x = por[m.destino]; if (x) x.an += m.cantidad || 0; }
    return { cols: [['lote', 'Lote'], ['n', 'Ocupaciones cerradas', 1], ['ocup', 'Días ocupación prom.', 1], ['desc', 'Descanso prom. (d)', 1], ['cumple', 'Descansos ≥ mínimo', 1], ['ms', 'Último aforo kg MS/ha', 1], ['fert', 'Fertilizaciones', 1]],
      filas: Object.values(por).sort((a, b) => (a.l.numero ?? 9999) - (b.l.numero ?? 9999)).map(x => { const a = Aforo.ultimo(x.l.id); return { lote: D.nombreLote(x.l), n: x.n, ocup: Math.round(x.ocup / x.n * 10) / 10, desc: x.desc.length ? Math.round(x.desc.reduce((s, v) => s + v, 0) / x.desc.length) : '', cumple: x.desc.filter(v => v >= D.param('descansoMin')).length, ms: a ? Math.round(Aforo.calcular(a).msHa) : '', fert: DB.de('fertilizaciones', 'loteId', x.l.id).filter(f => f.estado === 'Realizada' && An.enR(f.fecha, D0, H0)).length }; }) }; }]);
  R.push(['reproduccion', 'Indicadores reproductivos por vaca (v6)', () => { const vs = DB.filtrar('animales', a => a.sexo === 'H' && DB.de('eventos', 'animalId', a.id).some(e => e.tipo === 'Parto' || e.tipo === 'Servicio / monta' || e.tipo === 'Diagnóstico de preñez'));
    return { cols: [['arete', 'Arete'], ['nombre', 'Nombre'], ['estado', 'Estado reproductivo'], ['partos', 'Partos', 1], ['ult', 'Último parto'], ['iep', 'IEP promedio (d)', 1], ['crias', 'Crías registradas', 1], ['parto', 'Parto probable']],
      filas: vs.map(a => { const ps = DB.de('eventos', 'animalId', a.id).filter(e => e.tipo === 'Parto').sort((x, y) => x.fecha.localeCompare(y.fecha)); const iep = An.intervalosParto([a]); return { arete: a.arete, nombre: a.nombre || '', estado: a.estadoReproductivo || '', partos: ps.length, ult: ps.length ? U.fecha(ps[ps.length - 1].fecha) : '', iep: iep.length ? Math.round(iep.reduce((s, x) => s + x.dias, 0) / iep.length) : '', crias: DB.filtrar('animales', x => x.madreId === a.id).length, parto: a.fechaProbableParto ? U.fecha(a.fechaProbableParto) : '' }; }) }; }]);
  R.push(['calidad', 'Calidad de datos (v6)', () => ({ cols: [['sev', 'Severidad'], ['area', 'Área'], ['ver', 'Verificación'], ['reg', 'Registro'], ['det', 'Detalle']], filas: Calidad.revisar().flatMap(x => x.items.map(i => ({ sev: x.sev, area: x.area, ver: x.titulo, reg: i.arete, det: i.det }))) })]);
})();

// =====================================================================================================
// Registro de vistas y menú (se insertan en el menú original sin alterar las rutas existentes)
// =====================================================================================================
(() => {
  const R = App.RUTAS; const pos = r => R.findIndex(x => x[0] === r);
  R.splice(pos('dashboard') + 1, 0, ['indicadores', '📈', 'Indicadores y análisis', '', 'gauge']);
  R.splice(pos('alertas') + 1, 0, ['asistente', '💬', 'Asistente de consultas', '', 'search']);
  R.splice(pos('costos') + 1, 0, ['finanzas', '📒', 'Flujo de caja', '', 'trending-up']);
  R.splice(pos('bitacora') + 1, 0, ['calidad', '🩺', 'Calidad de datos', '', 'heart-pulse']);
  App.registrar('indicadores', BI.vista);
  App.registrar('finanzas', Fin.vista);
  App.registrar('alertas', AlertasCfg.vista); // reemplaza la vista de alertas por la versión con estados (Alertas.html/ir se conservan)
  App.registrar('asistente', Asistente.vista);
  App.registrar('calidad', Calidad.vista);
})();
