'use strict';
/* Respaldos nativos de SIAF en disco.
   - Se guardan los MISMOS ZIP que genera SIAF (Resp8.construir: manifiesto.json + respaldo.json + CSV), de modo
     que cualquier copia puede restaurarse también en la versión HTML original.
   - Escritura atómica (archivo temporal + fsync + rename) y verificación posterior: se relee el archivo y se
     comprueban las huellas SHA-256 del manifiesto antes de darlo por bueno.
   - Índice con fecha, motivo, conteos, tamaño y SHA-256 de cada copia; rotación separada para copias
     automáticas y puntos de recuperación (las copias manuales nunca se borran solas).
   - Carpeta espejo opcional (disco externo, iCloud Drive…) para la regla 3-2-1.
   Ubicación: ~/Library/Application Support/SIAF/Respaldos (fuera del paquete .app: borrar la app no la borra). */
const fs = require('fs');
const path = require('path');
const { verificarRespaldoZip, sha256 } = require('./zip');
const { escribirAtomico } = require('./config');
const log = require('./log');

const MOTIVOS = { auto: 'auto', manual: 'manual', salida: 'auto', 'pre-restauracion': 'punto', 'pre-borrado': 'punto', 'cierre-inesperado': 'punto', 'pre-migracion': 'punto', 'pre-actualizacion': 'punto' };
const NOMBRE_OK = /^SIAF_(auto|manual|punto)_\d{4}-\d{2}-\d{2}_\d{6}(_\d+)?\.zip$/;
const MAX_BYTES = 450 * 1024 * 1024;

const pad = n => String(n).padStart(2, '0');
const sello = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;

class Respaldos {
  constructor(dir, config) {
    this.dir = dir;
    this.config = config;
    this.archivoIndice = path.join(dir, 'indice.json');
    fs.mkdirSync(dir, { recursive: true });
    this.indice = this._leerIndice();
  }

  _leerIndice() {
    try {
      const x = JSON.parse(fs.readFileSync(this.archivoIndice, 'utf8'));
      if (Array.isArray(x.respaldos)) return x;
    } catch (e) { /* se reconstruye abajo */ }
    return this.reconstruirIndice();
  }

  /** Reconstruye el índice a partir de los archivos presentes (por ejemplo, si el índice se borró o dañó). */
  reconstruirIndice() {
    const respaldos = [];
    for (const nombre of fs.readdirSync(this.dir)) {
      if (!NOMBRE_OK.test(nombre)) continue;
      try {
        const buf = fs.readFileSync(path.join(this.dir, nombre));
        const v = verificarRespaldoZip(buf);
        respaldos.push({ nombre, tipo: nombre.split('_')[1], motivo: v.manifiesto?.motivo || '', fecha: v.manifiesto?.fecha || fs.statSync(path.join(this.dir, nombre)).mtime.toISOString(), bytes: buf.length, sha256: sha256(buf), conteos: v.manifiesto?.conteos || {}, totalRegistros: v.manifiesto?.totalRegistros || 0, verificado: v.ok, errores: v.errores });
      } catch (e) { log.aviso('No se pudo indexar', nombre, e.message); }
    }
    respaldos.sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
    const indice = { version: 1, respaldos };
    this._guardarIndice(indice);
    return indice;
  }

  _guardarIndice(indice = this.indice) { escribirAtomico(this.archivoIndice, JSON.stringify(indice, null, 1)); }

  /**
   * Guarda un ZIP generado por SIAF. bytes: Uint8Array|Buffer. motivo: clave de MOTIVOS. detalle: texto libre corto.
   * Devuelve la entrada del índice. Lanza error si la verificación falla (y no deja el archivo a medias).
   */
  guardar(bytes, motivo, detalle = '') {
    if (!Object.prototype.hasOwnProperty.call(MOTIVOS, motivo)) throw new Error('Motivo de respaldo no válido.');
    const buf = Buffer.isBuffer(bytes) ? bytes : ArrayBuffer.isView(bytes) ? Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength) : Buffer.from(bytes);
    if (buf.length < 100 || buf.length > MAX_BYTES) throw new Error('Tamaño de respaldo fuera de rango.');
    const previa = verificarRespaldoZip(buf);
    if (!previa.ok) throw new Error('El respaldo recibido no pasó la verificación: ' + previa.errores.join('; '));
    this._comprobarEspacio(buf.length);
    const tipo = MOTIVOS[motivo];
    let nombre = `SIAF_${tipo}_${sello()}.zip`;
    for (let i = 2; fs.existsSync(path.join(this.dir, nombre)); i++) nombre = `SIAF_${tipo}_${sello()}_${i}.zip`;
    const destino = path.join(this.dir, nombre);
    const tmp = destino + '.tmp';
    const fd = fs.openSync(tmp, 'w');
    try { fs.writeSync(fd, buf); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    // verificación de lo escrito en disco ANTES de publicarlo con su nombre definitivo
    const releido = fs.readFileSync(tmp);
    const huella = sha256(releido);
    if (huella !== sha256(buf) || !verificarRespaldoZip(releido).ok) { fs.rmSync(tmp, { force: true }); throw new Error('La copia escrita en disco no coincide con el original. Revise el espacio disponible.'); }
    fs.renameSync(tmp, destino);
    fs.writeFileSync(destino + '.sha256', `${huella}  ${nombre}\n`);
    const man = previa.manifiesto;
    const entrada = { nombre, tipo, motivo, detalle: String(detalle).slice(0, 200), fecha: new Date().toISOString(), bytes: buf.length, sha256: huella, conteos: man.conteos || {}, totalRegistros: man.totalRegistros || 0, finca: man.finca || '', esquema: man.esquema || null, huellaDatos: man.huellaDatos || null, verificado: true };
    this.indice.respaldos.unshift(entrada);
    const espejo = this._copiarEspejo(destino, nombre);
    if (espejo) entrada.espejo = espejo;
    this._rotar();
    this._guardarIndice();
    log.info('Respaldo guardado', nombre, `${buf.length} bytes`, `motivo=${motivo}`);
    return entrada;
  }

  _comprobarEspacio(necesario) {
    try {
      const s = fs.statfsSync(this.dir);
      const libre = s.bavail * s.bsize;
      if (libre < necesario * 2 + 50 * 1024 * 1024) throw new Error(`Espacio insuficiente en disco para el respaldo (libre: ${Math.round(libre / 1048576)} MB).`);
    } catch (e) { if (/Espacio insuficiente/.test(e.message)) throw e; }
  }

  _copiarEspejo(origen, nombre) {
    const carpeta = this.config.get('carpetaEspejo');
    if (!carpeta) return null;
    try {
      if (!fs.existsSync(carpeta) || !fs.statSync(carpeta).isDirectory()) throw new Error('la carpeta espejo no está disponible (¿disco desconectado?)');
      const dest = path.join(carpeta, nombre);
      fs.copyFileSync(origen, dest);
      if (sha256(fs.readFileSync(dest)) !== sha256(fs.readFileSync(origen))) throw new Error('la copia espejo no coincide');
      return { ok: true, ruta: dest };
    } catch (e) {
      log.aviso('Copia espejo no realizada:', e.message);
      return { ok: false, error: e.message };
    }
  }

  _rotar() {
    const limites = { auto: this.config.get('retenerAuto'), punto: this.config.get('retenerPuntos') };
    for (const tipo of Object.keys(limites)) {
      const deTipo = this.indice.respaldos.filter(r => r.tipo === tipo);
      for (const r of deTipo.slice(limites[tipo])) {
        try {
          fs.rmSync(path.join(this.dir, r.nombre), { force: true });
          fs.rmSync(path.join(this.dir, r.nombre + '.sha256'), { force: true });
          log.info('Rotación: respaldo antiguo eliminado', r.nombre);
        } catch (e) { log.aviso('No se pudo rotar', r.nombre, e.message); continue; }
        this.indice.respaldos = this.indice.respaldos.filter(x => x !== r);
      }
    }
  }

  listar() { return this.indice.respaldos.map(r => ({ ...r })); }

  ruta(nombre) {
    if (typeof nombre !== 'string' || !NOMBRE_OK.test(nombre) || path.basename(nombre) !== nombre) throw new Error('Nombre de respaldo no válido.');
    const r = path.join(this.dir, nombre);
    if (!fs.existsSync(r)) throw new Error('El respaldo no existe.');
    return r;
  }

  /** Relee un respaldo y comprueba huella del archivo y huellas internas del manifiesto. */
  verificar(nombre) {
    const buf = fs.readFileSync(this.ruta(nombre));
    const e = this.indice.respaldos.find(r => r.nombre === nombre);
    const v = verificarRespaldoZip(buf);
    const errores = [...v.errores];
    if (e && e.sha256 !== sha256(buf)) errores.push('La huella SHA-256 del archivo no coincide con la registrada al guardarlo.');
    if (e) { e.verificado = errores.length === 0; e.ultimaVerificacion = new Date().toISOString(); this._guardarIndice(); }
    return { nombre, ok: errores.length === 0, errores, conteos: v.manifiesto?.conteos || {} };
  }

  verificarTodos() { return this.listar().map(r => { try { return this.verificar(r.nombre); } catch (e) { return { nombre: r.nombre, ok: false, errores: [e.message] }; } }); }

  leer(nombre) {
    const v = this.verificar(nombre);
    if (!v.ok) throw new Error('El respaldo no pasó la verificación: ' + v.errores.join('; '));
    return fs.readFileSync(this.ruta(nombre));
  }

  ultimo() { return this.indice.respaldos[0] || null; }
}

module.exports = { Respaldos, NOMBRE_OK, MOTIVOS };
