'use strict';
/* Cliente del auxiliar nativo «siaf-automator» (Swift; native/SIAFAutomator). Protocolo: una línea JSON por
   mensaje en stdin/stdout.
     petición:  {"id":1,"cmd":"pulsar","args":{...}}
     respuesta: {"id":1,"ok":true,"resultado":{...}}  |  {"id":1,"ok":false,"error":"…"}
     evento:    {"evento":"paso","datos":{...}}         (durante una grabación)
   El auxiliar vive dentro de SIAF.app (Contents/Resources/bin), por lo que macOS atribuye los permisos de
   Accesibilidad y Monitorización de entrada a «SIAF». */
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { EventEmitter } = require('events');
const log = require('../log');

function rutaAuxiliar() {
  const candidatos = [
    process.env.SIAF_AUTOMATOR,
    process.resourcesPath && path.join(process.resourcesPath, 'bin', 'siaf-automator'),
    path.join(__dirname, '..', '..', '..', 'build', 'bin', 'siaf-automator'),
    path.join(__dirname, '..', '..', '..', 'native', 'SIAFAutomator', '.build', 'release', 'siaf-automator'),
  ].filter(Boolean);
  return candidatos.find(p => { try { return fs.statSync(p).isFile(); } catch (e) { return false; } }) || null;
}

class Auxiliar extends EventEmitter {
  constructor() { super(); this.proc = null; this.sig = 1; this.pendientes = new Map(); this.buffer = ''; }
  disponible() {
    if (process.platform !== 'darwin') return { ok: false, motivo: 'La automatización de otras aplicaciones solo está disponible en macOS.' };
    if (!rutaAuxiliar()) return { ok: false, motivo: 'No se encontró el auxiliar nativo «siaf-automator». Compílelo con scripts/build-automator.sh (requiere Xcode).' };
    return { ok: true, ruta: rutaAuxiliar() };
  }
  _iniciar() {
    if (this.proc) return;
    const d = this.disponible(); if (!d.ok) throw new Error(d.motivo);
    this.proc = spawn(d.ruta, ['serve'], { stdio: ['pipe', 'pipe', 'pipe'] });
    this.proc.stdout.setEncoding('utf8');
    this.proc.stdout.on('data', t => this._datos(t));
    this.proc.stderr.on('data', t => log.aviso('siaf-automator:', String(t).slice(0, 500)));
    this.proc.on('exit', (code, sig) => {
      log.info('siaf-automator terminó', code, sig || '');
      for (const [, p] of this.pendientes) p.rej(new Error('El auxiliar de automatización se cerró.'));
      this.pendientes.clear(); this.proc = null; this.emit('cerrado');
    });
  }
  _datos(t) {
    this.buffer += t;
    let i;
    while ((i = this.buffer.indexOf('\n')) >= 0) {
      const linea = this.buffer.slice(0, i); this.buffer = this.buffer.slice(i + 1);
      if (!linea.trim()) continue;
      let m; try { m = JSON.parse(linea); } catch (e) { log.aviso('siaf-automator: línea no válida'); continue; }
      if (m.evento) { this.emit('evento', m); continue; }
      const p = this.pendientes.get(m.id); if (!p) continue;
      this.pendientes.delete(m.id); clearTimeout(p.t);
      if (m.ok) p.res(m.resultado); else p.rej(new Error(m.error || 'Error del auxiliar'));
    }
  }
  pedir(cmd, args = {}, timeoutMs = 15000) {
    this._iniciar();
    const id = this.sig++;
    return new Promise((res, rej) => {
      const t = setTimeout(() => { this.pendientes.delete(id); rej(new Error(`El auxiliar no respondió a «${cmd}» en ${Math.round(timeoutMs / 1000)} s.`)); }, timeoutMs);
      this.pendientes.set(id, { res, rej, t });
      this.proc.stdin.write(JSON.stringify({ id, cmd, args }) + '\n');
    });
  }
  cerrar() { if (this.proc) { try { this.proc.stdin.end(); this.proc.kill(); } catch (e) { } this.proc = null; } }
}

module.exports = { Auxiliar, rutaAuxiliar };
