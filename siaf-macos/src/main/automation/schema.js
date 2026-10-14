'use strict';
/* Esquema y validación de secuencias de «SIAF Control y Automatización».
   Todo lo que entra (grabación, edición, importación de archivos) pasa por aquí: se conservan solo los campos
   conocidos de cada tipo de paso, con tipos y longitudes acotadas. Una secuencia NO puede contener código
   ejecutable salvo el paso «applescript», que además exige aprobación explícita del usuario por huella SHA-256
   (ver store.js → aprobaciones) y nunca se aprueba al importar. */
const crypto = require('crypto');

const FORMATO = 'siaf-secuencia';
const VERSION = 1;
const MAX_PASOS = 500;

const str = (v, max) => (typeof v === 'string' ? v : v == null ? '' : String(v)).slice(0, max);
const num = (v, min, max, def) => { const n = Number(v); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def; };
const bool = v => v === true;
const BUNDLE = /^[A-Za-z0-9][A-Za-z0-9.-]{1,200}$/;
const RUTA_SIAF = /^[a-z0-9_-]{1,40}$/;
const COMBO = /^((cmd|command|ctrl|control|alt|option|shift|fn)\+)*([a-z0-9]|f([1-9]|1[0-9]|20)|return|enter|tab|space|escape|esc|delete|backspace|up|down|left|right|home|end|pageup|pagedown|[`\-=[\];',./\\])$/i;

function selectorWeb(s) {
  s = s && typeof s === 'object' ? s : {};
  return { css: str(s.css, 600), texto: str(s.texto, 120), etiqueta: /^[a-z][a-z0-9-]{0,20}$/.test(s.etiqueta || '') ? s.etiqueta : '', aria: str(s.aria, 120), enModal: bool(s.enModal) };
}
function selectorAX(s) {
  s = s && typeof s === 'object' ? s : {};
  const ruta = Array.isArray(s.ruta) ? s.ruta.slice(0, 30).map(p => ({ rol: str(p && p.rol, 60), indice: num(p && p.indice, 0, 10000, 0), titulo: str(p && p.titulo, 120) })) : [];
  return { rol: str(s.rol, 60), subrol: str(s.subrol, 60), titulo: str(s.titulo, 200), identificador: str(s.identificador, 200), descripcion: str(s.descripcion, 200), ventana: str(s.ventana, 200), ruta };
}
function contexto(c) {
  c = c && typeof c === 'object' ? c : {};
  return { ruta: str(c.ruta, 60), modal: str(c.modal, 120), app: BUNDLE.test(c.app || '') ? c.app : '', ventana: str(c.ventana, 200) };
}
function comprobacion(c) {
  c = c && typeof c === 'object' ? c : {};
  const tipo = ['elementoExiste', 'textoPresente'].includes(c.tipo) ? c.tipo : 'elementoExiste';
  return { tipo, selector: c.selector ? selectorWeb(c.selector) : undefined, elemento: c.elemento ? selectorAX(c.elemento) : undefined, contiene: str(c.contiene, 300) };
}

/** Campos admitidos por tipo de paso: f(paso original) → campos limpios. `objetivos` indica dónde es válido. */
const TIPOS = {
  // ---- comunes ----
  esperar: { objetivos: ['siaf', 'app'], campos: p => ({ ms: num(p.ms, 0, 600000, 1000) }), etiqueta: 'Pausa' },
  confirmar: { objetivos: ['siaf', 'app'], campos: p => ({ mensaje: str(p.mensaje, 500) || '¿Continuar?' }), etiqueta: 'Pedir confirmación' },
  punto: { objetivos: ['siaf', 'app'], campos: p => ({ etiqueta: str(p.etiqueta, 80) || 'Punto de recuperación' }), etiqueta: 'Punto de recuperación' },
  condicion: { objetivos: ['siaf', 'app'], campos: p => ({ comprobacion: comprobacion(p.comprobacion), siFalla: ['detener', 'saltar', 'continuar'].includes(p.siFalla) ? p.siFalla : 'detener', saltar: num(p.saltar, 1, 100, 1) }), etiqueta: 'Condición' },
  // ---- dentro de SIAF ----
  navegar: { objetivos: ['siaf'], campos: p => ({ ruta: RUTA_SIAF.test(p.ruta || '') ? p.ruta : 'mapa', inicial: bool(p.inicial) }), etiqueta: 'Ir a sección' },
  clic: { objetivos: ['siaf'], campos: p => ({ selector: selectorWeb(p.selector) }), etiqueta: 'Clic' },
  escribir: { objetivos: ['siaf'], campos: p => ({ selector: selectorWeb(p.selector), valor: str(p.valor, 2000) }), etiqueta: 'Escribir' },
  seleccionar: { objetivos: ['siaf'], campos: p => ({ selector: selectorWeb(p.selector), valor: str(p.valor, 300), textoOpcion: str(p.textoOpcion, 200) }), etiqueta: 'Elegir opción' },
  marcar: { objetivos: ['siaf'], campos: p => ({ selector: selectorWeb(p.selector), valor: bool(p.valor) }), etiqueta: 'Marcar casilla' },
  enviar: { objetivos: ['siaf'], campos: p => ({ selector: selectorWeb(p.selector) }), etiqueta: 'Enviar formulario' },
  esperarElemento: { objetivos: ['siaf', 'app'], campos: p => ({ selector: p.selector ? selectorWeb(p.selector) : undefined, elemento: p.elemento ? selectorAX(p.elemento) : undefined }), etiqueta: 'Esperar elemento' },
  validarTexto: { objetivos: ['siaf'], campos: p => ({ selector: p.selector ? selectorWeb(p.selector) : undefined, contiene: str(p.contiene, 300) }), etiqueta: 'Validar texto' },
  campoSensible: { objetivos: ['siaf', 'app'], campos: p => ({ selector: p.selector ? selectorWeb(p.selector) : undefined, nota: str(p.nota, 300) }), etiqueta: 'Campo protegido (manual)' },
  archivo: { objetivos: ['siaf'], campos: p => ({ selector: selectorWeb(p.selector), nota: str(p.nota, 300) }), etiqueta: 'Elegir archivo (manual)' },
  // ---- otras aplicaciones de macOS ----
  abrirApp: { objetivos: ['app'], campos: p => ({ bundleId: BUNDLE.test(p.bundleId || '') ? p.bundleId : '' }), etiqueta: 'Abrir aplicación' },
  activarApp: { objetivos: ['app'], campos: p => ({ bundleId: BUNDLE.test(p.bundleId || '') ? p.bundleId : '' }), etiqueta: 'Traer al frente' },
  pulsar: { objetivos: ['app'], campos: p => ({ elemento: selectorAX(p.elemento) }), etiqueta: 'Pulsar control' },
  escribirTexto: { objetivos: ['app'], campos: p => ({ texto: str(p.texto, 5000), elemento: p.elemento ? selectorAX(p.elemento) : undefined, modo: p.modo === 'teclear' ? 'teclear' : 'valor' }), etiqueta: 'Escribir texto' },
  teclas: { objetivos: ['app'], campos: p => ({ combinacion: COMBO.test(p.combinacion || '') ? p.combinacion.toLowerCase() : '' }), etiqueta: 'Combinación de teclas' },
  menu: { objetivos: ['app'], campos: p => ({ ruta: Array.isArray(p.ruta) ? p.ruta.slice(0, 8).map(x => str(x, 120)).filter(Boolean) : [] }), etiqueta: 'Elegir menú' },
  clicRelativo: { objetivos: ['app'], campos: p => ({ x: num(p.x, 0, 1, 0.5), y: num(p.y, 0, 1, 0.5), boton: p.boton === 'derecho' ? 'derecho' : 'izquierdo', dobles: bool(p.dobles) }), etiqueta: 'Clic por posición (visual)' },
  validarValor: { objetivos: ['app'], campos: p => ({ elemento: selectorAX(p.elemento), contiene: str(p.contiene, 300) }), etiqueta: 'Validar valor' },
  applescript: { objetivos: ['app'], campos: p => { const fuente = str(p.fuente, 20000); return { fuente, hash: sha256(fuente) }; }, etiqueta: 'AppleScript (requiere aprobación)' },
  atajo: { objetivos: ['app', 'siaf'], campos: p => ({ nombre: str(p.nombre, 120) }), etiqueta: 'Ejecutar atajo (Shortcuts)' },
};

const sha256 = t => crypto.createHash('sha256').update(String(t), 'utf8').digest('hex');
const nuevoId = p => p + crypto.randomBytes(6).toString('hex');

function limpiarPaso(p, objetivo) {
  if (!p || typeof p !== 'object') throw new Error('Paso no válido.');
  const def = TIPOS[p.tipo];
  if (!def) throw new Error(`Tipo de paso desconocido: ${str(p.tipo, 40)}`);
  if (!def.objetivos.includes(objetivo)) throw new Error(`El paso «${def.etiqueta}» no es válido para este objetivo.`);
  const campos = def.campos(p);
  for (const k of Object.keys(campos)) if (campos[k] === undefined) delete campos[k];
  return {
    id: /^p[0-9a-f]{12}$/.test(p.id || '') ? p.id : nuevoId('p'),
    tipo: p.tipo,
    descripcion: str(p.descripcion, 300),
    destructivo: bool(p.destructivo),
    reintentoSeguro: bool(p.reintentoSeguro),
    timeoutMs: p.timeoutMs == null ? undefined : num(p.timeoutMs, 200, 300000, 8000),
    contexto: p.contexto ? contexto(p.contexto) : undefined,
    ...campos,
  };
}

function limpiarSecuencia(s, { conservarId = true } = {}) {
  if (!s || typeof s !== 'object') throw new Error('Secuencia no válida.');
  if (s.formato && s.formato !== FORMATO) throw new Error('El archivo no es una secuencia de SIAF.');
  if (s.version && Number(s.version) > VERSION) throw new Error('La secuencia fue creada con una versión más nueva de SIAF.');
  const o = s.objetivo && typeof s.objetivo === 'object' ? s.objetivo : { tipo: 'siaf' };
  const objetivo = o.tipo === 'app' ? { tipo: 'app', bundleId: BUNDLE.test(o.bundleId || '') ? o.bundleId : '', nombreApp: str(o.nombreApp, 120) } : { tipo: 'siaf' };
  if (objetivo.tipo === 'app' && !objetivo.bundleId) throw new Error('Falta el identificador (bundle id) de la aplicación objetivo.');
  const pasos = Array.isArray(s.pasos) ? s.pasos : [];
  if (pasos.length > MAX_PASOS) throw new Error(`Máximo ${MAX_PASOS} pasos por secuencia.`);
  const op = s.opciones && typeof s.opciones === 'object' ? s.opciones : {};
  const ahora = new Date().toISOString();
  const nombre = str(s.nombre, 120).trim();
  if (!nombre) throw new Error('La secuencia necesita un nombre.');
  return {
    formato: FORMATO, version: VERSION,
    id: conservarId && /^s[0-9a-f]{12}$/.test(s.id || '') ? s.id : nuevoId('s'),
    nombre, descripcion: str(s.descripcion, 2000), carpeta: str(s.carpeta, 60).trim(),
    etiquetas: Array.isArray(s.etiquetas) ? s.etiquetas.slice(0, 10).map(x => str(x, 30)).filter(Boolean) : [],
    objetivo,
    opciones: { esperaPasoMs: num(op.esperaPasoMs, 0, 60000, 400), timeoutMs: num(op.timeoutMs, 500, 120000, 8000), reintentos: num(op.reintentos, 0, 5, 2) },
    pasos: pasos.map(p => limpiarPaso(p, objetivo.tipo)),
    creado: typeof s.creado === 'string' ? s.creado.slice(0, 40) : ahora,
    actualizado: ahora,
  };
}

/** Pasos que se pueden repetir sin efectos secundarios (consultas). Los demás solo con reintentoSeguro. */
const IDEMPOTENTES = new Set(['navegar', 'esperarElemento', 'validarTexto', 'validarValor', 'activarApp', 'condicion', 'esperar']);
/** Pasos que requieren intervención manual (nunca se automatizan). */
const MANUALES = new Set(['campoSensible', 'archivo']);
/** Palabras que convierten un paso en «destructivo» aunque no se haya marcado al grabar. */
const PELIGRO = /eliminar|borrar|delete|remove|restaurar|vender|venta|retirar|dar de baja|anular|pagar|pay|transferir|transfer|enviar dinero|send|comprar|buy|purchase|vaciar|empty|reemplazar|replace|sobrescribir|overwrite|formatear|erase|cerrar sesi|sign out|log out/i;

function esDestructivo(p) {
  if (p.destructivo) return true;
  if (p.tipo === 'applescript' || p.tipo === 'atajo') return true; // efecto desconocido: siempre se confirma
  const textos = [p.selector && p.selector.texto, p.selector && p.selector.aria, p.elemento && p.elemento.titulo, p.elemento && p.elemento.descripcion, ...(p.ruta && Array.isArray(p.ruta) ? p.ruta : [])].filter(Boolean).join(' ');
  if (p.tipo === 'teclas' && /^(cmd|command)\+(delete|backspace)$/.test(p.combinacion || '')) return true;
  return PELIGRO.test(textos);
}

function describirPaso(p) {
  const def = TIPOS[p.tipo]; const e = def ? def.etiqueta : p.tipo;
  const obj = (p.selector && (p.selector.texto || p.selector.aria || p.selector.css)) || (p.elemento && (p.elemento.titulo || p.elemento.descripcion || p.elemento.identificador || p.elemento.rol)) || '';
  switch (p.tipo) {
    case 'navegar': return `${e}: ${p.ruta}`;
    case 'escribir': return `${e} «${String(p.valor).slice(0, 40)}» en ${obj}`;
    case 'escribirTexto': return `${e} «${String(p.texto).slice(0, 40)}»${obj ? ' en ' + obj : ''}`;
    case 'seleccionar': return `${e} «${p.textoOpcion || p.valor}» en ${obj}`;
    case 'esperar': return `${e} ${p.ms} ms`;
    case 'teclas': return `${e} ${p.combinacion}`;
    case 'menu': return `${e} ${p.ruta.join(' › ')}`;
    case 'validarTexto': case 'validarValor': return `${e}: contiene «${p.contiene}»`;
    case 'clicRelativo': return `${e} (${Math.round(p.x * 100)} %, ${Math.round(p.y * 100)} %)`;
    case 'atajo': return `${e}: ${p.nombre}`;
    case 'abrirApp': case 'activarApp': return `${e}: ${p.bundleId}`;
    case 'punto': return `${e}: ${p.etiqueta}`;
    case 'confirmar': return `${e}: ${p.mensaje}`;
    default: return obj ? `${e}: ${obj}` : e;
  }
}

module.exports = { FORMATO, VERSION, TIPOS, limpiarPaso, limpiarSecuencia, esDestructivo, describirPaso, IDEMPOTENTES, MANUALES, sha256, nuevoId, BUNDLE, COMBO };
