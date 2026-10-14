/* SIAF Control y Automatización — interfaz. Todo el contenido variable se inserta con textContent: una
   secuencia importada no puede inyectar HTML ni scripts en esta ventana. */
'use strict';
const C = window.siafControl;
const $ = (s, r = document) => r.querySelector(s);
function h(tag, attrs = {}, ...hijos) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  for (const x of hijos.flat()) if (x != null && x !== false) el.append(x instanceof Node ? x : document.createTextNode(String(x)));
  return el;
}
let tAviso = null;
function aviso(msg, error = false) {
  const a = $('#aviso'); a.textContent = msg; a.className = 'toast' + (error ? ' error' : '');
  clearTimeout(tAviso); tAviso = setTimeout(() => a.classList.add('oculto'), error ? 8000 : 3500);
}
const intentar = fn => async (...a) => { try { return await fn(...a); } catch (e) { aviso(String(e.message || e).replace(/^Error invoking remote method '[^']+': (Error: )?/, ''), true); } };

let INFO = null, actual = null, sucio = false, lista = [], apps = [], grabados = [], objetivoGrabado = null, ejecutando = null;

// ---------------- pestañas ----------------
function irPestana(p) {
  document.querySelectorAll('.pestanas button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.p === p)));
  document.querySelectorAll('.panel-pest').forEach(s => s.classList.toggle('oculto', s.id !== 'p-' + p));
  if (p === 'historial') pintarHistorial();
  if (p === 'permisos') pintarPermisos();
  if (p === 'grabar') pintarObjetivos();
}
document.querySelector('.pestanas').addEventListener('click', e => { const b = e.target.closest('button[data-p]'); if (b) irPestana(b.dataset.p); });

// ---------------- lista de secuencias ----------------
async function cargarLista() {
  lista = await C.listar();
  const q = $('#buscar').value.trim().toLowerCase();
  const ul = $('#lista-sec'); ul.replaceChildren();
  let grupo = null;
  for (const s of lista.filter(x => !q || (x.nombre + ' ' + x.descripcion + ' ' + x.carpeta).toLowerCase().includes(q))) {
    if ((s.carpeta || '') !== grupo) { grupo = s.carpeta || ''; ul.append(h('li', { class: 'grupo', 'aria-hidden': 'true' }, grupo || 'Sin carpeta')); }
    const li = h('li', { tabindex: '0', role: 'button', class: actual && actual.id === s.id ? 'activo' : '', onclick: () => abrir(s.id), onkeydown: e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrir(s.id); } } },
      h('span', {}, s.nombre), h('span', { class: 'tag' }, s.objetivo.tipo === 'siaf' ? 'SIAF' : (s.objetivo.nombreApp || s.objetivo.bundleId)), h('span', { class: 'sub' }, `${s.pasos} pasos`));
    ul.append(li);
  }
  if (!ul.children.length) ul.append(h('li', { class: 'grupo' }, lista.length ? 'Sin coincidencias' : 'Aún no hay secuencias'));
}
$('#buscar').addEventListener('input', () => cargarLista());

async function abrir(id) {
  if (sucio && actual && !confirm('Hay cambios sin guardar en la secuencia actual. ¿Descartarlos?')) return;
  actual = await C.obtener(id); sucio = false;
  pintarEditor(); cargarLista();
}
function nuevaSecuencia(objetivo = { tipo: 'siaf' }, pasos = [], nombre = 'Nueva secuencia', descripcion = '', carpeta = '') {
  return { nombre, descripcion, carpeta, objetivo, opciones: { esperaPasoMs: 400, timeoutMs: 8000, reintentos: 2 }, pasos };
}
$('#btn-nueva').onclick = intentar(async () => {
  if (sucio && actual && !confirm('Hay cambios sin guardar. ¿Descartarlos?')) return;
  actual = await C.guardar(nuevaSecuencia()); sucio = false; pintarEditor(); cargarLista();
});
$('#btn-importar').onclick = intentar(async () => { const s = await C.importar(); if (s) { aviso(`Secuencia «${s.nombre}» importada. Los AppleScript que contenga deben aprobarse en este Mac.`); actual = s; pintarEditor(); cargarLista(); } });

// ---------------- editor ----------------
function opcionesObjetivo(sel, valor) {
  sel.replaceChildren(h('option', { value: 'siaf' }, 'SIAF (esta aplicación)'));
  for (const a of apps) sel.append(h('option', { value: 'app:' + a.bundleId }, `${a.nombre} (${a.bundleId})`));
  if (valor && valor.tipo === 'app' && !apps.some(a => a.bundleId === valor.bundleId)) sel.append(h('option', { value: 'app:' + valor.bundleId }, `${valor.nombreApp || valor.bundleId} — NO autorizada`));
  sel.value = valor && valor.tipo === 'app' ? 'app:' + valor.bundleId : 'siaf';
}
function pintarEditor() {
  $('#vacio').classList.toggle('oculto', !!actual); $('#editor').classList.toggle('oculto', !actual);
  if (!actual) return;
  const f = $('#editor');
  f.nombre.value = actual.nombre; f.descripcion.value = actual.descripcion || ''; f.carpeta.value = actual.carpeta || '';
  f.esperaPasoMs.value = actual.opciones.esperaPasoMs; f.timeoutMs.value = actual.opciones.timeoutMs; f.reintentos.value = actual.opciones.reintentos;
  opcionesObjetivo(f.objetivo, actual.objetivo);
  f.objetivo.disabled = actual.pasos.length > 0; f.objetivo.title = f.objetivo.disabled ? 'El objetivo no se puede cambiar cuando la secuencia ya tiene pasos.' : '';
  const tipo = actual.objetivo.tipo;
  const sel = $('#nuevo-tipo'); sel.replaceChildren();
  for (const [k, v] of Object.entries(INFO.tipos)) if (v.objetivos.includes(tipo)) sel.append(h('option', { value: k }, v.etiqueta));
  pintarPasos();
  $('#edicion-paso').classList.add('oculto');
}
function leerEditor() {
  const f = $('#editor');
  actual.nombre = f.nombre.value; actual.descripcion = f.descripcion.value; actual.carpeta = f.carpeta.value;
  actual.opciones = { esperaPasoMs: +f.esperaPasoMs.value, timeoutMs: +f.timeoutMs.value, reintentos: +f.reintentos.value };
  if (!f.objetivo.disabled) {
    const v = f.objetivo.value;
    if (v === 'siaf') actual.objetivo = { tipo: 'siaf' };
    else { const a = apps.find(x => 'app:' + x.bundleId === v); actual.objetivo = { tipo: 'app', bundleId: a.bundleId, nombreApp: a.nombre }; }
  }
}
$('#editor').addEventListener('input', () => { sucio = true; });
$('#editor').addEventListener('change', e => { if (e.target.name === 'objetivo') { leerEditor(); pintarEditor(); sucio = true; } });
$('#editor').addEventListener('submit', intentar(async e => { e.preventDefault(); await guardar(); aviso('Secuencia guardada.'); }));
async function guardar() { leerEditor(); actual = await C.guardar(actual); sucio = false; pintarEditor(); await cargarLista(); return actual; }

async function pintarPasos() {
  const tb = $('#pasos'); tb.replaceChildren();
  for (let i = 0; i < actual.pasos.length; i++) {
    const p = actual.pasos[i];
    let desc; try { desc = await C.describir(p, actual.objetivo.tipo); } catch (e) { desc = p.tipo + ' (no válido: ' + e.message + ')'; }
    const extra = [];
    if (p.tipo === 'applescript') { const ok = await C.aprobado(p.hash); extra.push(h('span', { class: 'tag ' + (ok ? 'ok' : 'peligro') }, ok ? 'aprobado' : 'sin aprobar')); }
    if (['campoSensible', 'archivo'].includes(p.tipo)) extra.push(h('span', { class: 'tag' }, 'manual'));
    const mover = (d) => () => { const j = i + d; if (j < 0 || j >= actual.pasos.length) return; [actual.pasos[i], actual.pasos[j]] = [actual.pasos[j], actual.pasos[i]]; sucio = true; pintarPasos(); };
    tb.append(h('tr', { 'data-i': i },
      h('td', {}, String(i + 1)),
      h('td', {}, desc, ' ', ...extra, p.descripcion ? h('div', { class: 'sub' }, p.descripcion) : null),
      h('td', {}, h('input', { type: 'checkbox', 'aria-label': 'Pedir confirmación', checked: p.destructivo, onchange: e => { p.destructivo = e.target.checked; sucio = true; } })),
      h('td', {}, h('input', { type: 'checkbox', 'aria-label': 'Reintento seguro', checked: p.reintentoSeguro, onchange: e => { p.reintentoSeguro = e.target.checked; sucio = true; } })),
      h('td', {},
        h('button', { type: 'button', class: 'btn mini', title: 'Subir', 'aria-label': 'Subir paso', onclick: mover(-1) }, '↑'),
        h('button', { type: 'button', class: 'btn mini', title: 'Bajar', 'aria-label': 'Bajar paso', onclick: mover(1) }, '↓'),
        h('button', { type: 'button', class: 'btn mini', onclick: () => editarPaso(i) }, 'Editar'),
        h('button', { type: 'button', class: 'btn mini', onclick: () => { actual.pasos.splice(i + 1, 0, { ...structuredClone(p), id: undefined }); sucio = true; pintarPasos(); } }, 'Duplicar'),
        p.tipo === 'applescript' ? h('button', { type: 'button', class: 'btn mini', onclick: intentar(async () => { if (sucio) await guardar(); if (await C.aprobarScript(actual.id, actual.pasos[i].id)) aviso('AppleScript aprobado en este Mac.'); pintarPasos(); }) }, 'Revisar y aprobar') : null,
        h('button', { type: 'button', class: 'btn mini peligro-suave', onclick: () => { actual.pasos.splice(i, 1); sucio = true; pintarPasos(); } }, 'Quitar'))));
  }
  if (!actual.pasos.length) tb.append(h('tr', {}, h('td', { colspan: '5', class: 'sub' }, 'Sin pasos. Grabe acciones o añada pasos manualmente.')));
}

// campos editables por tipo (los selectores grabados se editan como texto/CSS)
const CAMPOS = {
  esperar: [['ms', 'Milisegundos', 'number']], confirmar: [['mensaje', 'Mensaje']], punto: [['etiqueta', 'Etiqueta']],
  navegar: [['ruta', 'Sección (mapa, ganado, lotes, inventario, tareas, reportes, configuracion…)']],
  clic: [['selector.texto', 'Texto del botón'], ['selector.css', 'Selector CSS']], escribir: [['selector.css', 'Selector CSS'], ['valor', 'Valor']],
  seleccionar: [['selector.css', 'Selector CSS'], ['valor', 'Valor'], ['textoOpcion', 'Texto de la opción']], marcar: [['selector.css', 'Selector CSS']],
  enviar: [['selector.css', 'Selector CSS del formulario']], esperarElemento: [['selector.css', 'Selector CSS (SIAF)'], ['selector.texto', 'Texto (SIAF)'], ['elemento.titulo', 'Título del control (app)'], ['elemento.rol', 'Rol AX (app)']],
  validarTexto: [['contiene', 'Debe contener']], campoSensible: [['nota', 'Instrucción para el usuario']], archivo: [['nota', 'Instrucción para el usuario']],
  abrirApp: [['bundleId', 'Bundle id']], activarApp: [['bundleId', 'Bundle id']],
  pulsar: [['elemento.titulo', 'Título del control'], ['elemento.rol', 'Rol AX'], ['elemento.identificador', 'Identificador AX'], ['elemento.descripcion', 'Descripción AX']],
  escribirTexto: [['texto', 'Texto'], ['elemento.titulo', 'Título del campo (vacío = campo con foco)'], ['modo', 'Modo (valor | teclear)']],
  teclas: [['combinacion', 'Combinación (p. ej. cmd+s)']], menu: [['ruta', 'Ruta del menú separada por › (p. ej. Archivo › Guardar)']],
  clicRelativo: [['x', 'X (0–1 del ancho de la ventana)', 'number'], ['y', 'Y (0–1 del alto)', 'number']],
  validarValor: [['elemento.titulo', 'Título del control'], ['contiene', 'Debe contener']],
  applescript: [['fuente', 'Código AppleScript (requiere aprobación)', 'textarea']], atajo: [['nombre', 'Nombre del atajo']],
  condicion: [['comprobacion.tipo', 'Comprobación (elementoExiste | textoPresente)'], ['comprobacion.contiene', 'Texto'], ['comprobacion.selector.css', 'Selector CSS (SIAF)'], ['comprobacion.elemento.titulo', 'Título del control (app)'], ['siFalla', 'Si falla (detener | saltar | continuar)'], ['saltar', 'Pasos a saltar', 'number']],
};
const leerRuta = (o, r) => r.split('.').reduce((x, k) => (x == null ? undefined : x[k]), o);
function ponerRuta(o, r, v) { const ks = r.split('.'); let x = o; for (const k of ks.slice(0, -1)) { if (x[k] == null || typeof x[k] !== 'object') x[k] = {}; x = x[k]; } x[ks[ks.length - 1]] = v; }
function editarPaso(i) {
  const p = actual.pasos[i]; const cont = $('#edicion-paso'); cont.classList.remove('oculto'); cont.replaceChildren();
  cont.append(h('h2', {}, `Editar paso ${i + 1} (${INFO.tipos[p.tipo]?.etiqueta || p.tipo})`));
  const campos = [...(CAMPOS[p.tipo] || []), ['descripcion', 'Nota descriptiva (opcional)']];
  const inputs = [];
  for (const [ruta, et, tipo] of campos) {
    let v = leerRuta(p, ruta); if (ruta === 'ruta' && Array.isArray(v)) v = v.join(' › ');
    const inp = tipo === 'textarea' ? h('textarea', { rows: '8' }) : h('input', { type: tipo || 'text', step: tipo === 'number' ? 'any' : null });
    inp.value = v == null ? '' : v; inputs.push([ruta, inp, tipo]);
    cont.append(h('label', {}, et, inp));
  }
  cont.append(h('div', { class: 'barra' },
    h('button', { type: 'button', class: 'btn primario', onclick: () => {
      for (const [ruta, inp, tipo] of inputs) {
        let v = tipo === 'number' ? Number(inp.value) : inp.value;
        if (ruta === 'ruta' && p.tipo === 'menu') v = String(v).split(/\s*[›>]\s*/).filter(Boolean);
        ponerRuta(p, ruta, v);
      }
      sucio = true; cont.classList.add('oculto'); pintarPasos(); aviso('Paso actualizado. Recuerde «Guardar».');
    } }, 'Aplicar'),
    h('button', { type: 'button', class: 'btn', onclick: () => cont.classList.add('oculto') }, 'Cancelar')));
  cont.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
$('#btn-anadir').onclick = () => {
  const tipo = $('#nuevo-tipo').value; if (!tipo) return;
  const p = { tipo };
  if (tipo === 'esperar') p.ms = 1000;
  if (tipo === 'activarApp' || tipo === 'abrirApp') p.bundleId = actual.objetivo.bundleId;
  if (tipo === 'navegar') p.ruta = 'mapa';
  actual.pasos.push(p); sucio = true; pintarPasos().then(() => editarPaso(actual.pasos.length - 1));
};
$('#btn-duplicar').onclick = intentar(async () => { if (sucio) await guardar(); actual = await C.duplicar(actual.id); pintarEditor(); cargarLista(); aviso('Secuencia duplicada.'); });
$('#btn-exportar').onclick = intentar(async () => { if (sucio) await guardar(); if (await C.exportar(actual.id)) aviso('Secuencia exportada.'); });
$('#btn-eliminar').onclick = intentar(async () => { if (await C.eliminar(actual.id)) { actual = null; sucio = false; pintarEditor(); cargarLista(); aviso('Secuencia eliminada (se conserva una copia en «eliminadas»).'); } });

// ---------------- ejecución ----------------
async function lanzar(modo, desde = 0) {
  if (sucio) await guardar();
  $('#ej-registro').replaceChildren(); $('#ejecucion').classList.remove('oculto');
  ejecutando = await C.ejecutar(actual.id, { modo, desde });
  pintarEjecucion(ejecutando);
}
$('#btn-ejecutar').onclick = intentar(() => lanzar('auto'));
$('#btn-paso').onclick = intentar(() => lanzar('pasoAPaso'));
$('#btn-desde').onclick = intentar(async () => {
  const puntos = actual.pasos.map((p, i) => [p, i]).filter(([p]) => p.tipo === 'punto');
  if (!puntos.length) return aviso('La secuencia no tiene puntos de recuperación. Añada uno con «Punto de recuperación».', true);
  const hist = (await C.historial()).find(x => x.secuenciaId === actual.id && x.ultimoPunto);
  const sel = h('select', { 'aria-label': 'Punto de recuperación' }, puntos.map(([p, i]) => h('option', { value: String(i) }, `Paso ${i + 1}: ${p.etiqueta}`)));
  if (hist) sel.value = String(hist.ultimoPunto.indice);
  const cont = $('#edicion-paso'); cont.classList.remove('oculto');
  cont.replaceChildren(h('h2', {}, 'Reanudar desde un punto de recuperación'), hist ? h('p', { class: 'sub' }, `La última ejecución alcanzó «${hist.ultimoPunto.etiqueta}».`) : null, h('label', {}, 'Punto', sel),
    h('div', { class: 'barra' }, h('button', { type: 'button', class: 'btn primario', onclick: intentar(async () => { cont.classList.add('oculto'); await lanzar('auto', Number(sel.value)); }) }, '▶ Reanudar'), h('button', { type: 'button', class: 'btn', onclick: () => cont.classList.add('oculto') }, 'Cancelar')));
});
$('#btn-pausar').onclick = () => C.pausar();
$('#btn-continuar').onclick = () => C.continuar();
$('#btn-siguiente').onclick = () => C.avanzar();
$('#btn-detener').onclick = () => C.detener();
$('#btn-detener-global').onclick = () => C.detener();
$('#btn-manual-ok').onclick = () => { $('#ej-manual').classList.add('oculto'); C.manual(true); };
$('#btn-manual-no').onclick = () => { $('#ej-manual').classList.add('oculto'); C.manual(false); };

const ESTADOS = { preparada: 'Preparada', ejecutando: 'Ejecutando', pausada: 'En pausa', deteniendo: 'Deteniendo…', completada: '✅ Completada', detenida: '■ Detenida', error: '⛔ Error' };
function pintarEjecucion(r) {
  if (!r) return;
  $('#ej-estado').textContent = `${ESTADOS[r.estado] || r.estado} — «${r.nombre}» (${r.modo === 'pasoAPaso' ? 'paso a paso' : 'automático'})${r.error ? ' · ' + r.error : ''}`;
  $('#ej-progreso').max = r.total || 1; $('#ej-progreso').value = r.pasosOk;
  const activa = ['ejecutando', 'pausada', 'deteniendo', 'preparada'].includes(r.estado);
  $('#btn-pausar').disabled = r.estado !== 'ejecutando'; $('#btn-continuar').disabled = r.estado !== 'pausada';
  $('#btn-siguiente').disabled = !activa || r.modo !== 'pasoAPaso'; $('#btn-detener').disabled = !activa;
  ['#btn-ejecutar', '#btn-paso', '#btn-desde'].forEach(s => { $(s).disabled = activa; });
  estadoGlobal(activa ? 'ejecutando' : null);
}
function estadoGlobal(modo) {
  const e = $('#estado');
  e.className = 'pill ' + (modo || '');
  e.textContent = modo === 'grabando' ? '⏺ Grabando' : modo === 'ejecutando' ? '▶ Ejecutando' : 'Inactivo';
}

// ---------------- grabación ----------------
function pintarObjetivos() {
  const sel = $('#grab-objetivo'); const v = sel.value;
  opcionesObjetivo(sel, null); if (v) sel.value = v;
  $('#grab-teclado').disabled = sel.value === 'siaf';
}
$('#grab-objetivo').addEventListener('change', () => { $('#grab-teclado').disabled = $('#grab-objetivo').value === 'siaf'; });
$('#btn-grabar').onclick = intentar(async () => {
  const v = $('#grab-objetivo').value;
  const objetivo = v === 'siaf' ? { tipo: 'siaf' } : (() => { const a = apps.find(x => 'app:' + x.bundleId === v); return { tipo: 'app', bundleId: a.bundleId, nombreApp: a.nombre }; })();
  grabados = []; $('#grab-pasos').replaceChildren(); $('#grab-guardar').classList.add('oculto');
  await C.grabar(objetivo, { teclado: $('#grab-teclado').checked });
  objetivoGrabado = objetivo;
  $('#btn-grabar').disabled = true; $('#btn-grabar-fin').disabled = false; estadoGlobal('grabando');
  aviso(objetivo.tipo === 'siaf' ? 'Grabando: realice las acciones en la ventana de SIAF.' : `Grabando acciones en ${objetivo.nombreApp}.`);
});
$('#btn-grabar-fin').onclick = intentar(async () => {
  const r = await C.detenerGrabacion();
  $('#btn-grabar').disabled = false; $('#btn-grabar-fin').disabled = true; estadoGlobal(null);
  grabados = r.pasos || []; objetivoGrabado = r.objetivo || objetivoGrabado;
  $('#grab-guardar').classList.toggle('oculto', !grabados.length);
  $('#grab-n').textContent = `(${grabados.length})`;
  if (!grabados.length) aviso('No se grabó ningún paso.');
});
$('#btn-grab-guardar').onclick = intentar(async () => {
  const s = await C.guardar(nuevaSecuencia(objetivoGrabado, grabados, $('#grab-nombre').value.trim() || 'Secuencia grabada ' + new Date().toLocaleString('es-CO'), $('#grab-desc').value, $('#grab-carpeta').value));
  grabados = []; $('#grab-pasos').replaceChildren(); $('#grab-guardar').classList.add('oculto'); $('#grab-n').textContent = '';
  actual = s; sucio = false; irPestana('secuencias'); pintarEditor(); cargarLista(); aviso('Secuencia guardada. Revise los pasos antes de ejecutarla.');
});
$('#btn-grab-descartar').onclick = () => { if (confirm('¿Descartar los pasos grabados?')) { grabados = []; $('#grab-pasos').replaceChildren(); $('#grab-guardar').classList.add('oculto'); $('#grab-n').textContent = ''; } };

// ---------------- historial ----------------
async function pintarHistorial() {
  const tb = $('#historial'); tb.replaceChildren();
  for (const x of await C.historial()) {
    tb.append(h('tr', {}, h('td', {}, new Date(x.inicio).toLocaleString('es-CO')), h('td', {}, x.nombre), h('td', {}, x.objetivo?.tipo === 'siaf' ? 'SIAF' : (x.objetivo?.nombreApp || x.objetivo?.bundleId || '')),
      h('td', {}, x.modo === 'pasoAPaso' ? 'Paso a paso' : 'Automático'), h('td', {}, h('span', { class: 'tag ' + (x.estado === 'completada' ? 'ok' : x.estado === 'error' ? 'peligro' : '') }, ESTADOS[x.estado] || x.estado)),
      h('td', {}, `${x.pasosOk}/${x.total}`), h('td', { class: 'sub' }, x.error || (x.ultimoPunto ? `Último punto: ${x.ultimoPunto.etiqueta}` : ''))));
  }
  if (!tb.children.length) tb.append(h('tr', {}, h('td', { colspan: '7', class: 'sub' }, 'Sin ejecuciones registradas.')));
}

// ---------------- permisos y aplicaciones ----------------
async function pintarPermisos() {
  const p = await C.permisos(); const tb = $('#permisos'); tb.replaceChildren();
  const fila = (nombre, estado, para, botones) => tb.append(h('tr', {}, h('td', {}, h('b', {}, nombre), h('div', { class: 'sub' }, para)), h('td', {}, estado), h('td', {}, ...botones)));
  const est = v => v === true || v === 'granted' ? h('span', { class: 'tag ok' }, 'Concedido') : v === null || v === undefined ? h('span', { class: 'tag' }, 'No aplica / desconocido') : h('span', { class: 'tag peligro' }, 'No concedido');
  const mac = p.plataforma === 'darwin';
  fila('Accesibilidad', est(p.accesibilidad), 'Necesario para leer y pulsar controles de otras apps, enviar teclas y grabar clics.', mac ? [h('button', { class: 'btn', onclick: intentar(async () => { await C.pedirAccesibilidad(); setTimeout(pintarPermisos, 1500); }) }, 'Solicitar'), h('button', { class: 'btn', onclick: intentar(() => C.abrirAjustes('accesibilidad')) }, 'Abrir Ajustes')] : []);
  fila('Monitorización de entrada', est(p.monitorEntrada), 'Solo para grabar el TECLADO en otras apps. No es necesario para reproducir ni para grabar clics.', mac ? [h('button', { class: 'btn', onclick: intentar(async () => { await C.pedirMonitor(); setTimeout(pintarPermisos, 1500); }) }, 'Solicitar'), h('button', { class: 'btn', onclick: intentar(() => C.abrirAjustes('monitorEntrada')) }, 'Abrir Ajustes')] : []);
  fila('Automatización (Apple Events)', h('span', { class: 'tag' }, 'Se pide por app'), 'macOS lo solicita la primera vez que un paso AppleScript controla una app. Solo para pasos AppleScript.', mac ? [h('button', { class: 'btn', onclick: intentar(() => C.abrirAjustes('automatizacion')) }, 'Abrir Ajustes')] : []);
  fila('Grabación de pantalla', h('span', { class: 'tag' }, 'No se usa'), 'SIAF no captura la pantalla. El clic por posición usa coordenadas relativas a la ventana y no requiere este permiso.', []);
  fila('Auxiliar nativo', p.auxiliar.ok ? h('span', { class: 'tag ok' }, 'Disponible') : h('span', { class: 'tag peligro' }, 'No disponible'), p.auxiliar.ok ? 'siaf-automator incluido en la aplicación.' : p.auxiliar.motivo, []);
  $('#permisos-nota').textContent = p.nota || 'Tras conceder un permiso en Ajustes del Sistema, vuelva a esta pestaña: el estado se actualiza solo. Si macOS no refleja el cambio, cierre y vuelva a abrir SIAF.';
  await pintarApps();
}
async function pintarApps() {
  apps = await C.apps();
  const ul = $('#apps'); ul.replaceChildren();
  for (const a of apps) ul.append(h('li', {}, h('span', {}, a.nombre, ' ', h('code', {}, a.bundleId)), h('button', { class: 'btn mini peligro-suave', onclick: intentar(async () => { apps = await C.revocarApp(a.bundleId); pintarApps(); }) }, 'Revocar')));
  if (!apps.length) ul.append(h('li', { class: 'grupo' }, 'Ninguna aplicación autorizada.'));
  const sel = $('#apps-abiertas'); sel.replaceChildren(h('option', { value: '' }, '— o elija una abierta —'));
  try { for (const x of await C.appsEnEjecucion()) sel.append(h('option', { value: x.bundleId, 'data-n': x.nombre }, `${x.nombre} (${x.bundleId})`)); } catch (e) { }
}
$('#btn-autorizar').onclick = intentar(async () => { apps = await C.autorizarApp(); pintarApps(); });
$('#apps-abiertas').onchange = intentar(async e => { const o = e.target.selectedOptions[0]; if (!o.value) return; apps = await C.autorizarApp(o.value, o.dataset.n); pintarApps(); });
window.addEventListener('focus', () => { if (!$('#p-permisos').classList.contains('oculto')) pintarPermisos(); });

// ---------------- eventos del proceso principal ----------------
C.alEvento(async ev => {
  switch (ev.tipo) {
    case 'pestana': irPestana(ev.pestana); break;
    case 'grabacion': estadoGlobal(ev.activa ? 'grabando' : null); if (ev.activa && ev.pasos) { for (const x of ev.pasos) { grabados.push(x.paso); $('#grab-pasos').append(h('li', {}, x.descripcion)); } } break;
    case 'pasoGrabado':
      if (ev.reemplaza && grabados.length) { grabados[grabados.length - 1] = ev.paso; $('#grab-pasos').lastChild.textContent = ev.descripcion; }
      else { grabados.push(ev.paso); $('#grab-pasos').append(h('li', {}, ev.descripcion)); }
      $('#grab-n').textContent = `(${grabados.length})`; break;
    case 'estado': ejecutando = ev.datos; pintarEjecucion(ev.datos); if (['completada', 'detenida', 'error'].includes(ev.datos.estado)) { $('#ej-manual').classList.add('oculto'); } break;
    case 'paso': $('#ej-paso').textContent = `Paso ${ev.datos.indice + 1} de ${ev.datos.total}: ${ev.datos.descripcion}`; document.querySelectorAll('#pasos tr').forEach(tr => tr.classList.toggle('actual', +tr.dataset.i === ev.datos.indice)); break;
    case 'pasoTerminado': $('#ej-registro').append(h('li', { class: ev.datos.resultado === 'ok' ? 'ok' : 'error' }, `${ev.datos.indice + 1}. ${ev.datos.descripcion} — ${ev.datos.resultado}${ev.datos.detalle ? ' (' + ev.datos.detalle + ')' : ''}`)); break;
    case 'reintento': $('#ej-registro').append(h('li', {}, `Reintento ${ev.datos.intento} del paso ${ev.datos.indice + 1}: ${ev.datos.error}`)); break;
    case 'esperandoAvance': $('#ej-paso').textContent = `Listo para el paso ${ev.datos.indice + 1}. Pulse «Siguiente paso».`; break;
    case 'manual': $('#ej-manual').classList.remove('oculto'); $('#ej-manual-txt').textContent = `${ev.descripcion}: ${ev.texto}`; break;
    default: break;
  }
});

// ---------------- arranque ----------------
(async () => {
  INFO = await C.info();
  apps = await C.apps();
  await cargarLista();
  pintarObjetivos();
  if (INFO.ejecutando) { $('#ejecucion').classList.remove('oculto'); pintarEjecucion(INFO.ejecutando); }
  if (INFO.grabando) { estadoGlobal('grabando'); $('#btn-grabar').disabled = true; $('#btn-grabar-fin').disabled = false; }
  const p = location.hash.replace('#', ''); if (p) irPestana(p);
})().catch(e => aviso(e.message, true));
