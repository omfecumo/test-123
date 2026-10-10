#!/usr/bin/env python3
"""Construye SIAFver6.html a partir de SIAFver5.html (que NO se modifica).

Aplica parches mínimos y verificables al código original (cada reemplazo debe
coincidir exactamente una vez; si no, la construcción se detiene) e inserta el
módulo nuevo fuente/siaf6.js y la hoja fuente/siaf6.css.

Uso:  python3 fuente/construir_v6.py        (desde la carpeta siaf/)
"""
import hashlib, pathlib, sys

RAIZ = pathlib.Path(__file__).resolve().parent.parent
ORIG = RAIZ / 'SIAFver5.html'
DEST = RAIZ / 'SIAFver6.html'
html = ORIG.read_text(encoding='utf-8')
log = []

def parche(nombre, viejo, nuevo, veces=1):
    global html
    n = html.count(viejo)
    if n != veces:
        sys.exit(f'ERROR parche «{nombre}»: se esperaban {veces} coincidencias y hay {n}')
    html = html.replace(viejo, nuevo)
    log.append(nombre)

# ---------------------------------------------------------------- util.js
# P1-SEG-01: el título del modal se inserta como TEXTO (antes era HTML sin escapar → XSS almacenado).
parche('U.modal título seguro + accesibilidad',
  """      <div class="modal-cab"><h3>${titulo}</h3><button class="cerrar" aria-label="Cerrar">✕</button></div><div class="modal-cuerpo"></div></div></div>`);
    const c = $('.modal-cuerpo', capa);""",
  """      <div class="modal-cab"><h3></h3><button class="cerrar" aria-label="Cerrar">✕</button></div><div class="modal-cuerpo"></div></div></div>`);
    /* v6: título como texto plano (decodifica entidades ya escapadas y descarta etiquetas) */
    const h3 = $('.modal-cab h3', capa); h3.textContent = textoPlano(titulo); h3.id = uid('mt-'); $('.modal', capa).setAttribute('aria-labelledby', h3.id);
    const focoPrevio = document.activeElement;
    const c = $('.modal-cuerpo', capa);""")
parche('U.modal devuelve el foco al cerrar',
  "const cerrar = () => { capa.remove(); pilaModales.splice(pilaModales.indexOf(capa), 1); alCerrar && alCerrar(); };",
  "const cerrar = () => { capa.remove(); pilaModales.splice(pilaModales.indexOf(capa), 1); try { focoPrevio && focoPrevio.focus && document.contains(focoPrevio) && focoPrevio.focus({ preventScroll: true }); } catch (e) { } alCerrar && alCerrar(); };")
parche('U.confirmar con HTML depurado',
  "const m = modal({ titulo: 'Confirmar', cuerpo: `<p>${texto}</p>",
  "const m = modal({ titulo: 'Confirmar', cuerpo: `<p>${limpiarHTML(texto)}</p>")
parche('U.verImagen solo imágenes data: válidas',
  "function verImagen(src) { modal(",
  "function verImagen(src) { if (!srcSeguro(src)) return toast('Imagen no válida.', 'error'); modal(")
parche('U: funciones de saneamiento',
  "  // ---------- formularios declarativos ----------",
  """  // ---------- v6: saneamiento de texto y HTML (prevención de XSS) ----------
  /** Convierte HTML/entidades en texto plano sin ejecutar nada (DOMParser crea un documento inerte). */
  function textoPlano(s) { s = String(s ?? ''); if (!/[<&]/.test(s)) return s; try { return new DOMParser().parseFromString(s, 'text/html').body.textContent || ''; } catch (e) { return s.replace(/<[^>]*>/g, ''); } }
  const ETQ_PERMITIDAS = new Set(['B', 'STRONG', 'I', 'EM', 'BR', 'SMALL', 'U']);
  /** Conserva solo etiquetas de formato simples, sin atributos; todo lo demás se vuelve texto. */
  function limpiarHTML(s) {
    s = String(s ?? ''); if (!/</.test(s)) return s;
    let doc; try { doc = new DOMParser().parseFromString('<div>' + s + '</div>', 'text/html'); } catch (e) { return esc(s); }
    const rec = n => [...n.childNodes].map(x => x.nodeType === 3 ? esc(x.nodeValue) : x.nodeType === 1 ? (ETQ_PERMITIDAS.has(x.tagName) ? (x.tagName === 'BR' ? '<br>' : `<${x.tagName.toLowerCase()}>${rec(x)}</${x.tagName.toLowerCase()}>`) : rec(x)) : '').join('');
    return rec(doc.body.firstChild || doc.body);
  }
  /** Solo se muestran imágenes incrustadas (data:image/...;base64). Evita inyección por atributos. */
  const srcSeguro = s => typeof s === 'string' && /^data:image\\/(jpeg|jpg|png|webp|gif);base64,[A-Za-z0-9+/=]*$/.test(s);

  // ---------- formularios declarativos ----------""")
parche('U: exporta funciones nuevas',
  "hoyISO, ahoraHora, ahoraISO, aFecha, dias, sumarDias, fecha, fechaHora, edad, mesesEntre, MESES, num, dinero, n, vozDisponible };",
  "hoyISO, ahoraHora, ahoraISO, aFecha, dias, sumarDias, fecha, fechaHora, edad, mesesEntre, MESES, num, dinero, n, vozDisponible, textoPlano, limpiarHTML, srcSeguro };")

# ---------------------------------------------------------------- db.js
# P1-DAT-02: la restauración de un respaldo «sin fotos» borraba todas las fotos del dispositivo.
parche('DB.importar opción conservarFotos',
  """  async function importar(json) {
    if (!json || json.app !== 'SIAF' || !json.datos) throw new Error('El archivo no es un respaldo válido de SIAF.');
    const faltan = ['lotes', 'animales', 'usuarios'].filter(c => !Array.isArray(json.datos[c]));
    if (faltan.length) throw new Error('Respaldo incompleto: faltan ' + faltan.join(', '));
    const t = tx(COLECCIONES, 'readwrite');
    for (const c of COLECCIONES) {
      const s = t.objectStore(c); s.clear();""",
  """  async function importar(json, { conservarFotos = false } = {}) {
    if (!json || json.app !== 'SIAF' || !json.datos) throw new Error('El archivo no es un respaldo válido de SIAF.');
    const faltan = ['lotes', 'animales', 'usuarios'].filter(c => !Array.isArray(json.datos[c]));
    if (faltan.length) throw new Error('Respaldo incompleto: faltan ' + faltan.join(', '));
    const t = tx(COLECCIONES, 'readwrite');
    for (const c of COLECCIONES) {
      if (c === 'fotos' && conservarFotos) continue; // v6: no borrar las fotos actuales si el respaldo no las trae
      const s = t.objectStore(c); s.clear();""")

# ---------------------------------------------------------------- auth.js
parche('Auth: duración de sesión configurable',
  "Date.now() - s.t < 1000 * 60 * 60 * 24 * 14)",
  "Date.now() - s.t < 1000 * 60 * 60 * 24 * ((typeof D !== 'undefined' && +D.param('diasSesion')) || 14))")

# ---------------------------------------------------------------- domain.js
parche('D.PARAM_DEF: diasSesion',
  "aforoAprov: 65, diasRespaldo: 7 };",
  "aforoAprov: 65, diasRespaldo: 7, diasSesion: 14 };")
# P1-CAL-01: los «costos directos» de cultivos se sumaban en Agricultura pero no en Costos/Dashboard.
parche('D.costosDetalle incluye costos directos de cultivos',
  "    for (const a of DB.todos('animales')) if (a.precioCompra) r.push(",
  "    for (const c of DB.todos('cultivos')) if (c.costo) r.push({ fecha: c.fechaSiembra, categoria: 'Cultivos (costos directos)', monto: c.costo, loteId: c.loteId || null, origen: 'Cultivo (costos directos)', desc: `${c.cultivo || ''} ${c.variedad || ''}`.trim(), demo: c.demo }); // v6\n    for (const a of DB.todos('animales')) if (a.precioCompra) r.push(")
parche('D.alertas: configuración y estados de alertas',
  "  function alertas() { return memoizar('alertas', alertasCalc).slice(); }",
  "  function alertas() { const a = memoizar('alertas', alertasCalc).slice(); return typeof AlertasCfg !== 'undefined' ? AlertasCfg.aplicar(a) : a; }\n  function alertasTodas() { return memoizar('alertas', alertasCalc).slice(); } // v6: sin filtrar (incluye pospuestas)")
parche('D.alertasCalc: alertas nuevas v6',
  "    if ((typeof Aforo !== 'undefined')) A.push(...Aforo.alertas());",
  "    if ((typeof Aforo !== 'undefined')) A.push(...Aforo.alertas());\n    if ((typeof Alertas6 !== 'undefined')) { try { A.push(...Alertas6.alertas()); } catch (e) { console.warn('Alertas v6:', e); } }")
parche('D: exporta alertasTodas',
  "stock, estadoStock, movimientoInventario, costosDetalle, costoLote, costoAnimal, alertas, objetivoNombre };",
  "stock, estadoStock, movimientoInventario, costosDetalle, costoLote, costoAnimal, alertas, alertasTodas, objetivoNombre };")

# ---------------------------------------------------------------- app.js
parche('App.fotosHTML: solo imágenes válidas',
  "return fs.length ? `<div class=\"fotos\">${fs.sort((a, b) => b.fecha.localeCompare(a.fecha)).map(f => `<img src=\"${f.dataUrl}\" alt=\"Foto\" data-foto=\"${f.id}\"",
  "const ok = fs.filter(f => U.srcSeguro(f.dataUrl)); return ok.length ? `<div class=\"fotos\">${ok.sort((a, b) => String(b.fecha).localeCompare(String(a.fecha))).map(f => `<img src=\"${f.dataUrl}\" alt=\"Foto\" data-foto=\"${U.esc(f.id)}\"")
parche('App.iniciar: migración versionada v6',
  "      await Auth.asegurarUsuarios();",
  "      if (typeof Migracion !== 'undefined') await Migracion.ejecutar(primera); // v6: esquema versionado + punto de restauración previo\n      await Auth.asegurarUsuarios();")

# ---------------------------------------------------------------- v_dashboard.js
parche('Dashboard: acceso a indicadores con filtros',
  "<div class=\"dash-cab\"><div><h2>Resumen de la finca</h2>",
  "<div class=\"dash-cab\"><div><h2>Resumen de la finca</h2><button class=\"g-link\" data-r=\"indicadores\" style=\"margin-left:0\">Indicadores con filtros y trazabilidad →</button><br>")

# ---------------------------------------------------------------- v_ganado.js
parche('Ganado: foto de ficha segura',
  "${foto ? `<img src=\"${foto.dataUrl}\"",
  "${foto && U.srcSeguro(foto.dataUrl) ? `<img src=\"${foto.dataUrl}\"")
parche('Ganado: pestaña Genealogía y reproducción',
  "['costos', 'Costos', cu => costosAnimal(a, cu)]], pestana);",
  "['costos', 'Costos', cu => costosAnimal(a, cu)], ['genea', 'Genealogía', cu => typeof Genea !== 'undefined' ? Genea.tab(a, cu) : '']], pestana);")
parche('Ganado: ayuda contra doble conteo de costos sanitarios',
  "{ k: 'costo', l: 'Costo del evento ($)', t: 'number', min: 0 },",
  "{ k: 'costo', l: 'Costo del evento ($)', t: 'number', min: 0, ayuda: sanit ? 'Honorarios o servicio. No incluya el producto descontado del inventario: ese consumo ya se costea (cantidad × valor unitario).' : '' },")

# ---------------------------------------------------------------- rapido.js
parche('Sanidad grupal: ayuda contra doble conteo',
  "{ k: 'costoPorAnimal', l: 'Costo por animal ($)', t: 'number', min: 0 },",
  "{ k: 'costoPorAnimal', l: 'Costo por animal ($)', t: 'number', min: 0, ayuda: 'Servicio por animal. Si descuenta del inventario, el producto ya se costea aparte.' },")

# ---------------------------------------------------------------- v_reportes.js
parche('Costos: nota de fuentes actualizada',
  "Los costos se integran automáticamente desde: registros de costo, labores, mantenimientos realizados, eventos sanitarios, compras de animales y consumo de insumos (cantidad × valor unitario).",
  "Los costos se integran automáticamente desde: registros de costo, labores, mantenimientos realizados, eventos sanitarios, compras de animales, costos directos de cultivos, fertilizaciones y consumo de insumos (cantidad × valor unitario). Vea <a href=\"#/finanzas\">Flujo de caja y rentabilidad</a> para la naturaleza de cada costo y posibles duplicados.")

# ---------------------------------------------------------------- v_config.js
parche('Config: exportación con versión e integridad',
  """      const j = await DB.exportar(); if (!conFotos) j.datos.fotos = [];
      U.descargar(`finca_backup_${U.hoyISO()}${conFotos ? '' : '_sin_fotos'}.json`, JSON.stringify(j), 'application/json');""",
  """      await Respaldo.descargar(conFotos); // v6: formato 2 con versión, conteos y huella SHA-256""")
parche('Config: restauración con validación, vista previa y punto de restauración',
  "    U.$('[data-imp]', cu).onclick = async () => {",
  "    U.$('[data-imp]', cu).onclick = async () => { // v6: validación + vista previa + punto de restauración\n      if (!Auth.puede('importar')) return U.toast('Solo el administrador puede restaurar respaldos.', 'error');\n      const f6 = U.$('#imp-f', cu).files[0]; if (!f6) return U.toast('Seleccione el archivo JSON del respaldo.', 'warn');\n      return Respaldo.restaurarArchivo(f6);\n    };\n    const _importarV5 = async () => { // código original v5 conservado como referencia (ya no se usa)")
parche('Config: borrar todo crea punto de restauración',
  "      await DB.borrarTodo(); try { localStorage.removeItem('siaf_sesion'); } catch (e) { } location.reload();",
  "      if (typeof Recuperacion !== 'undefined') await Recuperacion.crear('Antes de «Borrar todo y reiniciar»').catch(() => null);\n      await DB.borrarTodo(); try { localStorage.removeItem('siaf_sesion'); } catch (e) { } location.reload();")
parche('Config: panel de puntos de restauración',
  "      <p class=\"sub\">${est} Los datos se guardan en IndexedDB de este navegador.",
  "      <div class=\"panel\" id=\"cf-puntos\"></div>\n      <p class=\"sub\">${est} Los datos se guardan en IndexedDB de este navegador.")
parche('Config: pinta puntos de restauración',
  "    const exp = async conFotos => {",
  "    if (typeof Recuperacion !== 'undefined') Recuperacion.panel(U.$('#cf-puntos', cu));\n    const exp = async conFotos => {")
parche('Config: pestañas Alertas',
  "['usuarios', 'Usuarios y permisos', usuarios], ['plano', 'Plano', plano], ['acerca', 'Aplicación', acerca]]);",
  "['usuarios', 'Usuarios y permisos', usuarios], ['alertas', 'Alertas', cu => AlertasCfg.panelConfig(cu)], ['plano', 'Plano', plano], ['acerca', 'Aplicación', acerca]]);")
parche('Config: parámetro de sesión',
  "      { k: 'diasRespaldo', l: 'Recordar respaldo cada (días)', t: 'number', min: 1, step: '1' }], p);",
  "      { k: 'diasRespaldo', l: 'Recordar respaldo cada (días)', t: 'number', min: 1, step: '1' },\n      { k: 'diasSesion', l: 'Duración de la sesión sin pedir PIN (días)', t: 'number', min: 1, step: '1', ayuda: 'En equipos compartidos use 1. La protección por PIN es local, no equivale a la seguridad de un servidor.' }], p);")
parche('Config: versión',
  "<p>Versión 1.5 · Aplicación web progresiva 100 % offline.</p>",
  "<p>Versión 6.0 (SIAFver6) · Aplicación web 100 % offline en un solo archivo. Esquema de datos v${(DB.get('config', 'esquema') || {}).v || 5}.</p>")

# ---------------------------------------------------------------- módulo y estilos nuevos
js = (RAIZ / 'fuente' / 'siaf6.js').read_text(encoding='utf-8')
css = (RAIZ / 'fuente' / 'siaf6.css').read_text(encoding='utf-8')
if '</script>' in js: sys.exit('ERROR: siaf6.js no puede contener </script>')
parche('Inserta módulo siaf6.js antes de v_config.js',
  "  <script>/* js/v_config.js */",
  "  <script>/* js/siaf6.js — evolución v6 (seguridad, respaldo, BI, finanzas, alertas, asistente, calidad) */\n" + js + "\n</script>\n  <script>/* js/v_config.js */")
parche('Inserta estilos v6', "</style>\n</head>", "/* ---- v6 ---- */\n" + css + "\n</style>\n</head>")
parche('Marca de versión', '<meta name="author"', '<meta name="generator" content="SIAF v6.0">\n  <meta name="author"')

DEST.write_text(html, encoding='utf-8')
h = hashlib.sha256(DEST.read_bytes()).hexdigest()
print(f'{len(log)} parches aplicados → {DEST.name} ({DEST.stat().st_size:,} bytes, sha256 {h[:16]}…)')
for x in log: print('  ✔', x)
