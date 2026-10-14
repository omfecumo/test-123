'use strict';
/* Protocolo propio «siaf://»: sirve los archivos empaquetados con un origen estable y seguro.
   - siaf://app/      → SIAF (index.html preparado por scripts/prepare-web.mjs + desktop-bridge.js)
   - siaf://control/  → ventana «SIAF Control y Automatización» (origen distinto: no ve los datos de SIAF)
   - siaf://ayuda/    → manual de uso
   El origen fijo «siaf://app» es lo que mantiene la base IndexedDB de SIAF entre sesiones y actualizaciones:
   si cambiara el origen, el navegador interno vería una base vacía. NO cambie el host ni el esquema. */
let protocol, net;
try { ({ protocol, net } = require('electron')); } catch (e) { /* pruebas unitarias fuera de Electron */ }
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

const ESQUEMA = 'siaf';
const ORIGEN_APP = 'siaf://app';

const CSP_APP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",          // SIAF es un archivo único con scripts en línea
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "media-src 'self' data: blob:",
  "connect-src 'self' data: blob: https:",       // solo para la sincronización opcional que configure el usuario
  "worker-src 'self' blob:",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

const CSP_LOCAL = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'none'";

const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.md': 'text/markdown; charset=utf-8', '.ico': 'image/x-icon' };

function registrarPrivilegios() {
  protocol.registerSchemesAsPrivileged([{
    scheme: ESQUEMA,
    // standard + secure: origen propio y contexto seguro (crypto.subtle, IndexedDB persistente, Web Crypto para
    // los respaldos cifrados de SIAF). No se habilitan service workers: la app ya está instalada en el disco.
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, codeCache: true },
  }]);
}

function respuesta(estado, texto) {
  return new Response(texto, { status: estado, headers: { 'content-type': 'text/plain; charset=utf-8' } });
}

/** Traduce una URL siaf:// a un archivo dentro de la raíz de su host. Devuelve { archivo, host } o { estado }. */
function resolverArchivo(raices, urlTexto) {
  let url;
  try { url = new URL(urlTexto); } catch (e) { return { estado: 400 }; }
  if (url.protocol !== ESQUEMA + ':') return { estado: 400 };
  const raiz = Object.prototype.hasOwnProperty.call(raices, url.host) ? raices[url.host] : null;
  if (!raiz) return { estado: 404 };
  let rel;
  try { rel = decodeURIComponent(url.pathname); } catch (e) { return { estado: 400 }; }
  if (rel.includes('\0')) return { estado: 400 };
  if (rel === '/' || rel === '') rel = '/index.html';
  const base = path.resolve(raiz);
  const archivo = path.resolve(base, '.' + rel);
  if (archivo !== base && !archivo.startsWith(base + path.sep)) return { estado: 403 };
  let st;
  try { st = fs.statSync(archivo); } catch (e) { return { estado: 404 }; }
  if (!st.isFile()) return { estado: 404 };
  // no se siguen enlaces simbólicos que salgan de la raíz
  const real = fs.realpathSync(archivo);
  if (!real.startsWith(fs.realpathSync(base) + path.sep)) return { estado: 403 };
  return { archivo: real, host: url.host };
}

/** raices: { app, control, ayuda } → carpetas absolutas */
function manejar(raices) {
  protocol.handle(ESQUEMA, async req => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return respuesta(405, 'Método no permitido');
    const r = resolverArchivo(raices, req.url);
    if (!r.archivo) return respuesta(r.estado, r.estado === 403 ? 'Ruta no permitida' : r.estado === 400 ? 'URL no válida' : 'No encontrado');
    const archivo = r.archivo;
    const datos = await net.fetch(pathToFileURL(archivo).toString());
    const cab = new Headers();
    cab.set('content-type', TIPOS[path.extname(archivo).toLowerCase()] || 'application/octet-stream');
    cab.set('x-content-type-options', 'nosniff');
    cab.set('cache-control', 'no-cache');
    if (archivo.endsWith('.html')) cab.set('content-security-policy', r.host === 'app' ? CSP_APP : CSP_LOCAL);
    return new Response(req.method === 'HEAD' ? null : datos.body, { status: 200, headers: cab });
  });
}

module.exports = { registrarPrivilegios, manejar, resolverArchivo, ESQUEMA, ORIGEN_APP, CSP_APP, CSP_LOCAL };
