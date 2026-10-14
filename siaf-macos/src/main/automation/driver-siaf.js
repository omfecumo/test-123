'use strict';
/* Controlador «SIAF»: reproduce pasos dentro de la propia ventana de SIAF mediante el reproductor que instala
   desktop-bridge.js (window.__siafPlayer). Los datos del paso se pasan como JSON literal: el reproductor nunca
   evalúa código recibido y no escribe en campos protegidos (PIN, contraseñas, frases de cifrado). */

class DriverSIAF {
  constructor(obtenerVentana) { this.ventana = obtenerVentana; }
  _wc() {
    const v = this.ventana();
    if (!v || v.isDestroyed()) throw new Error('La ventana de SIAF no está abierta.');
    return v.webContents;
  }
  _llamar(metodo, ...args) {
    const cuerpo = args.map(a => JSON.stringify(a === undefined ? null : a)).join(', ');
    return this._wc().executeJavaScript(`window.__siafPlayer && window.__siafPlayer.${metodo}(${cuerpo})`, true);
  }
  async preparar() {
    const e = await this._llamar('estado');
    if (!e) throw new Error('El reproductor de SIAF no está disponible (¿la ventana terminó de cargar?).');
    if (!e.sesion) throw new Error('Inicie sesión en SIAF antes de ejecutar la secuencia.');
    if (e.grabando) throw new Error('Detenga la grabación antes de reproducir.');
  }
  async verificarContexto(paso) {
    const e = await this._llamar('estado');
    if (!e || !e.sesion) throw new Error('La sesión de SIAF se cerró durante la ejecución.');
    // La ruta y el modal esperados se verifican al localizar el elemento (espera acotada y mensaje «la interfaz cambió»).
    return e;
  }
  inspeccionar(paso, timeoutMs) { return this._llamar('inspeccionar', paso, timeoutMs); }
  async ejecutar(paso, timeoutMs) {
    try { return await this._llamar('ejecutar', paso, timeoutMs); }
    catch (e) { throw new Error(String(e.message || e).replace(/^Error invoking remote method.*?: /, '').replace(/^Error: /, '')); }
  }
  async comprobar(c, timeoutMs) {
    if (c.tipo === 'textoPresente') { try { await this._llamar('ejecutar', { tipo: 'validarTexto', selector: c.selector, contiene: c.contiene }, timeoutMs); return true; } catch (e) { return false; } }
    const r = await this._llamar('inspeccionar', { tipo: 'clic', selector: c.selector }, timeoutMs);
    return !!(r && r.encontrado);
  }
  async finalizar() { }
}

module.exports = { DriverSIAF };
