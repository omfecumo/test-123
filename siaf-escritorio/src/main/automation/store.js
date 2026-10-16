'use strict';
/* Almacenamiento local de la automatización: ~/Library/Application Support/SIAF/Automatizacion/
     secuencias/<id>.json     una secuencia por archivo (escritura atómica)
     historial.jsonl          una línea por ejecución (sin valores escritos ni textos de la pantalla)
     apps.json                aplicaciones autorizadas por el usuario
     aprobaciones.json        huellas SHA-256 de AppleScript aprobados por el usuario en ESTE equipo */
const fs = require('fs');
const path = require('path');
const { limpiarSecuencia, BUNDLE } = require('./schema');
const { escribirAtomico } = require('../config');

class Almacen {
  constructor(dir) {
    this.dir = dir;
    this.dirSec = path.join(dir, 'secuencias');
    fs.mkdirSync(this.dirSec, { recursive: true });
  }
  _ruta(id) { if (!/^s[0-9a-f]{12}$/.test(id || '')) throw new Error('Identificador de secuencia no válido.'); return path.join(this.dirSec, id + '.json'); }
  _json(nombre, def) { try { return JSON.parse(fs.readFileSync(path.join(this.dir, nombre), 'utf8')); } catch (e) { return def; } }
  _guardarJson(nombre, datos) { escribirAtomico(path.join(this.dir, nombre), JSON.stringify(datos, null, 1)); }

  listar() {
    const r = [];
    for (const f of fs.readdirSync(this.dirSec)) {
      if (!/^s[0-9a-f]{12}\.json$/.test(f)) continue;
      try {
        const s = JSON.parse(fs.readFileSync(path.join(this.dirSec, f), 'utf8'));
        r.push({ id: s.id, nombre: s.nombre, descripcion: s.descripcion, carpeta: s.carpeta, etiquetas: s.etiquetas, objetivo: s.objetivo, pasos: s.pasos.length, actualizado: s.actualizado });
      } catch (e) { /* archivo dañado: se omite de la lista, no se borra */ }
    }
    return r.sort((a, b) => (a.carpeta || '').localeCompare(b.carpeta || '') || a.nombre.localeCompare(b.nombre));
  }
  obtener(id) { return limpiarSecuencia(JSON.parse(fs.readFileSync(this._ruta(id), 'utf8'))); }
  guardar(s) {
    const limpia = limpiarSecuencia(s);
    try { limpia.creado = this.obtener(limpia.id).creado; } catch (e) { /* nueva */ }
    escribirAtomico(this._ruta(limpia.id), JSON.stringify(limpia, null, 1));
    return limpia;
  }
  eliminar(id) {
    // se mueve a una subcarpeta «eliminadas» en vez de borrarse definitivamente
    const papelera = path.join(this.dir, 'eliminadas'); fs.mkdirSync(papelera, { recursive: true });
    fs.renameSync(this._ruta(id), path.join(papelera, `${id}_${Date.now()}.json`));
    return true;
  }
  duplicar(id) {
    const s = this.obtener(id);
    return this.guardar({ ...s, id: undefined, nombre: (s.nombre + ' (copia)').slice(0, 120), creado: undefined });
  }
  importarTexto(texto) {
    let j; try { j = JSON.parse(texto); } catch (e) { throw new Error('El archivo no es un JSON válido.'); }
    return this.guardar(limpiarSecuencia(j, { conservarId: false }));
  }

  // ---- historial ----
  anotarEjecucion(e) {
    const linea = JSON.stringify({ id: e.id, secuenciaId: e.secuenciaId, nombre: String(e.nombre || '').slice(0, 120), objetivo: e.objetivo, modo: e.modo, inicio: e.inicio, fin: e.fin, estado: e.estado, pasosOk: e.pasosOk, total: e.total, error: e.error ? String(e.error).slice(0, 400) : null, ultimoPunto: e.ultimoPunto ?? null }) + '\n';
    fs.appendFileSync(path.join(this.dir, 'historial.jsonl'), linea);
  }
  historial(max = 200) {
    try {
      return fs.readFileSync(path.join(this.dir, 'historial.jsonl'), 'utf8').trim().split('\n').filter(Boolean).slice(-max).map(l => { try { return JSON.parse(l); } catch (e) { return null; } }).filter(Boolean).reverse();
    } catch (e) { return []; }
  }

  // ---- aplicaciones autorizadas ----
  apps() { return this._json('apps.json', []); }
  autorizarApp(bundleId, nombre, ruta) {
    if (!BUNDLE.test(bundleId || '')) throw new Error('Identificador de aplicación no válido.');
    const xs = this.apps().filter(a => a.bundleId !== bundleId);
    const r = typeof ruta === 'string' && ruta.length < 600 && /\.exe$/i.test(ruta) && path.isAbsolute(ruta) ? ruta : undefined; // Windows: ruta del .exe para abrirla
    xs.push({ bundleId, nombre: String(nombre || bundleId).slice(0, 120), ruta: r, autorizada: new Date().toISOString() });
    this._guardarJson('apps.json', xs);
    return xs;
  }
  revocarApp(bundleId) { const xs = this.apps().filter(a => a.bundleId !== bundleId); this._guardarJson('apps.json', xs); return xs; }
  appAutorizada(bundleId) { return this.apps().some(a => a.bundleId === bundleId); }
  rutaApp(bundleId) { const a = this.apps().find(x => x.bundleId === bundleId); return a && a.ruta ? a.ruta : ''; }

  // ---- aprobaciones de AppleScript ----
  aprobado(hash) { return this._json('aprobaciones.json', {})[hash] != null; }
  aprobar(hash) {
    if (!/^[0-9a-f]{64}$/.test(hash || '')) throw new Error('Huella no válida.');
    const a = this._json('aprobaciones.json', {}); a[hash] = new Date().toISOString(); this._guardarJson('aprobaciones.json', a); return true;
  }
}

module.exports = { Almacen };
