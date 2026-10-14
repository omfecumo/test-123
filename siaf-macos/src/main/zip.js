'use strict';
/* Lector ZIP mínimo (almacenado o deflate) para VERIFICAR, desde el proceso principal y sin depender de la
   ventana, los respaldos ZIP que genera SIAF (Resp8.construir): cada archivo listado en manifiesto.json debe
   existir y su SHA-256 debe coincidir. No escribe nada ni extrae a disco. */
const zlib = require('zlib');
const crypto = require('crypto');

const sha256 = b => crypto.createHash('sha256').update(b).digest('hex');

function leerZip(buf) {
  if (!Buffer.isBuffer(buf)) buf = Buffer.from(buf);
  // Fin del directorio central (EOCD): firma 0x06054b50, buscada desde el final (comentario de hasta 64 KiB)
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65535); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('No es un archivo ZIP válido (sin directorio central).');
  const total = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const archivos = new Map();
  for (let n = 0; n < total; n++) {
    if (p + 46 > buf.length || buf.readUInt32LE(p) !== 0x02014b50) throw new Error('Directorio central del ZIP dañado.');
    const metodo = buf.readUInt16LE(p + 10);
    const tamComp = buf.readUInt32LE(p + 20);
    const tam = buf.readUInt32LE(p + 24);
    const lNombre = buf.readUInt16LE(p + 28), lExtra = buf.readUInt16LE(p + 30), lCom = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const nombre = buf.slice(p + 46, p + 46 + lNombre).toString('utf8');
    p += 46 + lNombre + lExtra + lCom;
    if (local + 30 > buf.length || buf.readUInt32LE(local) !== 0x04034b50) throw new Error(`Encabezado local dañado: ${nombre}`);
    const ini = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const comp = buf.slice(ini, ini + tamComp);
    let datos;
    if (metodo === 0) datos = comp;
    else if (metodo === 8) datos = zlib.inflateRawSync(comp, { maxOutputLength: 512 * 1024 * 1024 });
    else throw new Error(`Método de compresión no admitido (${metodo}) en ${nombre}`);
    if (datos.length !== tam) throw new Error(`Tamaño inesperado en ${nombre}`);
    archivos.set(nombre, datos);
  }
  return archivos;
}

/** Verifica un respaldo ZIP de SIAF. Devuelve { ok, manifiesto, errores[] }. */
function verificarRespaldoZip(buf) {
  const errores = [];
  let archivos;
  try { archivos = leerZip(buf); } catch (e) { return { ok: false, errores: [e.message] }; }
  const mb = archivos.get('manifiesto.json');
  if (!archivos.has('respaldo.json')) errores.push('Falta respaldo.json');
  if (!mb) { errores.push('Falta manifiesto.json'); return { ok: false, errores }; }
  let man;
  try { man = JSON.parse(mb.toString('utf8')); } catch (e) { return { ok: false, errores: ['manifiesto.json dañado'] }; }
  if (man.app !== 'SIAF') errores.push('El manifiesto no es de SIAF');
  for (const [nombre, h] of Object.entries(man.archivos || {})) {
    const d = archivos.get(nombre);
    if (!d) errores.push(`Falta ${nombre}`);
    else if (sha256(d) !== h.sha256) errores.push(`Huella distinta en ${nombre}`);
  }
  return { ok: errores.length === 0, manifiesto: man, errores, archivos };
}

module.exports = { leerZip, verificarRespaldoZip, sha256 };
