'use strict';
/* Puente de la ventana «SIAF Control y Automatización» (origen siaf://control, distinto del de SIAF).
   Cada operación se valida de nuevo en el proceso principal. */
const { contextBridge, ipcRenderer } = require('electron');

const inv = (c, ...a) => ipcRenderer.invoke(c, ...a);
contextBridge.exposeInMainWorld('siafControl', Object.freeze({
  info: () => inv('ctrl:info'),
  listar: () => inv('ctrl:listar'),
  obtener: id => inv('ctrl:obtener', id),
  guardar: s => inv('ctrl:guardar', s),
  eliminar: id => inv('ctrl:eliminar', id),
  duplicar: id => inv('ctrl:duplicar', id),
  describir: (paso, objetivo) => inv('ctrl:describir', { paso, objetivo }),
  validar: s => inv('ctrl:validar', s),
  exportar: id => inv('ctrl:exportar', id),
  importar: () => inv('ctrl:importar'),
  grabar: (objetivo, opciones) => inv('ctrl:grabar', objetivo, opciones),
  detenerGrabacion: () => inv('ctrl:grabar-detener'),
  ejecutar: (id, opciones) => inv('ctrl:ejecutar', id, opciones),
  pausar: () => inv('ctrl:pausar'),
  continuar: () => inv('ctrl:continuar'),
  avanzar: () => inv('ctrl:avanzar'),
  detener: () => inv('ctrl:detener'),
  manual: ok => inv('ctrl:manual', ok),
  historial: () => inv('ctrl:historial'),
  permisos: () => inv('ctrl:permisos'),
  pedirAccesibilidad: () => inv('ctrl:pedir-accesibilidad'),
  pedirMonitor: () => inv('ctrl:pedir-monitor'),
  abrirAjustes: panel => inv('ctrl:abrir-ajustes', panel),
  apps: () => inv('ctrl:apps'),
  appsEnEjecucion: () => inv('ctrl:apps-en-ejecucion'),
  autorizarApp: (bundleId, nombre) => inv('ctrl:autorizar-app', bundleId, nombre),
  revocarApp: b => inv('ctrl:revocar-app', b),
  aprobarScript: (secId, pasoId) => inv('ctrl:aprobar-script', secId, pasoId),
  aprobado: hash => inv('ctrl:aprobado', hash),
  atajos: () => inv('ctrl:atajos'),
  alEvento: fn => { ipcRenderer.on('ctrl:evento', (_e, d) => fn(d)); },
}));
