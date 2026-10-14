'use strict';
/* Preferencias de la aplicación de escritorio (no son datos de la finca). Escritura atómica. */
const fs = require('fs');
const path = require('path');

const PREDETERMINADA = {
  respaldoAuto: true,          // copia automática del contenido de SIAF a disco
  intervaloHoras: 4,           // cada cuántas horas, si hubo cambios
  retenerAuto: 30,             // cuántas copias automáticas se conservan
  retenerPuntos: 20,           // cuántos puntos de recuperación previos a restaurar/borrar se conservan
  respaldoAlSalir: true,       // al cerrar la aplicación, si hubo cambios
  carpetaEspejo: '',           // segunda carpeta (disco externo, iCloud Drive…) donde se copia cada respaldo
  ventana: null,               // posición y tamaño de la ventana principal
  sesionAbierta: false,        // queda en true si la aplicación no se cerró correctamente
  automatizacion: { atajoDetener: 'CommandOrControl+Shift+Escape', esperaPasoMs: 400, timeoutMs: 8000 },
};

function escribirAtomico(archivo, texto) {
  const tmp = `${archivo}.${process.pid}.tmp`;
  const fd = fs.openSync(tmp, 'w');
  try { fs.writeSync(fd, texto); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  fs.renameSync(tmp, archivo);
}

class Config {
  constructor(dir) {
    this.archivo = path.join(dir, 'preferencias.json');
    this.datos = structuredClone(PREDETERMINADA);
    try {
      const leido = JSON.parse(fs.readFileSync(this.archivo, 'utf8'));
      this.datos = { ...this.datos, ...leido, automatizacion: { ...PREDETERMINADA.automatizacion, ...(leido.automatizacion || {}) } };
    } catch (e) { /* primera ejecución o archivo dañado: se usan valores predeterminados */ }
  }
  get(k) { return this.datos[k]; }
  set(cambios) {
    const permitidas = ['respaldoAuto', 'intervaloHoras', 'retenerAuto', 'retenerPuntos', 'respaldoAlSalir', 'carpetaEspejo', 'ventana', 'sesionAbierta', 'automatizacion'];
    for (const [k, v] of Object.entries(cambios || {})) if (permitidas.includes(k)) this.datos[k] = v;
    this.datos.intervaloHoras = Math.min(168, Math.max(1, Number(this.datos.intervaloHoras) || 4));
    this.datos.retenerAuto = Math.min(500, Math.max(3, Number(this.datos.retenerAuto) || 30));
    this.datos.retenerPuntos = Math.min(500, Math.max(3, Number(this.datos.retenerPuntos) || 20));
    escribirAtomico(this.archivo, JSON.stringify(this.datos, null, 2));
    return this.datos;
  }
  publica() {
    const { respaldoAuto, intervaloHoras, retenerAuto, retenerPuntos, respaldoAlSalir, carpetaEspejo } = this.datos;
    return { respaldoAuto, intervaloHoras, retenerAuto, retenerPuntos, respaldoAlSalir, carpetaEspejo };
  }
}

module.exports = { Config, escribirAtomico, PREDETERMINADA };
