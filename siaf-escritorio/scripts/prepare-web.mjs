// Prepara app-web/ a partir del archivo ORIGINAL de SIAF sin alterar su lógica:
//   1. Verifica que source/SIAF_v9_3_3.html coincide con la huella registrada en source/SHA256SUMS.
//   2. Copia el archivo como app-web/index.html añadiendo UNA etiqueta <script src="desktop-bridge.js"> antes de </body>.
//   3. Copia src/web/desktop-bridge.js y escribe app-web/BUILD-INFO.json (huellas de entrada y salida).
// Uso: node scripts/prepare-web.mjs   (lo ejecutan npm start, las pruebas y el empaquetado)
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const sha = b => createHash('sha256').update(b).digest('hex');
const sumas = readFileSync(join(raiz, 'source', 'SHA256SUMS'), 'utf8').trim().split(/\s+/);
const [esperada, nombre] = sumas;
const original = readFileSync(join(raiz, 'source', nombre));
if (sha(original) !== esperada) {
  console.error(`✖ ${nombre} no coincide con source/SHA256SUMS. Si actualizó SIAF a propósito, regenere la huella:\n  (cd source && sha256sum ${nombre} > SHA256SUMS)`);
  process.exit(1);
}
const html = original.toString('utf8');
const marca = '</body>';
const pos = html.lastIndexOf(marca);
if (pos < 0) { console.error('✖ No se encontró </body> en el archivo original.'); process.exit(1); }
const etiqueta = '<script src="desktop-bridge.js"></script>\n';
const salida = html.slice(0, pos) + etiqueta + html.slice(pos);
const destino = join(raiz, 'app-web');
mkdirSync(destino, { recursive: true });
writeFileSync(join(destino, 'index.html'), salida);
copyFileSync(join(raiz, 'src', 'web', 'desktop-bridge.js'), join(destino, 'desktop-bridge.js'));
const pkg = JSON.parse(readFileSync(join(raiz, 'package.json'), 'utf8'));
writeFileSync(join(destino, 'BUILD-INFO.json'), JSON.stringify({
  app: pkg.productName, version: pkg.version, origen: nombre, sha256Origen: esperada,
  sha256Index: sha(Buffer.from(salida)), sha256Puente: sha(readFileSync(join(destino, 'desktop-bridge.js'))),
  cambiosAlOriginal: 'Solo se insertó una línea antes de </body>: ' + etiqueta.trim(), generado: new Date().toISOString(),
}, null, 2));
console.log(`✔ app-web/ preparado desde ${nombre} (SHA-256 ${esperada.slice(0, 12)}…)`);
