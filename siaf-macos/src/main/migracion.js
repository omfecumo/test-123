'use strict';
/* Migración de datos desde SIAF HTML (navegador) a SIAF para macOS.
   Los datos del navegador (IndexedDB de Chrome/Safari/Edge) no se leen directamente: cada navegador los guarda
   en un formato interno propio y ligado al origen. El camino verificable es el respaldo oficial de SIAF:
     1. En el navegador: Configuración → Respaldo → «Descargar respaldo ZIP» (con fotos).
     2. En la app: Archivo → Migrar datos desde SIAF (navegador)… → este módulo analiza el archivo SIN modificar
        nada (huellas, conteos, identificadores) y muestra el informe.
     3. SIAF muestra su propia vista previa de restauración (segunda confirmación), crea su punto de
        restauración, y la app crea además un punto de recuperación en disco (Respaldos/SIAF_punto_…zip).
     4. Tras recargar, la app compara los conteos que quedaron en la base con los del archivo y guarda el informe
        en ~/Library/Application Support/SIAF/Migraciones/.
   Los datos originales del navegador no se tocan en ningún momento. */
const fs = require('fs');
const path = require('path');
const { verificarRespaldoZip, sha256 } = require('./zip');
const { escribirAtomico } = require('./config');

const ID_OK = /^[A-Za-z0-9_\-.:]{1,120}$/; // mismo patrón que Respaldo.ID_OK de SIAF
const MAX = 400 * 1024 * 1024;           // mismo límite que Respaldo.restaurarArchivo de SIAF
const ETIQ = { lotes: 'Lotes', animales: 'Animales', eventos: 'Eventos', movimientos: 'Movimientos', insumos: 'Inventario', movinv: 'Mov. inventario', equipos: 'Maquinaria', tareas: 'Tareas', costos: 'Costos', usuarios: 'Usuarios', auditoria: 'Bitácora', fotos: 'Fotografías', lluvias: 'Lluvias', fertilizaciones: 'Fertilizaciones', aforos: 'Aforos', lotesganado: 'Lotes de ganado' };

function analizarJSON(j, R) {
  if (!j || typeof j !== 'object' || Array.isArray(j)) { R.errores.push('El archivo no contiene un objeto JSON.'); return; }
  if (j.siafCifrado || j.siaf8Cifrado) { R.cifrado = true; R.avisos.push('Respaldo cifrado: SIAF pedirá la frase/clave para abrirlo; los conteos se verificarán después de restaurar.'); return; }
  if (j.app !== 'SIAF') R.errores.push('No es un respaldo de SIAF (falta «app: SIAF»).');
  if (!j.datos || typeof j.datos !== 'object') { R.errores.push('El respaldo no contiene la sección «datos».'); return; }
  for (const c of ['lotes', 'animales', 'usuarios']) if (!Array.isArray(j.datos[c])) R.errores.push(`Respaldo incompleto: falta «${c}».`);
  R.exportado = j.exportado || ''; R.versionApp = j.versionApp || '5 o anterior'; R.finca = j.finca || ''; R.formato = j.formato || 1;
  let invalidos = 0, repetidos = 0, refsRotas = 0;
  const ids = {};
  for (const [c, xs] of Object.entries(j.datos)) {
    if (!Array.isArray(xs)) continue;
    const vistos = new Set();
    for (const o of xs) {
      if (!o || typeof o.id !== 'string' || !ID_OK.test(o.id)) { invalidos++; continue; }
      if (vistos.has(o.id)) repetidos++;
      vistos.add(o.id);
    }
    ids[c] = vistos;
    R.conteos[c] = vistos.size;
  }
  // relaciones principales (solo informativo: SIAF conserva el dato aunque la referencia esté rota)
  const comprobar = (c, campo, destino) => { for (const o of j.datos[c] || []) { const v = o && o[campo]; if (v && ids[destino] && !ids[destino].has(v)) refsRotas++; } };
  comprobar('animales', 'loteId', 'lotes'); comprobar('eventos', 'animalId', 'animales');
  R.totalRegistros = Object.values(R.conteos).reduce((s, n) => s + n, 0);
  if (invalidos) R.avisos.push(`${invalidos} registro(s) sin identificador válido: SIAF los descartará.`);
  if (repetidos) R.avisos.push(`${repetidos} identificador(es) repetido(s): SIAF conserva la última versión.`);
  if (refsRotas) R.avisos.push(`${refsRotas} referencia(s) a registros inexistentes (se conservan tal cual).`);
  if (!(j.datos.usuarios || []).some(u => u && u.rol === 'admin' && u.activo !== false)) R.avisos.push('El respaldo no tiene un administrador activo.');
  if (j.integridad && j.integridad.hash) R.integridadDeclarada = true;
  else R.avisos.push('Respaldo sin huella interna (formato antiguo): no se puede comprobar que no haya sido modificado.');
}

/** Analiza un archivo de respaldo sin modificar nada. */
function analizarArchivo(ruta) {
  const st = fs.statSync(ruta);
  if (st.size > MAX) throw new Error('El archivo supera 400 MB; no parece un respaldo de SIAF.');
  const buf = fs.readFileSync(ruta);
  const R = { archivo: path.basename(ruta), bytes: buf.length, sha256: sha256(buf), tipo: '', conteos: {}, totalRegistros: 0, errores: [], avisos: [], cifrado: false };
  if (buf[0] === 0x50 && buf[1] === 0x4b) {
    R.tipo = 'zip';
    const v = verificarRespaldoZip(buf);
    if (!v.ok) { R.errores.push(...v.errores.map(e => 'ZIP: ' + e)); return R; }
    R.avisos.push('Huellas SHA-256 del manifiesto ZIP verificadas.');
    let j; try { j = JSON.parse(v.archivos.get('respaldo.json').toString('utf8')); } catch (e) { R.errores.push('respaldo.json dañado.'); return R; }
    analizarJSON(j, R);
    return R;
  }
  R.tipo = 'json';
  let j; try { j = JSON.parse(buf.toString('utf8')); } catch (e) { R.errores.push('El archivo no es un ZIP ni un JSON válido.'); return R; }
  if (j.siaf8Cifrado || j.siafCifrado) R.tipo = 'cifrado';
  analizarJSON(j, R);
  return R;
}

function textoReporte(R) {
  const lineas = [`Archivo: ${R.archivo} (${(R.bytes / 1048576).toFixed(2)} MB, ${R.tipo.toUpperCase()})`, `SHA-256: ${R.sha256.slice(0, 16)}…`];
  if (R.exportado) lineas.push(`Exportado: ${R.exportado} · SIAF ${R.versionApp}${R.finca ? ' · ' + R.finca : ''}`);
  if (R.totalRegistros) {
    lineas.push('', `Registros: ${R.totalRegistros}`);
    for (const [c, n] of Object.entries(R.conteos)) if (n && (ETIQ[c] || n > 0)) lineas.push(`  • ${ETIQ[c] || c}: ${n}`);
  }
  if (R.errores.length) lineas.push('', 'ERRORES:', ...R.errores.map(e => '  ⛔ ' + e));
  if (R.avisos.length) lineas.push('', 'Avisos:', ...R.avisos.map(e => '  ⚠️ ' + e));
  if (!R.errores.length) lineas.push('', 'Al continuar, SIAF mostrará su vista previa de restauración. Los datos actuales se guardarán antes en un punto de recuperación en disco. Los datos del navegador no se modifican.');
  return lineas.join('\n');
}

function guardarPendiente(dir, datos) {
  fs.mkdirSync(dir, { recursive: true });
  const limpio = { origen: String(datos.origen || '').slice(0, 200), sha256: String(datos.sha256 || '').slice(0, 64), conteos: datos.conteos && typeof datos.conteos === 'object' ? datos.conteos : {}, cifrado: !!datos.cifrado, fecha: datos.fecha || new Date().toISOString(), estado: String(datos.estado || 'enviada').slice(0, 40) };
  escribirAtomico(path.join(dir, 'pendiente.json'), JSON.stringify(limpio, null, 1));
  return limpio;
}
function leerPendiente(dir) {
  try { return JSON.parse(fs.readFileSync(path.join(dir, 'pendiente.json'), 'utf8')); } catch (e) { return null; }
}
function guardarResultado(dir, reporte) {
  fs.mkdirSync(dir, { recursive: true });
  const nombre = `migracion_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  escribirAtomico(path.join(dir, nombre), JSON.stringify(reporte, null, 1));
  fs.rmSync(path.join(dir, 'pendiente.json'), { force: true });
  return nombre;
}

module.exports = { analizarArchivo, analizarJSON, textoReporte, guardarPendiente, leerPendiente, guardarResultado };
