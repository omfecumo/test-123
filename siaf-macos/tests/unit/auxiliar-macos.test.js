'use strict';
// Protocolo JSON del auxiliar nativo siaf-automator. Solo en macOS y con el binario compilado (scripts/build-automator.sh).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { spawn, execFileSync } = require('child_process');

const BIN = path.join(__dirname, '..', '..', 'build', 'bin', 'siaf-automator');
const disponible = process.platform === 'darwin' && fs.existsSync(BIN);

test('auxiliar: subcomandos de diagnóstico', { skip: !disponible && 'requiere macOS y build/bin/siaf-automator' }, () => {
  assert.match(execFileSync(BIN, ['version']).toString(), /^\d+\.\d+\.\d+/);
  const p = JSON.parse(execFileSync(BIN, ['permisos']).toString());
  assert.strictEqual(typeof p.accesibilidad, 'boolean');
  assert.strictEqual(typeof p.monitorEntrada, 'boolean');
  assert.ok(Array.isArray(JSON.parse(execFileSync(BIN, ['apps']).toString())));
});

test('auxiliar: protocolo serve (peticiones, errores controlados y cierre al cerrar stdin)', { skip: !disponible && 'requiere macOS y build/bin/siaf-automator' }, async () => {
  const p = spawn(BIN, ['serve']);
  let buf = ''; const resp = new Map();
  p.stdout.on('data', d => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { const m = JSON.parse(buf.slice(0, i)); buf = buf.slice(i + 1); if (m.id) resp.set(m.id, m); } });
  const pedir = (id, cmd, args = {}) => { p.stdin.write(JSON.stringify({ id, cmd, args }) + '\n'); return new Promise((res, rej) => { const t0 = Date.now(); const iv = setInterval(() => { if (resp.has(id)) { clearInterval(iv); res(resp.get(id)); } else if (Date.now() - t0 > 10000) { clearInterval(iv); rej(new Error('sin respuesta ' + cmd)); } }, 20); }); };
  assert.strictEqual((await pedir(1, 'version')).ok, true);
  const f = await pedir(2, 'frontal'); assert.strictEqual(f.ok, true); assert.ok('bundleId' in f.resultado);
  const x = await pedir(3, 'comando-inexistente'); assert.strictEqual(x.ok, false); assert.match(x.error, /desconocido/);
  const y = await pedir(4, 'pulsar', { bundleId: 'com.ejemplo.no.existe', elemento: { titulo: 'X' }, timeoutMs: 300 }); assert.strictEqual(y.ok, false);
  const z = await pedir(5, 'teclas', { bundleId: 'com.ejemplo.no.existe', combinacion: 'cmd+q' }); assert.strictEqual(z.ok, false); assert.match(z.error, /no está al frente/); // nunca envía teclas a otra app
  const fin = new Promise(r => p.on('exit', r)); p.stdin.end();
  assert.strictEqual(await fin, 0);
});
