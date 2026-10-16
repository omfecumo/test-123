'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { respaldoSIAF, tmp, zip } = require('./ayudas');
const { verificarRespaldoZip, leerZip } = require('../../src/main/zip');
const { Respaldos } = require('../../src/main/backups');
const { Config } = require('../../src/main/config');
const log = require('../../src/main/log');

test('ZIP: lee archivos almacenados y comprimidos (deflate) con el formato de SIAF', () => {
  const b = zip({ 'a.txt': 'hola', 'b.txt': 'x'.repeat(5000) });
  const m = leerZip(b);
  assert.strictEqual(m.get('a.txt').toString(), 'hola');
  assert.strictEqual(m.get('b.txt').length, 5000);
});

test('ZIP: verifica huellas del manifiesto y detecta alteraciones', () => {
  const { buf } = respaldoSIAF();
  assert.strictEqual(verificarRespaldoZip(buf).ok, true);
  const alterado = Buffer.from(buf);
  const i = alterado.indexOf(Buffer.from('"arete":"100"'));
  if (i >= 0) { alterado.write('"arete":"999"', i); assert.strictEqual(verificarRespaldoZip(alterado).ok, false); }
  else {
    // el JSON quedó comprimido: alterar un byte del contenido comprimido debe fallar la descompresión o la huella
    alterado[60] ^= 0xff;
    assert.strictEqual(verificarRespaldoZip(alterado).ok, false);
  }
  assert.strictEqual(verificarRespaldoZip(Buffer.from('no es zip')).ok, false);
});

function nuevo(opciones = {}) {
  const dir = tmp();
  log.iniciar(path.join(dir, 'logs'));
  const cfg = new Config(dir); cfg.set(opciones);
  return { dir, cfg, r: new Respaldos(path.join(dir, 'Respaldos'), cfg) };
}

test('Respaldos: guarda, escribe .sha256, indexa y verifica', () => {
  const { dir, r } = nuevo();
  const { buf } = respaldoSIAF();
  const e = r.guardar(buf, 'manual', 'prueba');
  assert.match(e.nombre, /^SIAF_manual_\d{4}-\d{2}-\d{2}_\d{6}\.zip$/);
  assert.ok(fs.existsSync(path.join(dir, 'Respaldos', e.nombre)));
  assert.ok(fs.readFileSync(path.join(dir, 'Respaldos', e.nombre + '.sha256'), 'utf8').startsWith(e.sha256));
  assert.strictEqual(e.totalRegistros, 3);
  assert.strictEqual(r.verificar(e.nombre).ok, true);
  assert.strictEqual(r.listar().length, 1);
  assert.deepStrictEqual([...r.leer(e.nombre)], [...buf]);
  // no quedan temporales
  assert.deepStrictEqual(fs.readdirSync(path.join(dir, 'Respaldos')).filter(f => f.endsWith('.tmp')), []);
});

test('Respaldos: rechaza contenido que no es un respaldo de SIAF y motivos desconocidos', () => {
  const { r } = nuevo();
  assert.throws(() => r.guardar(Buffer.from('x'.repeat(200)), 'manual'), /verificación/);
  assert.throws(() => r.guardar(respaldoSIAF().buf, 'cualquiera'), /Motivo/);
});

test('Respaldos: detecta un archivo modificado en disco después de guardarlo', () => {
  const { dir, r } = nuevo();
  const e = r.guardar(respaldoSIAF().buf, 'auto');
  const ruta = path.join(dir, 'Respaldos', e.nombre);
  const b = fs.readFileSync(ruta); b[b.length - 30] ^= 0x01; fs.writeFileSync(ruta, b);
  const v = r.verificar(e.nombre);
  assert.strictEqual(v.ok, false);
  assert.throws(() => r.leer(e.nombre), /verificación/);
});

test('Respaldos: rotación separa automáticas y puntos; las manuales nunca se borran', () => {
  const { r } = nuevo({ retenerAuto: 3, retenerPuntos: 3 });
  const { buf } = respaldoSIAF();
  for (let i = 0; i < 5; i++) r.guardar(buf, 'auto');
  for (let i = 0; i < 4; i++) r.guardar(buf, 'pre-restauracion');
  for (let i = 0; i < 4; i++) r.guardar(buf, 'manual');
  const l = r.listar();
  assert.strictEqual(l.filter(x => x.tipo === 'auto').length, 3);
  assert.strictEqual(l.filter(x => x.tipo === 'punto').length, 3);
  assert.strictEqual(l.filter(x => x.tipo === 'manual').length, 4);
});

test('Respaldos: nombres con rutas o fuera del patrón se rechazan (sin recorrido de directorios)', () => {
  const { r } = nuevo();
  for (const n of ['../preferencias.json', '/etc/passwd', 'SIAF_auto_x.zip', 'indice.json']) assert.throws(() => r.ruta(n), /no válido/);
});

test('Respaldos: copia espejo verificada y fallo de espejo no impide el respaldo principal', () => {
  const espejo = tmp();
  const { r, cfg } = nuevo({ carpetaEspejo: espejo });
  const e = r.guardar(respaldoSIAF().buf, 'manual');
  assert.strictEqual(e.espejo.ok, true);
  assert.ok(fs.existsSync(path.join(espejo, e.nombre)));
  cfg.set({ carpetaEspejo: path.join(espejo, 'no-existe') });
  const e2 = r.guardar(respaldoSIAF().buf, 'manual');
  assert.strictEqual(e2.espejo.ok, false);
  assert.ok(r.verificar(e2.nombre).ok);
});

test('Respaldos: el índice se reconstruye si se borra', () => {
  const { dir, r, cfg } = nuevo();
  r.guardar(respaldoSIAF().buf, 'manual');
  r.guardar(respaldoSIAF().buf, 'auto');
  fs.rmSync(path.join(dir, 'Respaldos', 'indice.json'));
  const r2 = new Respaldos(path.join(dir, 'Respaldos'), cfg);
  assert.strictEqual(r2.listar().length, 2);
  assert.ok(r2.listar().every(x => x.verificado));
});
