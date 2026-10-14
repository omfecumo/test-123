/* SIAF para macOS — puente de escritorio.
   Se carga DESPUÉS de todos los módulos originales de SIAF (scripts/prepare-web.mjs añade una sola etiqueta
   <script src="desktop-bridge.js"> antes de </body>). No modifica la lógica de SIAF: usa sus módulos públicos
   (DB, Resp8, Respaldo, Auth, App, U) y añade:
     1. Respaldos automáticos a disco (ZIP oficial de SIAF, verificado por el proceso principal).
     2. Punto de recuperación en disco ANTES de cualquier restauración, importación completa o borrado total.
     3. Punto de recuperación tras un cierre inesperado y respaldo al salir.
     4. Verificación posterior de la migración desde la versión HTML.
     5. Comandos de los menús nativos (navegar, imprimir, tema, buscar, deshacer, estado, preferencias).
     6. Grabador y reproductor de acciones DENTRO de SIAF para «SIAF Control y Automatización».
   © 2026 Omar Fernando Cuadro Mogollón. Todos los derechos reservados. */
(() => {
  'use strict';
  const E = window.siafEscritorio;
  if (!E) return; // abierto fuera de la app de escritorio: SIAF funciona igual que siempre

  const esperar = ms => new Promise(r => setTimeout(r, ms));
  const dbLista = () => { try { return typeof DB !== 'undefined' && DB.todos('usuarios') !== undefined; } catch (e) { return false; } };
  const sesionLista = () => dbLista() && typeof Auth !== 'undefined' && !!Auth.actual && !!document.querySelector('#app .topbar');
  async function hasta(cond, ms = 120000) { const t0 = Date.now(); while (!cond()) { if (Date.now() - t0 > ms) return false; await esperar(200); } return true; }
  const toast = (m, t) => { try { U.toast(m, t); } catch (e) { console.log(m); } };
  const esc = s => (typeof U !== 'undefined' ? U.esc(s) : String(s));

  // ---------- errores técnicos al registro local (sin datos de la finca) ----------
  addEventListener('error', e => { E.error(`${e.message} @${String(e.filename || '').split('/').pop()}:${e.lineno}`).catch(() => { }); });
  addEventListener('unhandledrejection', e => { E.error('Promesa rechazada: ' + ((e.reason && e.reason.message) || e.reason)).catch(() => { }); });

  // ======================================================================================
  // 1-3. Respaldos a disco
  // ======================================================================================
  let info = null, prefs = null, ultimo = null, sucio = false, cola = Promise.resolve();
  const marcaSucio = () => { sucio = true; };
  document.addEventListener('siaf:datos', ev => { if (!(ev.detail && ev.detail.remoto)) marcaSucio(); });

  async function bytesRespaldo(motivo) {
    if (typeof Resp8 === 'undefined' || !Resp8.construir) throw new Error('El módulo de respaldo de SIAF no está disponible.');
    const r = await Resp8.construir({ fotos: true, motivo: 'escritorio-' + motivo });
    return new Uint8Array(await r.blob.arrayBuffer());
  }
  /** Respaldo serializado (nunca dos a la vez). motivo: auto | manual | salida | pre-restauracion | pre-borrado | cierre-inesperado | pre-migracion */
  function respaldar(motivo, detalle = '') {
    const tarea = cola.then(async () => {
      const antesSucio = sucio; sucio = false;
      try {
        const entrada = await E.respaldo.guardar(await bytesRespaldo(motivo), motivo, detalle);
        ultimo = entrada; pintarChip(); return entrada;
      } catch (e) { if (antesSucio) sucio = true; pintarChip(e.message); throw e; }
    });
    cola = tarea.catch(() => { });
    return tarea;
  }

  function envolverOperacionesDestructivas() {
    if (DB.__escritorio) return;
    const imp = DB.importar, bor = DB.borrarTodo;
    DB.importar = async function (json, opts) {
      await puntoPrevio('pre-restauracion', 'Antes de restaurar o importar un respaldo completo');
      const pend = await E.migracion.pendiente().catch(() => null);
      if (pend && pend.estado === 'enviada') {
        const conteos = {}; for (const [c, xs] of Object.entries((json && json.datos) || {})) if (Array.isArray(xs)) conteos[c] = new Set(xs.filter(o => o && o.id).map(o => o.id)).size;
        await E.migracion.esperado({ ...pend, conteosImportados: undefined, conteos, estado: 'importando' });
      }
      return imp.call(this, json, opts);
    };
    DB.borrarTodo = async function (...a) { await puntoPrevio('pre-borrado', 'Antes de borrar todos los datos'); return bor.apply(this, a); };
    Object.defineProperty(DB, '__escritorio', { value: true });
  }
  async function puntoPrevio(motivo, detalle) {
    try { const r = await respaldar(motivo, detalle); toast(`🛟 Punto de recuperación guardado en disco (${r.nombre}).`, 'ok'); }
    catch (e) {
      const seguir = await U.confirmar(`No se pudo guardar el punto de recuperación en disco: ${esc(e.message)}<br><br>Si continúa, la copia previa solo existirá dentro de SIAF. ¿Continuar de todas formas?`, { si: 'Continuar sin copia en disco', peligro: true });
      if (!seguir) throw new Error('Operación cancelada: no se pudo crear el punto de recuperación en disco.');
    }
  }

  function tick() {
    if (!prefs || !prefs.respaldoAuto || !sucio || !dbLista()) return;
    const ult = ultimo ? Date.parse(ultimo.fecha) : 0;
    if (Date.now() - ult >= prefs.intervaloHoras * 3600000) respaldar('auto').catch(e => console.warn('Respaldo automático:', e.message));
  }

  // ---------- indicador de estado en la barra superior ----------
  let errorChip = '';
  function pintarChip(err) {
    if (err !== undefined) errorChip = err || '';
    const barra = document.querySelector('#app .topbar'); if (!barra) return;
    let b = document.getElementById('estado-escritorio');
    if (!b) {
      b = document.createElement('button'); b.type = 'button'; b.id = 'estado-escritorio'; b.className = 'estado-red';
      b.addEventListener('click', () => abrirEstado());
      const ref = document.getElementById('estado-sync'); barra.insertBefore(b, ref || barra.querySelector('.espacio')?.nextSibling || null);
    }
    const hora = ultimo ? new Date(ultimo.fecha).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : null;
    b.classList.toggle('pendiente', !!errorChip || !ultimo);
    b.innerHTML = errorChip ? '⚠️ <span class="txt">Respaldo con error</span>' : `💾 <span class="txt">${hora ? 'Respaldo ' + esc(hora) : 'Sin respaldo en disco'}</span>`;
    b.title = errorChip ? 'El último respaldo en disco falló: ' + errorChip : ultimo ? `Último respaldo en disco: ${ultimo.nombre} (${ultimo.totalRegistros} registros, SHA-256 verificado)${sucio ? ' · hay cambios posteriores' : ''}` : 'Aún no hay respaldos en disco';
    b.setAttribute('aria-label', b.title);
  }

  // ======================================================================================
  // 4. Migración: verificación posterior a la recarga
  // ======================================================================================
  async function verificarMigracion() {
    const p = await E.migracion.pendiente().catch(() => null);
    if (!p) return;
    if (p.estado !== 'importando') { await E.migracion.resultado({ ...p, estado: 'cancelada', nota: 'La restauración no se completó (cancelada en la vista previa de SIAF o con error).' }); return; }
    const obtenido = {}, diferencias = [];
    for (const [c, esperado] of Object.entries(p.conteos || {})) {
      if (!DB.COLECCIONES.includes(c)) continue;
      const n = c === 'fotos' ? await DB.contarFotos() : DB.todos(c).length;
      obtenido[c] = n;
      // la bitácora y la configuración crecen legítimamente al restaurar (registro de la restauración, esquema)
      if (c === 'auditoria' || c === 'config' ? n < esperado : n !== esperado) diferencias.push({ coleccion: c, esperado, obtenido: n });
    }
    const ok = diferencias.length === 0;
    const nombre = await E.migracion.resultado({ ...p, estado: ok ? 'verificada' : 'con-diferencias', verificada: new Date().toISOString(), obtenido, diferencias });
    U.modal({ titulo: ok ? '✅ Migración verificada' : '⚠️ Migración con diferencias', ancho: true, cuerpo: `
      <p>Origen: <b>${esc(p.origen)}</b>${p.sha256 ? ` · SHA-256 ${esc(p.sha256.slice(0, 16))}…` : ''}</p>
      ${ok ? '<p>Todos los registros del respaldo están en SIAF para macOS (identificadores, relaciones y fotografías conservados por la restauración oficial de SIAF).</p>'
        : `<div class="aviso-demo">${diferencias.map(d => `${esc(DB.ETIQUETAS[d.coleccion] || d.coleccion)}: se esperaban ${d.esperado}, hay ${d.obtenido}`).join('<br>')}</div><p class="sub">Los datos anteriores están en el punto de recuperación en disco (Archivo → Restaurar desde un respaldo de la app).</p>`}
      <p class="sub">Informe guardado: Migraciones/${esc(nombre)}. Los datos del navegador original no se modificaron.</p>` });
  }

  // ======================================================================================
  // 5. Comandos de menú
  // ======================================================================================
  async function abrirEstado() {
    const est = navigator.storage && navigator.storage.estimate ? await navigator.storage.estimate().catch(() => null) : null;
    const lista = await E.respaldo.listar().catch(() => []);
    const filas = DB.COLECCIONES.filter(c => c !== 'fotos' && DB.todos(c).length).map(c => `<tr><td>${esc(DB.ETIQUETAS[c] || c)}</td><td class="num">${DB.todos(c).length}</td></tr>`).join('');
    const nf = await DB.contarFotos().catch(() => '?');
    info = await E.info();
    U.modal({ titulo: '💾 Almacenamiento y respaldos', ancho: true, cuerpo: `
      <p><b>Datos de SIAF:</b> base local de la aplicación (IndexedDB en ${esc(info.rutas.datos)}).${est ? ` Uso: ${(est.usage / 1048576).toFixed(1)} MB.` : ''}</p>
      <p><b>Respaldos en disco:</b> ${lista.length} · carpeta ${esc(info.rutas.respaldos)}<br>
      Último: ${ultimo ? `${esc(ultimo.nombre)} (${new Date(ultimo.fecha).toLocaleString('es-CO')}, ${ultimo.totalRegistros} registros, ${(ultimo.bytes / 1048576).toFixed(2)} MB)` : 'ninguno'}${sucio ? ' · <span class="tag warn">hay cambios sin respaldar</span>' : ''}</p>
      <p>Automático: <b>${prefs.respaldoAuto ? `cada ${prefs.intervaloHoras} h si hay cambios` : 'desactivado'}</b> · al salir: <b>${prefs.respaldoAlSalir ? 'sí' : 'no'}</b> · carpeta espejo: <b>${prefs.carpetaEspejo ? esc(prefs.carpetaEspejo) : 'no configurada'}</b></p>
      <div class="tabla-cont"><table class="tabla"><thead><tr><th>Colección</th><th class="num">Registros</th></tr></thead><tbody>${filas}<tr><td>Fotografías</td><td class="num">${nf}</td></tr></tbody></table></div>
      <p class="sub">SIAF ${esc(info.versionSIAF)} · app ${esc(info.versionApp)} · Electron ${esc(info.electron)} · ${esc(info.plataforma)}/${esc(info.arquitectura)}</p>
      <div class="acciones" style="justify-content:flex-end"><button class="btn" data-carpeta>📂 Abrir carpeta</button><button class="btn" data-pref>⚙️ Preferencias</button><button class="btn primario" data-ahora>💾 Respaldar ahora</button></div>` }).el.addEventListener('click', ev => {
      if (ev.target.closest('[data-carpeta]')) E.respaldo.abrirCarpeta();
      if (ev.target.closest('[data-pref]')) comandos.preferencias();
      if (ev.target.closest('[data-ahora]')) comandos['respaldo-manual']();
    });
  }

  const comandos = {
    ir: ({ ruta }) => { if (!sesionLista()) return; if (App.RUTAS.some(r => r[0] === ruta)) App.ir(ruta); },
    imprimir: () => window.print(),
    tema: () => { const r = document.documentElement; const osc = r.dataset.theme === 'dark'; r.dataset.theme = osc ? 'light' : 'dark'; try { localStorage.setItem('siaf_tema', r.dataset.theme); } catch (e) { } },
    buscar: () => { if (sesionLista() && typeof Rapido !== 'undefined') Rapido.buscar(); },
    'deshacer-siaf': () => { if (sesionLista() && typeof Deshacer !== 'undefined') Deshacer.ejecutar(); },
    estado: () => { if (sesionLista()) abrirEstado(); },
    'respaldo-manual': async () => {
      if (!sesionLista()) return toast('Inicie sesión para crear un respaldo.', 'warn');
      if (!Auth.puede('exportar')) return toast('Su rol no permite crear respaldos.', 'error');
      try { const r = await respaldar('manual', 'Respaldo manual'); toast(`💾 Respaldo guardado y verificado: ${r.nombre}`, 'ok'); } catch (e) { toast('No se pudo respaldar: ' + e.message, 'error'); }
    },
    'restaurar-lista': async () => {
      if (!sesionLista()) return;
      if (!Auth.puede('importar')) return toast('Su rol no permite restaurar respaldos.', 'error');
      const lista = await E.respaldo.listar();
      const tipo = { auto: 'Automático', manual: 'Manual', punto: 'Punto de recuperación' };
      const m = U.modal({ titulo: '♻️ Respaldos guardados por la app', ancho: true, cuerpo: lista.length ? `<p class="sub">Elija una copia. SIAF verificará las huellas y mostrará su vista previa antes de reemplazar nada.</p>
        <div class="tabla-cont"><table class="tabla"><thead><tr><th>Fecha</th><th>Tipo</th><th class="num">Registros</th><th class="num">MB</th><th></th></tr></thead><tbody>
        ${lista.map(r => `<tr><td>${esc(new Date(r.fecha).toLocaleString('es-CO'))}<br><span class="sub">${esc(r.nombre)}</span></td><td>${esc(tipo[r.tipo] || r.tipo)}<br><span class="sub">${esc(r.detalle || r.motivo)}</span></td><td class="num">${r.totalRegistros}</td><td class="num">${(r.bytes / 1048576).toFixed(2)}</td>
        <td><button class="btn" data-ver="${esc(r.nombre)}">Verificar</button> <button class="btn peligro" data-res="${esc(r.nombre)}">Restaurar…</button></td></tr>`).join('')}</tbody></table></div>` : '<p>Aún no hay respaldos en disco.</p>' });
      m.el.addEventListener('click', async ev => {
        const v = ev.target.closest('[data-ver]'), r = ev.target.closest('[data-res]');
        if (v) { const x = await E.respaldo.verificar(v.dataset.ver); toast(x.ok ? '✔ Integridad verificada (SHA-256)' : '✖ ' + x.errores.join('; '), x.ok ? 'ok' : 'error'); }
        if (r) {
          try { const bytes = await E.respaldo.leer(r.dataset.res); m.cerrar(); await Respaldo.restaurarArchivo(new File([bytes], r.dataset.res, { type: 'application/zip' })); }
          catch (e) { toast('No se pudo abrir el respaldo: ' + e.message, 'error'); }
        }
      });
    },
    preferencias: async () => {
      if (!sesionLista()) return;
      if (!Auth.puede('importar')) return toast('Solo un administrador puede cambiar las preferencias de respaldo.', 'error');
      const m = U.modal({ titulo: '⚙️ Preferencias de respaldo (macOS)', cuerpo: `
        <form class="form" id="pr-f">
        <label class="chk"><input type="checkbox" name="respaldoAuto" ${prefs.respaldoAuto ? 'checked' : ''}> Respaldo automático en disco cuando haya cambios</label>
        <div class="campo"><label for="pr-h">Intervalo mínimo (horas)</label><input id="pr-h" class="input" type="number" min="1" max="168" name="intervaloHoras" value="${prefs.intervaloHoras}"></div>
        <label class="chk"><input type="checkbox" name="respaldoAlSalir" ${prefs.respaldoAlSalir ? 'checked' : ''}> Respaldar al cerrar SIAF si hubo cambios</label>
        <div class="campo"><label for="pr-ra">Copias automáticas que se conservan</label><input id="pr-ra" class="input" type="number" min="3" max="500" name="retenerAuto" value="${prefs.retenerAuto}"></div>
        <div class="campo"><label for="pr-rp">Puntos de recuperación que se conservan</label><input id="pr-rp" class="input" type="number" min="3" max="500" name="retenerPuntos" value="${prefs.retenerPuntos}"></div>
        <p>Carpeta espejo (regla 3-2-1): <b id="pr-esp">${prefs.carpetaEspejo ? esc(prefs.carpetaEspejo) : 'no configurada'}</b><br>
        <button type="button" class="btn" data-esp>Elegir carpeta…</button> <button type="button" class="btn" data-sinesp>Quitar</button></p>
        <p class="sub">Las copias manuales nunca se borran automáticamente. Los respaldos están fuera del paquete de la aplicación: desinstalar SIAF no los elimina.</p>
        <div class="acciones" style="justify-content:flex-end"><button class="btn primario" type="submit">Guardar</button></div></form>` });
      U.$('[data-esp]', m.el).onclick = async () => { prefs = await E.preferencias.elegirEspejo(); U.$('#pr-esp', m.el).textContent = prefs.carpetaEspejo || 'no configurada'; };
      U.$('[data-sinesp]', m.el).onclick = async () => { prefs = await E.preferencias.guardar({ carpetaEspejo: '' }); U.$('#pr-esp', m.el).textContent = 'no configurada'; };
      U.$('#pr-f', m.el).onsubmit = async ev => {
        ev.preventDefault(); const f = ev.target;
        prefs = await E.preferencias.guardar({ respaldoAuto: f.respaldoAuto.checked, intervaloHoras: +f.intervaloHoras.value, respaldoAlSalir: f.respaldoAlSalir.checked, retenerAuto: +f.retenerAuto.value, retenerPuntos: +f.retenerPuntos.value });
        m.cerrar(); toast('Preferencias guardadas.', 'ok');
      };
    },
    'respaldo-salida': async () => {
      try { if (sucio && dbLista()) await respaldar('salida', 'Al cerrar la aplicación'); } catch (e) { console.warn('Respaldo de salida:', e.message); }
      finally { E.salidaLista(); }
    },
    migrar: async ({ nombre, bytes }) => {
      if (!sesionLista()) { await hasta(sesionLista, 600000); }
      if (!Auth.puede('importar')) { await E.migracion.resultado({ estado: 'rechazada', nota: 'Rol sin permiso de importación' }); return toast('Solo un administrador puede migrar datos (permiso «importar»).', 'error'); }
      await Respaldo.restaurarArchivo(new File([bytes], nombre));
    },
    'grabar-iniciar': () => Grabador.iniciar(),
    'grabar-detener': () => Grabador.detener(),
  };
  E.alComando(msg => { const f = msg && comandos[msg.accion]; if (f) Promise.resolve(f(msg)).catch(e => toast(e.message, 'error')); });

  // ======================================================================================
  // 6. Grabador y reproductor de acciones dentro de SIAF
  // ======================================================================================
  const SENSIBLE = /pin|clave|contrase|password|passwd|frase|token|secret|tarjeta|cvv|cuenta.?banc|iban/i;
  const visible = el => !!(el && el.isConnected && (el.offsetParent !== null || el.getClientRects().length) && getComputedStyle(el).visibility !== 'hidden');
  // Texto visible de un elemento. En campos de formulario NUNCA se usa su valor (podría ser un PIN o un dato
  // personal): se usa la etiqueta asociada o el texto de ayuda.
  const esCampo = el => /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName);
  const etiquetaDe = el => ((el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`)?.textContent) || el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.name || '').replace(/\s+/g, ' ').trim().slice(0, 80);
  const textoDe = el => esCampo(el) ? etiquetaDe(el) : (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80);
  const idEstable = id => !!id && id.length <= 24 && /^[A-Za-z][\w-]*$/.test(id) && (id.replace(/\D/g, '').length < 3);
  const modalAbierto = () => { const ms = document.querySelectorAll('.capa-oscura .modal'); return ms[ms.length - 1] || null; };
  const tituloModal = () => { const m = modalAbierto(); return m ? (m.querySelector('.modal-cab h3')?.textContent || '').trim() : ''; };
  function esSensible(el) {
    if (!el) return false;
    if (el.closest('.login')) return true; // pantalla de ingreso: el teclado numérico del PIN NUNCA se graba
    const tipo = (el.getAttribute('type') || '').toLowerCase(), ac = (el.getAttribute('autocomplete') || '').toLowerCase();
    if (tipo === 'password' || /password|cc-|one-time-code/.test(ac)) return true;
    const lab = el.id ? (document.querySelector(`label[for="${CSS.escape(el.id)}"]`)?.textContent || '') : '';
    return SENSIBLE.test([el.id, el.name, el.getAttribute('aria-label'), el.getAttribute('placeholder'), lab].join(' '));
  }
  function cssDe(el) {
    if (idEstable(el.id)) return '#' + CSS.escape(el.id);
    const partes = []; let n = el;
    while (n && n.nodeType === 1 && n !== document.body) {
      let p = n.tagName.toLowerCase();
      const datos = [...n.attributes].filter(a => a.name.startsWith('data-') && a.name !== 'data-i' && a.value.length < 60 && !/\d{5,}/.test(a.value));
      if (n.getAttribute('name')) p += `[name="${CSS.escape(n.getAttribute('name'))}"]`;
      else if (datos.length) p += `[${datos[0].name}${datos[0].value ? `="${CSS.escape(datos[0].value)}"` : ''}]`;
      else if (n.getAttribute('data-i') != null) p += `[data-i="${CSS.escape(n.getAttribute('data-i'))}"]`;
      partes.unshift(p);
      const sel = partes.join(' > ');
      const raiz = el.closest('.capa-oscura .modal') || document;
      try { if (raiz.querySelectorAll(sel).length === 1) return sel; } catch (e) { }
      if (idEstable(n.parentElement && n.parentElement.id)) { partes.unshift('#' + CSS.escape(n.parentElement.id)); return partes.join(' > '); }
      n = n.parentElement;
      if (partes.length > 6) break;
    }
    return partes.join(' > ');
  }
  function selectorDe(el) {
    return { css: cssDe(el), texto: textoDe(el), etiqueta: el.tagName.toLowerCase(), aria: el.getAttribute('aria-label') || el.getAttribute('title') || '', enModal: !!el.closest('.capa-oscura .modal') };
  }
  const contexto = () => ({ ruta: location.hash.replace(/^#\/?/, ''), modal: tituloModal() });
  const PELIGRO = /eliminar|borrar|restaurar|vender|venta|retirar|dar de baja|anular|pagar|transferir|vaciar|reemplazar|sobrescribir|cerrar sesi/i;

  const Grabador = (() => {
    let activo = false, ultClic = 0, rutaGrabada = null;
    const rutaActual = () => location.hash.replace(/^#\/?/, '').split('?')[0] || 'mapa';
    const enviarCrudo = paso => { E.grabacion.evento({ ...paso, contexto: contexto(), t: Date.now() }); };
    // SIAF cambia de sección con history.replaceState (sin «hashchange»): antes de cada acción se comprueba la
    // sección actual y, si cambió desde el último paso grabado, se graba primero un paso «Ir a sección».
    const enviar = paso => {
      const r = rutaActual();
      if (paso.tipo !== 'navegar' && r !== rutaGrabada) { rutaGrabada = r; enviarCrudo({ tipo: 'navegar', ruta: r }); }
      if (paso.tipo === 'navegar') rutaGrabada = paso.ruta;
      enviarCrudo(paso);
    };
    function clic(ev) {
      if (!activo || !ev.isTrusted) return;
      const el = ev.target.closest('button, a, [role="button"], [data-r], [data-k], tr.clic, img[data-foto], summary, label, [data-id], .pestanas button');
      if (!el || el.closest('.login')) return; // pantalla de ingreso: el teclado del PIN NUNCA se graba (ni el número de pulsaciones)
      if (el.matches('label') && el.querySelector('input')) return; // el cambio del control se graba en «change»
      ultClic = Date.now();
      const sel = selectorDe(el);
      enviar({ tipo: 'clic', selector: sel, destructivo: PELIGRO.test(sel.texto + ' ' + sel.aria) || el.classList.contains('peligro') });
    }
    function cambio(ev) {
      if (!activo || !ev.isTrusted) return;
      const el = ev.target; if (!el.matches('input, select, textarea')) return;
      const tipo = (el.type || '').toLowerCase();
      if (esSensible(el)) { enviar({ tipo: 'campoSensible', selector: selectorDe(el), nota: 'Campo protegido: el valor no se graba. La reproducción se pausará para que lo escriba usted.' }); return; }
      if (tipo === 'file') { enviar({ tipo: 'archivo', selector: selectorDe(el), nota: 'La selección de archivos no se automatiza: la reproducción se pausará para que elija el archivo.' }); return; }
      if (tipo === 'checkbox' || tipo === 'radio') { enviar({ tipo: 'marcar', selector: selectorDe(el), valor: el.checked }); return; }
      if (el.tagName === 'SELECT') { enviar({ tipo: 'seleccionar', selector: selectorDe(el), valor: el.value, textoOpcion: el.selectedOptions[0]?.textContent?.trim() || '' }); return; }
      enviar({ tipo: 'escribir', selector: selectorDe(el), valor: String(el.value).slice(0, 2000) });
    }
    function navegacion() { if (activo && Date.now() - ultClic > 1200 && rutaActual() !== rutaGrabada) enviar({ tipo: 'navegar', ruta: rutaActual() }); }
    function envio(ev) { if (activo && ev.isTrusted && Date.now() - ultClic > 400 && ev.target.matches('form')) enviar({ tipo: 'enviar', selector: selectorDe(ev.target) }); }
    document.addEventListener('click', clic, true);
    document.addEventListener('change', cambio, true);
    document.addEventListener('submit', envio, true);
    addEventListener('hashchange', navegacion);
    return {
      iniciar() { activo = true; rutaGrabada = null; document.documentElement.classList.add('siaf-grabando'); enviar({ tipo: 'navegar', ruta: rutaActual(), inicial: true }); },
      detener() { activo = false; document.documentElement.classList.remove('siaf-grabando'); },
      get activo() { return activo; },
    };
  })();

  // ---------- reproductor (lo invoca el proceso principal con datos JSON; nunca evalúa código recibido) ----------
  function candidatos(sel) {
    const raiz = sel.enModal ? modalAbierto() : document;
    if (!raiz) return [];
    let xs = [];
    if (sel.css) { try { xs = [...raiz.querySelectorAll(sel.css)].filter(visible); } catch (e) { xs = []; } }
    if (xs.length > 1 && sel.texto) { const t = xs.filter(x => textoDe(x) === sel.texto); if (t.length) xs = t; }
    if (!xs.length && sel.texto) xs = [...raiz.querySelectorAll(sel.etiqueta || 'button, a, [role="button"]')].filter(x => visible(x) && textoDe(x) === sel.texto);
    if (!xs.length && sel.aria) xs = [...raiz.querySelectorAll('[aria-label], [title]')].filter(x => visible(x) && (x.getAttribute('aria-label') === sel.aria || x.getAttribute('title') === sel.aria));
    return xs;
  }
  async function localizar(sel, timeoutMs) {
    const t0 = Date.now();
    for (; ;) {
      const xs = candidatos(sel || {});
      if (xs.length) return xs[0];
      if (Date.now() - t0 > timeoutMs) return null;
      await esperar(100);
    }
  }
  const asignar = (el, valor) => {
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : el.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, valor);
    el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const describir = el => el ? { texto: textoDe(el), peligro: el.classList.contains('peligro') || PELIGRO.test(textoDe(el) + ' ' + (el.getAttribute('aria-label') || '')) } : null;

  window.__siafPlayer = Object.freeze({
    estado: () => ({ ruta: location.hash.replace(/^#\/?/, ''), modal: tituloModal(), sesion: sesionLista(), usuario: sesionLista() ? Auth.actual.nombre : null, grabando: Grabador.activo }),
    async inspeccionar(paso, timeoutMs = 4000) {
      if (!paso.selector) return { encontrado: true };
      const el = await localizar(paso.selector, timeoutMs);
      return { encontrado: !!el, ...describir(el) };
    },
    async ejecutar(paso, timeoutMs = 8000) {
      if (!sesionLista()) throw new Error('SIAF no tiene una sesión iniciada.');
      if (paso.tipo === 'navegar') {
        if (!App.RUTAS.some(r => r[0] === paso.ruta)) throw new Error(`Sección desconocida: ${paso.ruta}`);
        App.ir(paso.ruta); await esperar(250); return { ok: true };
      }
      if (paso.tipo === 'validarTexto') {
        const t0 = Date.now();
        for (; ;) {
          const raiz = paso.selector ? await localizar(paso.selector, 300) : document.querySelector('#contenido') || document.body;
          if (raiz && textoDe(raiz).toLowerCase().includes(String(paso.contiene || '').toLowerCase())) return { ok: true };
          if (raiz && (raiz.innerText || '').toLowerCase().includes(String(paso.contiene || '').toLowerCase())) return { ok: true };
          if (Date.now() - t0 > timeoutMs) throw new Error(`Validación fallida: no aparece «${paso.contiene}».`);
          await esperar(150);
        }
      }
      const el = await localizar(paso.selector, timeoutMs);
      if (!el) throw new Error(`La interfaz cambió: no se encontró «${(paso.selector && (paso.selector.texto || paso.selector.aria || paso.selector.css)) || 'elemento'}»${paso.contexto && paso.contexto.modal ? ` en «${paso.contexto.modal}»` : ''}.`);
      if (paso.tipo === 'esperarElemento') return { ok: true };
      if (esSensible(el)) throw new Error('El reproductor no escribe en campos protegidos (PIN, contraseñas, frases de cifrado).');
      el.scrollIntoView({ block: 'center', inline: 'nearest' });
      switch (paso.tipo) {
        case 'clic':
          if (typeof el.click === 'function') el.click(); else el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
          break;
        case 'escribir': el.focus(); asignar(el, String(paso.valor ?? '')); break;
        case 'seleccionar': {
          const ok = [...el.options].some(o => o.value === String(paso.valor));
          if (!ok && paso.textoOpcion) { const o = [...el.options].find(x => x.textContent.trim() === paso.textoOpcion); if (o) { asignar(el, o.value); break; } }
          if (!ok) throw new Error(`La lista no contiene la opción «${paso.textoOpcion || paso.valor}».`);
          asignar(el, String(paso.valor)); break;
        }
        case 'marcar': if (el.checked !== !!paso.valor) el.click(); break;
        case 'enviar': if (el.requestSubmit) el.requestSubmit(); else el.submit(); break;
        default: throw new Error(`Tipo de paso no admitido en SIAF: ${paso.tipo}`);
      }
      return { ok: true };
    },
  });

  // ---------- estilos del modo grabación ----------
  const st = document.createElement('style');
  st.textContent = `html.siaf-grabando body::after{content:'⏺ Grabando acciones en SIAF';position:fixed;left:50%;bottom:12px;transform:translateX(-50%);background:#b42318;color:#fff;padding:.35rem .9rem;border-radius:999px;font:600 13px system-ui;z-index:99999;pointer-events:none;box-shadow:0 2px 8px #0005}
  #estado-escritorio.pendiente{opacity:.9}`;
  document.head.appendChild(st);

  // ======================================================================================
  // Arranque
  // ======================================================================================
  (async () => {
    info = await E.info(); prefs = info.preferencias; ultimo = info.ultimoRespaldo;
    if (!(await hasta(dbLista, 120000))) return;
    await hasta(sesionLista, 24 * 3600000);
    envolverOperacionesDestructivas();
    pintarChip();
    setInterval(() => { if (!document.getElementById('estado-escritorio')) pintarChip(); }, 5000);
    if (info.recuperacion) {
      try { await respaldar('cierre-inesperado', 'Tras un cierre inesperado de la sesión anterior'); toast('La sesión anterior no se cerró correctamente. Sus datos confirmados están intactos y se guardó un punto de recuperación en disco.', 'warn'); }
      catch (e) { toast('No se pudo guardar el punto de recuperación tras el cierre inesperado: ' + e.message, 'error'); }
      E.recuperacionAtendida();
    }
    await verificarMigracion().catch(e => toast('Verificación de migración: ' + e.message, 'error'));
    // copia inicial (primera ejecución o última copia con más de un día)
    if (prefs.respaldoAuto && (!ultimo || Date.now() - Date.parse(ultimo.fecha) > 24 * 3600000)) respaldar('auto', ultimo ? 'Copia diaria' : 'Primera copia en disco').catch(e => console.warn(e));
    setInterval(tick, 60000);
  })().catch(e => E.error('Arranque del puente: ' + e.message));
})();
