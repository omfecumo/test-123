'use strict';
// Diagnóstico en macOS: controla TextEdit SOLO con el auxiliar nativo (sin Electron) y muestra cada respuesta.
// Uso: node tests/diag/textedit-auxiliar.js   (requiere build/bin/siaf-automator y permiso de Accesibilidad)
const { spawn } = require('child_process');
const path = require('path');
const p = spawn(path.join(__dirname, '..', '..', 'build', 'bin', 'siaf-automator'), ['serve']);
let buf = '', id = 0; const esperas = new Map();
p.stdout.on('data', d => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { const m = JSON.parse(buf.slice(0, i)); buf = buf.slice(i + 1); const r = esperas.get(m.id); if (r) { esperas.delete(m.id); r(m); } } });
p.stderr.on('data', d => process.stdout.write('[stderr] ' + d));
const pedir = (cmd, args = {}) => new Promise(r => { const n = ++id; esperas.set(n, r); p.stdin.write(JSON.stringify({ id: n, cmd, args }) + '\n'); });
const esperar = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const B = 'com.apple.TextEdit';
  const paso = async (cmd, args) => { const r = await pedir(cmd, args); console.log(cmd, JSON.stringify(args || {}).slice(0, 80), '→', JSON.stringify(r).slice(0, 400)); return r; };
  await paso('permisos'); await paso('abrir', { bundleId: B }); await esperar(2000); await paso('frontal');
  await paso('teclas', { bundleId: B, combinacion: 'cmd+n' }); await esperar(1200); await paso('frontal');
  await paso('escribir', { bundleId: B, texto: 'Prueba directa del auxiliar', modo: 'teclear' }); await esperar(800);
  await paso('leer', { bundleId: B, elemento: { rol: 'AXTextArea' }, timeoutMs: 3000 });
  await paso('escribir', { bundleId: B, texto: 'Valor asignado por AX', modo: 'valor', elemento: { rol: 'AXTextArea' } }); await esperar(500);
  await paso('leer', { bundleId: B, elemento: { rol: 'AXTextArea' }, timeoutMs: 3000 });
  await paso('menu', { bundleId: B, ruta: ['Format', 'Make Plain Text'] }).catch(() => { });
  p.stdin.end();
})();
