'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { respaldoSIAF, tmp } = require('./ayudas');
const migracion = require('../../src/main/migracion');
const { resolverArchivo } = require('../../src/main/protocol');

test('Migración: analiza un ZIP oficial de SIAF sin modificarlo', () => {
  const d = tmp(); const f = path.join(d, 'r.zip');
  const { buf } = respaldoSIAF({ fotos: [{ id: 'fot-1', entidad: 'animales', entidadId: 'ani-1', dataUrl: 'data:image/png;base64,AA==' }] });
  fs.writeFileSync(f, buf);
  const antes = fs.readFileSync(f);
  const R = migracion.analizarArchivo(f);
  assert.strictEqual(R.tipo, 'zip');
  assert.deepStrictEqual(R.errores, []);
  assert.strictEqual(R.conteos.animales, 1);
  assert.strictEqual(R.conteos.fotos, 1);
  assert.ok(fs.readFileSync(f).equals(antes), 'el archivo de origen no debe cambiar');
  assert.match(migracion.textoReporte(R), /Animales: 1/);
});

test('Migración: JSON con identificadores inválidos, repetidos y referencias rotas genera avisos', () => {
  const d = tmp(); const f = path.join(d, 'r.json');
  fs.writeFileSync(f, JSON.stringify({ app: 'SIAF', datos: { lotes: [], usuarios: [{ id: 'u1', rol: 'operario' }], animales: [{ id: 'a 1' }, { id: 'a2', loteId: 'no-existe' }, { id: 'a2' }] } }));
  const R = migracion.analizarArchivo(f);
  assert.strictEqual(R.tipo, 'json');
  assert.strictEqual(R.conteos.animales, 1);
  const t = R.avisos.join(' ');
  assert.match(t, /sin identificador válido/); assert.match(t, /repetido/); assert.match(t, /referencia/); assert.match(t, /administrador/);
});

test('Migración: rechaza archivos que no son de SIAF y reconoce respaldos cifrados', () => {
  const d = tmp();
  fs.writeFileSync(path.join(d, 'x.json'), JSON.stringify({ hola: 1 }));
  assert.ok(migracion.analizarArchivo(path.join(d, 'x.json')).errores.length > 0);
  fs.writeFileSync(path.join(d, 'c.siaf'), JSON.stringify({ app: 'SIAF', siaf8Cifrado: 1, datos: 'xxx' }));
  const c = migracion.analizarArchivo(path.join(d, 'c.siaf'));
  assert.strictEqual(c.cifrado, true); assert.deepStrictEqual(c.errores, []);
  fs.writeFileSync(path.join(d, 'basura.zip'), Buffer.from([0x50, 0x4b, 1, 2, 3]));
  assert.ok(migracion.analizarArchivo(path.join(d, 'basura.zip')).errores.length > 0);
});

test('Migración: estado pendiente y resultado se guardan y limpian', () => {
  const d = tmp();
  migracion.guardarPendiente(d, { origen: 'a.zip', conteos: { animales: 2 }, estado: 'enviada' });
  assert.strictEqual(migracion.leerPendiente(d).estado, 'enviada');
  const n = migracion.guardarResultado(d, { estado: 'verificada' });
  assert.ok(fs.existsSync(path.join(d, n)));
  assert.strictEqual(migracion.leerPendiente(d), null);
});

test('Protocolo siaf://: sirve solo archivos dentro de cada raíz', () => {
  const raiz = tmp(); fs.writeFileSync(path.join(raiz, 'index.html'), 'x'); fs.mkdirSync(path.join(raiz, 'sub')); fs.writeFileSync(path.join(raiz, 'sub', 'a.js'), 'y');
  const fuera = tmp(); fs.writeFileSync(path.join(fuera, 'secreto.txt'), 's');
  fs.symlinkSync(path.join(fuera, 'secreto.txt'), path.join(raiz, 'enlace.txt'));
  const R = { app: raiz };
  assert.strictEqual(resolverArchivo(R, 'siaf://app/').archivo, fs.realpathSync(path.join(raiz, 'index.html')));
  assert.ok(resolverArchivo(R, 'siaf://app/sub/a.js').archivo);
  assert.strictEqual(resolverArchivo(R, 'siaf://app/../../etc/passwd').estado, 404); // la URL se normaliza dentro de la raíz
  assert.strictEqual(resolverArchivo(R, 'siaf://app/%2e%2e/%2e%2e/etc/passwd').estado === 403 || resolverArchivo(R, 'siaf://app/%2e%2e/%2e%2e/etc/passwd').estado === 404, true);
  assert.strictEqual(resolverArchivo(R, 'siaf://app/..%2f..%2fsecreto.txt').estado, 403);
  assert.strictEqual(resolverArchivo(R, 'siaf://app/enlace.txt').estado, 403);
  assert.strictEqual(resolverArchivo(R, 'siaf://otro/index.html').estado, 404);
  assert.strictEqual(resolverArchivo(R, 'siaf://constructor/x').estado, 404);
  assert.strictEqual(resolverArchivo(R, 'https://app/index.html').estado, 400);
  assert.strictEqual(resolverArchivo(R, 'siaf://app/sub').estado, 404);
});
