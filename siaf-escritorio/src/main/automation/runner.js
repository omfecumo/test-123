'use strict';
/* Motor de ejecución de secuencias. Independiente de Electron (se prueba con controladores simulados).
   Garantías:
   - pausa / continuar / detener inmediatos (también durante esperas largas);
   - modo paso a paso (cada paso espera «Siguiente»);
   - reintentos SOLO en pasos sin efectos secundarios o marcados explícitamente como seguros;
   - confirmación obligatoria antes de pasos destructivos, financieros o de efecto desconocido;
   - pasos manuales (campos protegidos, selección de archivos) se detienen para que el usuario actúe;
   - si la interfaz no coincide con lo esperado, la secuencia se detiene con un mensaje comprensible;
   - puntos de recuperación: permiten reanudar desde el último punto alcanzado. */
const { EventEmitter } = require('events');
const { esDestructivo, describirPaso, IDEMPOTENTES, MANUALES, nuevoId } = require('./schema');

class Detenida extends Error { constructor(m) { super(m); this.detenida = true; } }

class Ejecucion extends EventEmitter {
  /**
   * @param secuencia  secuencia validada (schema.limpiarSecuencia)
   * @param driver     { preparar(sec), verificarContexto(paso), inspeccionar(paso), ejecutar(paso, timeoutMs), comprobar(c), finalizar() }
   * @param ui         { confirmar(titulo, detalle) → Promise<bool>, manual(paso, texto) → Promise<bool> }
   * @param opciones   { modo: 'auto'|'pasoAPaso', desde: índice, esperaPasoMs, timeoutMs, reintentos }
   */
  constructor(secuencia, driver, ui, opciones = {}) {
    super();
    this.id = nuevoId('e');
    this.sec = secuencia;
    this.driver = driver;
    this.ui = ui;
    this.modo = opciones.modo === 'pasoAPaso' ? 'pasoAPaso' : 'auto';
    this.desde = Math.max(0, Math.min(Number(opciones.desde) || 0, secuencia.pasos.length));
    this.op = { ...secuencia.opciones, ...(opciones.sobrescribir || {}) };
    this.estado = 'preparada';
    this.indice = this.desde;
    this.ultimoPunto = null;
    this.pasosOk = 0;
    this.registro = [];
    this._despertar = null;
    this._permisoAvanzar = false;
  }

  // ---------- controles ----------
  pausar() { if (this.estado === 'ejecutando') { this.estado = 'pausada'; this.emit('estado', this.resumen()); } }
  continuar() { if (this.estado === 'pausada') { this.estado = 'ejecutando'; this.emit('estado', this.resumen()); this._wake(); } }
  avanzar() { this._permisoAvanzar = true; if (this.estado === 'pausada') this.estado = 'ejecutando'; this._wake(); }
  detener(motivo = 'Detenida por el usuario') {
    if (['completada', 'detenida', 'error'].includes(this.estado)) return;
    this.motivoDetencion = motivo; this.estado = 'deteniendo'; this._wake();
  }
  _wake() { const w = this._despertar; this._despertar = null; if (w) w(); }
  _dormir(ms) {
    return new Promise(res => {
      const t = setTimeout(() => { this._despertar = null; res(); }, ms);
      this._despertar = () => { clearTimeout(t); res(); };
    });
  }
  _comprobarDetencion() { if (this.estado === 'deteniendo') throw new Detenida(this.motivoDetencion); }
  async _puerta(soloPausa = false) {
    for (; ;) {
      this._comprobarDetencion();
      if (this.estado === 'pausada') { await this._dormir(3600000); continue; }
      if (soloPausa) return;
      if (this.modo === 'pasoAPaso' && !this._permisoAvanzar) {
        this.emit('esperandoAvance', { indice: this.indice, paso: this.sec.pasos[this.indice] });
        await this._dormir(3600000); continue;
      }
      this._permisoAvanzar = false;
      return;
    }
  }
  async _esperaCancelable(ms) {
    const fin = Date.now() + ms;
    while (Date.now() < fin) {
      this._comprobarDetencion();
      if (this.estado === 'pausada') { await this._puerta(true); continue; }
      await this._dormir(Math.min(250, fin - Date.now()));
    }
  }

  resumen() {
    return { id: this.id, secuenciaId: this.sec.id, nombre: this.sec.nombre, objetivo: this.sec.objetivo, modo: this.modo, estado: this.estado, indice: this.indice, total: this.sec.pasos.length, pasosOk: this.pasosOk, ultimoPunto: this.ultimoPunto, error: this.error || null, inicio: this.inicio, fin: this.fin };
  }
  _anotar(i, resultado, detalle = '') {
    const p = this.sec.pasos[i];
    const r = { indice: i, tipo: p.tipo, descripcion: describirPaso(p), resultado, detalle: String(detalle).slice(0, 300), t: new Date().toISOString() };
    this.registro.push(r); this.emit('pasoTerminado', r);
  }

  // ---------- ejecución ----------
  async ejecutar() {
    this.inicio = new Date().toISOString();
    this.estado = 'ejecutando'; this.emit('estado', this.resumen());
    try {
      await this.driver.preparar(this.sec);
      for (this.indice = this.desde; this.indice < this.sec.pasos.length; this.indice++) {
        await this._puerta();
        const i = this.indice, paso = this.sec.pasos[i];
        this.emit('paso', { indice: i, total: this.sec.pasos.length, paso, descripcion: describirPaso(paso) });
        const salto = await this._ejecutarPaso(paso, i);
        this.pasosOk++;
        if (salto) this.indice += salto;
        if (this.op.esperaPasoMs) await this._esperaCancelable(this.op.esperaPasoMs);
      }
      this.estado = 'completada';
    } catch (e) {
      if (e.detenida) { this.estado = 'detenida'; this.error = e.message; if (this.indice < this.sec.pasos.length) this._anotar(this.indice, 'detenido', e.message); }
      else { this.estado = 'error'; this.error = e.message; this._anotar(Math.min(this.indice, this.sec.pasos.length - 1), 'error', e.message); }
    } finally {
      this.fin = new Date().toISOString();
      try { await this.driver.finalizar(); } catch (e) { /* nada */ }
      this.emit('estado', this.resumen());
      this.emit('fin', this.resumen());
    }
    return this.resumen();
  }

  /** Ejecuta un paso; devuelve cuántos pasos saltar después (0 normalmente). */
  async _ejecutarPaso(paso, i) {
    const timeout = paso.timeoutMs || this.op.timeoutMs;
    switch (paso.tipo) {
      case 'esperar': await this._esperaCancelable(paso.ms); this._anotar(i, 'ok'); return 0;
      case 'punto': this.ultimoPunto = { indice: i, etiqueta: paso.etiqueta }; this._anotar(i, 'ok', 'Punto de recuperación alcanzado'); return 0;
      case 'confirmar': {
        const ok = await this.ui.confirmar(paso.mensaje, `Secuencia «${this.sec.nombre}», paso ${i + 1}.`);
        this._comprobarDetencion();
        if (!ok) throw new Detenida('El usuario no confirmó la continuación.');
        this._anotar(i, 'ok', 'Confirmado por el usuario'); return 0;
      }
      case 'condicion': {
        const cumple = await this.driver.comprobar(paso.comprobacion, timeout);
        this._anotar(i, 'ok', cumple ? 'Condición cumplida' : `Condición NO cumplida → ${paso.siFalla}`);
        if (cumple || paso.siFalla === 'continuar') return 0;
        if (paso.siFalla === 'saltar') return paso.saltar;
        throw new Detenida('La condición no se cumplió; la secuencia se detuvo según lo configurado.');
      }
      default: break;
    }
    if (MANUALES.has(paso.tipo)) {
      const ok = await this.ui.manual(paso, paso.nota || 'Complete este paso manualmente y pulse «Continuar».');
      this._comprobarDetencion();
      if (!ok) throw new Detenida('Paso manual no completado.');
      this._anotar(i, 'ok', 'Completado manualmente'); return 0;
    }
    // la interfaz debe coincidir con lo esperado antes de actuar
    await this.driver.verificarContexto(paso, timeout);
    // operaciones destructivas, financieras o de efecto desconocido: confirmación explícita, siempre
    let destructivo = esDestructivo(paso);
    if (!destructivo && this.driver.inspeccionar && ['clic', 'pulsar', 'enviar'].includes(paso.tipo)) {
      const ins = await this.driver.inspeccionar(paso, Math.min(timeout, 4000));
      destructivo = !!(ins && ins.peligro);
    }
    if (destructivo) {
      const ok = await this.ui.confirmar(`Confirmar operación sensible: ${describirPaso(paso)}`, `La secuencia «${this.sec.nombre}» va a ejecutar una acción que puede borrar, reemplazar, vender, pagar o enviar información. ¿Desea ejecutarla?`);
      this._comprobarDetencion();
      if (!ok) throw new Detenida('Operación sensible no confirmada: secuencia detenida.');
    }
    const reintentos = IDEMPOTENTES.has(paso.tipo) || paso.reintentoSeguro ? this.op.reintentos : 0;
    for (let intento = 0; ; intento++) {
      try {
        await this.driver.ejecutar(paso, timeout);
        this._anotar(i, 'ok', intento ? `Correcto tras ${intento} reintento(s)` : '');
        return 0;
      } catch (e) {
        this._comprobarDetencion();
        if (intento >= reintentos) throw e;
        this.emit('reintento', { indice: i, intento: intento + 1, error: e.message });
        await this._esperaCancelable(500 * (intento + 1));
      }
    }
  }
}

module.exports = { Ejecucion, Detenida };
