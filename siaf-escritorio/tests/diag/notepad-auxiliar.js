'use strict';
// Diagnóstico en Windows: controla el Bloc de notas SOLO con el auxiliar nativo (sin Electron) y muestra cada respuesta.
// Uso: node tests\diag\notepad-auxiliar.js   (requiere build\bin\siaf-automator.exe)
const { spawn } = require('child_process');
const path = require('path');
const p = spawn(path.join(__dirname, '..', '..', 'build', 'bin', 'siaf-automator.exe'), ['serve']);
let buf = '', id = 0; const esperas = new Map();
p.stdout.on('data', d => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { const l = buf.slice(0, i).trim(); buf = buf.slice(i + 1); if (!l) continue; const m = JSON.parse(l); if (m.evento) { console.log('EVENTO GRABADO', JSON.stringify(m).slice(0, 400)); continue; } const r = esperas.get(m.id); if (r) { esperas.delete(m.id); r(m); } } });
p.stderr.on('data', d => process.stdout.write('[stderr] ' + d));
const pedir = (cmd, args = {}) => new Promise(r => { const n = ++id; esperas.set(n, r); p.stdin.write(JSON.stringify({ id: n, cmd, args }) + '\n'); });
const esperar = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const B = 'notepad.exe';
  const paso = async (cmd, args) => { const r = await pedir(cmd, args); console.log(cmd, JSON.stringify(args || {}).slice(0, 90), '→', JSON.stringify(r).slice(0, 500)); return r; };
  await paso('version'); await paso('permisos'); await paso('abrir', { bundleId: B }); await esperar(2000); await paso('frontal');
  await paso('foco', { bundleId: B });
  await paso('escribir', { bundleId: B, texto: 'Prueba directa del auxiliar', modo: 'teclear' }); await esperar(800);
  await paso('leer', { bundleId: B, elemento: {} });
  await paso('escribir', { bundleId: B, texto: 'Valor asignado por UI Automation', modo: 'valor' }); await esperar(500);
  await paso('leer', { bundleId: B, elemento: {} });
  await paso('apps');
  // grabación: eventos sintéticos sobre el Bloc de notas (los hooks de solo lectura los ven igual que los del usuario)
  await paso('grabar', { apps: [B], teclado: true }); await esperar(500);
  await paso('clicRelativo', { bundleId: B, x: 0.5, y: 0.5 }); await esperar(700);
  await paso('teclas', { bundleId: B, combinacion: 'ctrl+a' }); await esperar(500);
  await paso('escribir', { bundleId: B, texto: 'xy', modo: 'teclear' }); await esperar(500);
  await paso('teclas', { bundleId: B, combinacion: 'return' }); await esperar(1000);
  await paso('grabar-detener');
  await paso('teclas', { bundleId: 'otra.exe', combinacion: 'ctrl+a' }); // debe negarse: no está al frente
  p.stdin.end();
})();
