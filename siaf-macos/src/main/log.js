'use strict';
/* Registro técnico local (sin telemetría): ~/Library/Application Support/SIAF/logs/siaf.log
   Solo se registran eventos técnicos (arranque, errores, respaldos, permisos, automatización). Nunca se
   escriben registros de la finca, PIN, frases de cifrado ni el texto que se escribe en una automatización. */
const fs = require('fs');
const path = require('path');

const MAX_BYTES = 2 * 1024 * 1024;
const SENSIBLE = /(pin|clave|password|contrase|frase|token|secret|authorization)\s*[:=]\s*("[^"]*"|'[^']*'|\S+)/gi;
let archivo = null;

function iniciar(dir) {
  fs.mkdirSync(dir, { recursive: true });
  archivo = path.join(dir, 'siaf.log');
  try {
    if (fs.existsSync(archivo) && fs.statSync(archivo).size > MAX_BYTES) {
      fs.renameSync(archivo, path.join(dir, 'siaf.1.log'));
    }
  } catch (e) { /* el registro nunca debe impedir el arranque */ }
}

function limpiar(texto) {
  return String(texto).replace(SENSIBLE, '$1=[oculto]').slice(0, 2000);
}

function escribir(nivel, ...partes) {
  const linea = `${new Date().toISOString()} [${nivel}] ${limpiar(partes.map(p => (p instanceof Error ? (p.stack || p.message) : typeof p === 'string' ? p : JSON.stringify(p))).join(' '))}\n`;
  if (process.env.SIAF_LOG_CONSOLA === '1') process.stdout.write(linea);
  if (!archivo) return;
  try { fs.appendFileSync(archivo, linea); } catch (e) { /* disco lleno o sin permiso: se ignora */ }
}

module.exports = {
  iniciar,
  limpiar,
  info: (...p) => escribir('INFO', ...p),
  aviso: (...p) => escribir('AVISO', ...p),
  error: (...p) => escribir('ERROR', ...p),
  get archivo() { return archivo; },
};
