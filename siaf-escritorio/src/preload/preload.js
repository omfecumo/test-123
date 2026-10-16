'use strict';
/* Puente mínimo entre SIAF (página web aislada) y el proceso principal.
   No expone Node.js, ni rutas arbitrarias, ni ejecución de comandos: solo estas operaciones, cada una validada
   otra vez en el proceso principal (remitente siaf://app, tipos y nombres de archivo). */
const { contextBridge, ipcRenderer } = require('electron');

const inv = (canal, ...args) => ipcRenderer.invoke(canal, ...args);

contextBridge.exposeInMainWorld('siafEscritorio', Object.freeze({
  info: () => inv('escritorio:info'),
  respaldo: Object.freeze({
    guardar: (bytes, motivo, detalle) => inv('respaldo:guardar', bytes, motivo, detalle),
    listar: () => inv('respaldo:listar'),
    verificar: nombre => inv('respaldo:verificar', nombre),
    leer: nombre => inv('respaldo:leer', nombre),
    abrirCarpeta: () => inv('respaldo:abrir-carpeta'),
  }),
  preferencias: Object.freeze({
    guardar: cambios => inv('preferencias:guardar', cambios),
    elegirEspejo: () => inv('preferencias:elegir-espejo'),
  }),
  migracion: Object.freeze({
    pendiente: () => inv('migracion:pendiente'),
    esperado: datos => inv('migracion:esperado', datos),
    resultado: reporte => inv('migracion:resultado', reporte),
  }),
  recuperacionAtendida: () => inv('recuperacion:atendida'),
  salidaLista: () => inv('salida:lista'),
  error: texto => inv('log:error', String(texto)),
  // grabación de acciones dentro de SIAF (solo envía; el proceso principal decide si hay una grabación activa)
  grabacion: Object.freeze({ evento: e => ipcRenderer.send('grabacion:evento', e) }),
  alComando: fn => { ipcRenderer.on('escritorio:comando', (_ev, msg) => fn(msg)); },
}));
