'use strict';
/* Controlador «otras aplicaciones de macOS». Orden de preferencia de mecanismos:
     1. API de Accesibilidad (AXUIElement) a través del auxiliar nativo: pulsar controles, leer/escribir valores,
        recorrer menús. Es el mecanismo principal y el más robusto.
     2. Eventos de teclado sintéticos (CGEvent) para combinaciones de teclas o texto en modo «teclear».
     3. Clic por posición relativa a la ventana (automatización visual) SOLO como complemento cuando la app no
        expone controles accesibles.
     4. AppleScript / Apple Events para apps con diccionario de scripting — solo scripts aprobados por huella.
     5. Atajos (Shortcuts) mediante /usr/bin/shortcuts run <nombre>.
   Antes de cada paso se comprueba que la app al frente es la autorizada; si no lo es, se intenta traerla al frente
   y, si la ventana no coincide con la grabada, la secuencia se detiene («la interfaz cambió»). */
const { execFile } = require('child_process');
const { MANUALES } = require('./schema');

const ejecutarArchivo = (bin, args, entrada, timeoutMs = 60000) => new Promise((res, rej) => {
  const p = execFile(bin, args, { timeout: timeoutMs, maxBuffer: 1024 * 1024 }, (e, out, err) => e ? rej(new Error((err || e.message).toString().trim().slice(0, 400))) : res(String(out).trim()));
  if (entrada != null) { p.stdin.write(entrada); p.stdin.end(); }
});

class DriverMacOS {
  constructor(auxiliar, almacen) { this.aux = auxiliar; this.almacen = almacen; this.objetivo = null; }

  async preparar(sec) {
    this.objetivo = sec.objetivo.bundleId;
    if (!this.almacen.appAutorizada(this.objetivo)) throw new Error(`La aplicación ${sec.objetivo.nombreApp || this.objetivo} no está autorizada. Autorícela en «Permisos y aplicaciones».`);
    const necesitaAX = sec.pasos.some(p => !['esperar', 'confirmar', 'punto', 'applescript', 'atajo', 'abrirApp'].includes(p.tipo) && !MANUALES.has(p.tipo));
    if (necesitaAX) {
      const d = this.aux.disponible(); if (!d.ok) throw new Error(d.motivo);
      const per = await this.aux.pedir('permisos');
      if (!per.accesibilidad) throw new Error('SIAF no tiene permiso de Accesibilidad. Actívelo en Ajustes del Sistema → Privacidad y seguridad → Accesibilidad.');
    }
    for (const p of sec.pasos) if (p.tipo === 'applescript' && !this.almacen.aprobado(p.hash)) throw new Error(`El paso AppleScript ${sec.pasos.indexOf(p) + 1} no está aprobado en este equipo. Revíselo y apruébelo antes de ejecutar.`);
  }

  async verificarContexto(paso, timeoutMs) {
    if (['abrirApp', 'activarApp', 'applescript', 'atajo', 'esperar', 'confirmar', 'punto'].includes(paso.tipo) || MANUALES.has(paso.tipo)) return;
    let f = await this.aux.pedir('frontal');
    if (f.bundleId !== this.objetivo) {
      await this.aux.pedir('activar', { bundleId: this.objetivo });
      const t0 = Date.now();
      while (f.bundleId !== this.objetivo && Date.now() - t0 < Math.min(timeoutMs, 5000)) { await new Promise(r => setTimeout(r, 200)); f = await this.aux.pedir('frontal'); }
      if (f.bundleId !== this.objetivo) throw new Error(`La interfaz cambió: la aplicación al frente es «${f.nombre || f.bundleId}», no la autorizada.`);
    }
    const esperada = paso.contexto && paso.contexto.ventana;
    if (esperada && f.ventana && f.ventana !== esperada && !(paso.elemento && paso.elemento.ventana === '')) {
      // la ventana puede cambiar de título legítimamente (documento nuevo): solo se avisa si el elemento no aparece
      this.avisoVentana = `Ventana esperada «${esperada}», actual «${f.ventana}».`;
    }
  }

  async inspeccionar(paso, timeoutMs) {
    if (!paso.elemento) return { encontrado: true };
    try { const r = await this.aux.pedir('buscar', { bundleId: this.objetivo, elemento: paso.elemento, timeoutMs }, timeoutMs + 2000); return { encontrado: !!r, peligro: false, texto: r && r.titulo }; } catch (e) { return { encontrado: false }; }
  }

  async ejecutar(paso, timeoutMs) {
    const b = this.objetivo; const t = timeoutMs + 3000;
    const conAviso = async promesa => { try { return await promesa; } catch (e) { throw new Error(e.message + (this.avisoVentana ? ' ' + this.avisoVentana : '')); } };
    switch (paso.tipo) {
      case 'abrirApp': return this.aux.disponible().ok ? this.aux.pedir('abrir', { bundleId: paso.bundleId || b }, t) : ejecutarArchivo('/usr/bin/open', ['-b', paso.bundleId || b]);
      case 'activarApp': return this.aux.pedir('activar', { bundleId: paso.bundleId || b }, t);
      case 'pulsar': return conAviso(this.aux.pedir('pulsar', { bundleId: b, elemento: paso.elemento, timeoutMs }, t));
      case 'escribirTexto': return conAviso(this.aux.pedir('escribir', { bundleId: b, elemento: paso.elemento || null, texto: paso.texto, modo: paso.modo, timeoutMs }, t + paso.texto.length * 30));
      case 'teclas': return this.aux.pedir('teclas', { bundleId: b, combinacion: paso.combinacion }, t);
      case 'menu': return conAviso(this.aux.pedir('menu', { bundleId: b, ruta: paso.ruta, timeoutMs }, t));
      case 'clicRelativo': return conAviso(this.aux.pedir('clicRelativo', { bundleId: b, x: paso.x, y: paso.y, boton: paso.boton, dobles: paso.dobles }, t));
      case 'esperarElemento': return conAviso(this.aux.pedir('buscar', { bundleId: b, elemento: paso.elemento, timeoutMs }, t));
      case 'validarValor': {
        const r = await conAviso(this.aux.pedir('leer', { bundleId: b, elemento: paso.elemento, timeoutMs }, t));
        if (!String(r && r.valor || '').toLowerCase().includes(paso.contiene.toLowerCase())) {
          let diag = '';
          // SIAF_DIAGNOSTICO=1 (solo pruebas): añade contexto técnico. En uso normal no se expone el contenido leído.
          if (process.env.SIAF_DIAGNOSTICO === '1') { const f = await this.aux.pedir('frontal').catch(() => ({})); diag = ` [diag: frente=${f.bundleId} ventana=«${f.ventana}» valor(${String(r && r.valor || '').length})=«${String(r && r.valor || '').slice(0, 60)}»]`; }
          throw new Error(`Validación fallida: el control no contiene «${paso.contiene}».${diag}`);
        }
        return r;
      }
      case 'applescript':
        if (!this.almacen.aprobado(paso.hash)) throw new Error('AppleScript no aprobado.');
        return ejecutarArchivo('/usr/bin/osascript', ['-'], paso.fuente, timeoutMs + 60000);
      case 'atajo':
        if (!paso.nombre) throw new Error('Falta el nombre del atajo.');
        return ejecutarArchivo('/usr/bin/shortcuts', ['run', paso.nombre], null, timeoutMs + 120000);
      default: throw new Error(`Tipo de paso no admitido para aplicaciones: ${paso.tipo}`);
    }
  }

  async comprobar(c, timeoutMs) {
    try {
      if (c.tipo === 'textoPresente') { const r = await this.aux.pedir('leer', { bundleId: this.objetivo, elemento: c.elemento, timeoutMs }, timeoutMs + 2000); return String(r.valor || '').toLowerCase().includes(String(c.contiene).toLowerCase()); }
      return !!(await this.aux.pedir('buscar', { bundleId: this.objetivo, elemento: c.elemento, timeoutMs }, timeoutMs + 2000));
    } catch (e) { return false; }
  }

  async finalizar() { this.avisoVentana = null; }
}

module.exports = { DriverMacOS, ejecutarArchivo };
