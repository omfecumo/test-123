'use strict';
// Construye ZIP con el mismo formato que Util8.zip de SIAF (deflate-raw o almacenado) para las pruebas.
const zlib = require('zlib');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

function crc32(buf) { let c, crc = 0xFFFFFFFF; for (const b of buf) { c = (crc ^ b) & 0xFF; for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xEDB88320 : c >>> 1; crc = (crc >>> 8) ^ c; } return (crc ^ 0xFFFFFFFF) >>> 0; }
function zip(archivos) {
  const partes = [], central = []; let off = 0;
  for (const [nombre, datosTxt] of Object.entries(archivos)) {
    const raw = Buffer.from(datosTxt); const n = Buffer.from(nombre);
    const def = zlib.deflateRawSync(raw); const usar = def.length < raw.length; const comp = usar ? def : raw;
    const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0x0800, 6); lh.writeUInt16LE(usar ? 8 : 0, 8);
    lh.writeUInt32LE(crc32(raw), 14); lh.writeUInt32LE(comp.length, 18); lh.writeUInt32LE(raw.length, 22); lh.writeUInt16LE(n.length, 26);
    partes.push(lh, n, comp);
    const ch = Buffer.alloc(46); ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0x0800, 8); ch.writeUInt16LE(usar ? 8 : 0, 10);
    ch.writeUInt32LE(crc32(raw), 16); ch.writeUInt32LE(comp.length, 20); ch.writeUInt32LE(raw.length, 24); ch.writeUInt16LE(n.length, 28); ch.writeUInt32LE(off, 42);
    central.push(ch, n); off += 30 + n.length + comp.length;
  }
  const tc = central.reduce((s, b) => s + b.length, 0);
  const eo = Buffer.alloc(22); eo.writeUInt32LE(0x06054b50, 0); eo.writeUInt16LE(central.length / 2, 8); eo.writeUInt16LE(central.length / 2, 10); eo.writeUInt32LE(tc, 12); eo.writeUInt32LE(off, 16);
  return Buffer.concat([...partes, ...central, eo]);
}
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
function respaldoSIAF(datos = {}) {
  const j = { app: 'SIAF', formato: 2, versionApp: '9.0', exportado: '2026-10-01T10:00:00', datos: { lotes: [{ id: 'lot-1', codigo: '1' }], animales: [{ id: 'ani-1', arete: '100', loteId: 'lot-1' }], usuarios: [{ id: 'usr-admin', rol: 'admin', activo: true }], fotos: [], ...datos } };
  const json = JSON.stringify(j);
  const conteos = {}; for (const [c, xs] of Object.entries(j.datos)) conteos[c] = xs.length;
  const man = { app: 'SIAF', tipo: 'respaldo-zip', motivo: 'prueba', conteos, totalRegistros: Object.values(conteos).reduce((a, b) => a + b, 0), archivos: { 'respaldo.json': { sha256: sha(Buffer.from(json)), bytes: json.length } } };
  return { buf: zip({ 'manifiesto.json': JSON.stringify(man), 'respaldo.json': json }), json: j, man };
}
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'siaf-prueba-'));
module.exports = { zip, sha, respaldoSIAF, tmp, crc32 };
