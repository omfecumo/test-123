'use strict';
/* Menús nativos de macOS. Las acciones de datos se ejecutan dentro de SIAF (mismos permisos por rol y mismas
   confirmaciones que la versión HTML); el menú solo las invoca. */
const { Menu } = require('electron');

function construirMenu(a, { esMac, desarrollo }) {
  const ir = ruta => () => a.comando('ir', { ruta });
  const plantilla = [];
  if (esMac) {
    plantilla.push({
      label: 'SIAF',
      submenu: [
        { role: 'about', label: 'Acerca de SIAF' },
        { type: 'separator' },
        { label: 'Preferencias de respaldo…', accelerator: 'Command+,', click: () => a.comando('preferencias') },
        { type: 'separator' },
        { role: 'services', label: 'Servicios' },
        { type: 'separator' },
        { role: 'hide', label: 'Ocultar SIAF' },
        { role: 'hideOthers', label: 'Ocultar otros' },
        { role: 'unhide', label: 'Mostrar todo' },
        { type: 'separator' },
        { role: 'quit', label: 'Salir de SIAF' },
      ],
    });
  }
  plantilla.push({
    label: 'Archivo',
    submenu: [
      { label: 'Crear respaldo ahora', accelerator: 'CommandOrControl+S', click: () => a.comando('respaldo-manual') },
      { label: 'Restaurar desde un respaldo de la app…', click: () => a.comando('restaurar-lista') },
      { label: 'Restaurar desde un archivo… (Configuración → Respaldo)', click: ir('configuracion') },
      { label: 'Migrar datos desde SIAF (navegador)…', click: () => a.migrar() },
      { type: 'separator' },
      { label: 'Abrir carpeta de respaldos', click: () => a.abrirCarpetaRespaldos() },
      { label: 'Verificar integridad de los respaldos', click: () => a.verificarRespaldos() },
      { type: 'separator' },
      { label: 'Reportes y exportación', click: ir('reportes') },
      { label: 'Imprimir / Guardar como PDF…', accelerator: 'CommandOrControl+P', click: () => a.comando('imprimir') },
      ...(esMac ? [] : [{ type: 'separator' }, { role: 'quit', label: 'Salir' }]),
    ],
  });
  plantilla.push({
    label: 'Edición',
    submenu: [
      { role: 'undo', label: 'Deshacer escritura' },
      { role: 'redo', label: 'Rehacer escritura' },
      { label: 'Deshacer último cambio de SIAF', accelerator: 'CommandOrControl+Alt+Z', click: () => a.comando('deshacer-siaf') },
      { type: 'separator' },
      { role: 'cut', label: 'Cortar' },
      { role: 'copy', label: 'Copiar' },
      { role: 'paste', label: 'Pegar' },
      { role: 'selectAll', label: 'Seleccionar todo' },
      { type: 'separator' },
      { label: 'Buscar en SIAF…', accelerator: 'CommandOrControl+F', click: () => a.comando('buscar') },
    ],
  });
  plantilla.push({
    label: 'Visualización',
    submenu: [
      { label: 'Mapa de la finca', accelerator: 'CommandOrControl+1', click: ir('mapa') },
      { label: 'Resumen', accelerator: 'CommandOrControl+2', click: ir('dashboard') },
      { label: 'Ganado', accelerator: 'CommandOrControl+3', click: ir('ganado') },
      { label: 'Lotes', accelerator: 'CommandOrControl+4', click: ir('lotes') },
      { label: 'Inventario', accelerator: 'CommandOrControl+5', click: ir('inventario') },
      { label: 'Agenda y tareas', accelerator: 'CommandOrControl+6', click: ir('tareas') },
      { label: 'Reportes', accelerator: 'CommandOrControl+7', click: ir('reportes') },
      { label: 'Bitácora', accelerator: 'CommandOrControl+8', click: ir('bitacora') },
      { label: 'Configuración', accelerator: 'CommandOrControl+9', click: ir('configuracion') },
      { type: 'separator' },
      { label: 'Alternar tema claro/oscuro', accelerator: 'CommandOrControl+Shift+T', click: () => a.comando('tema') },
      { role: 'resetZoom', label: 'Tamaño real' },
      { role: 'zoomIn', label: 'Acercar' },
      { role: 'zoomOut', label: 'Alejar' },
      { type: 'separator' },
      { role: 'togglefullscreen', label: 'Pantalla completa' },
      ...(desarrollo ? [{ type: 'separator' }, { role: 'reload', label: 'Recargar' }, { role: 'toggleDevTools', label: 'Herramientas de desarrollo' }] : []),
    ],
  });
  plantilla.push({
    label: 'Herramientas',
    submenu: [
      { label: 'SIAF Control y Automatización…', accelerator: 'CommandOrControl+Shift+A', click: () => a.control() },
      { label: 'Detener toda automatización', accelerator: 'CommandOrControl+Shift+Escape', click: () => a.detenerAutomatizacion() },
      { label: 'Permisos de macOS para automatización…', click: () => a.permisos() },
      { type: 'separator' },
      { label: 'Estado del almacenamiento y respaldos', click: () => a.comando('estado') },
      { label: 'Abrir registro técnico', click: () => a.abrirRegistro() },
    ],
  });
  plantilla.push({ role: 'windowMenu', label: 'Ventana' });
  plantilla.push({
    role: 'help',
    label: 'Ayuda',
    submenu: [
      { label: 'Manual de SIAF para macOS', click: () => a.ayuda() },
      { label: 'Respaldos y recuperación', click: () => a.ayuda('respaldos') },
      { label: 'Migración desde la versión HTML', click: () => a.ayuda('migracion') },
      { label: 'Automatización y permisos', click: () => a.ayuda('automatizacion') },
      { label: 'Solución de problemas', click: () => a.ayuda('problemas') },
    ],
  });
  return Menu.buildFromTemplate(plantilla);
}

module.exports = { construirMenu };
