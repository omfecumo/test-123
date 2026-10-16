'use strict';
/* Diferencias por sistema operativo en un solo lugar. */
const esMac = process.platform === 'darwin';
const esWin = process.platform === 'win32';

// Atajo global para detener toda automatización. En Windows NO se usa Ctrl+Mayús+Esc (abre el Administrador de tareas).
const ATAJO_DETENER = esMac ? 'Command+Shift+Escape' : 'Control+Alt+Shift+X';
const TEXTO_ATAJO_DETENER = esMac ? '⌘⇧⎋' : 'Ctrl+Alt+Mayús+X';
const AUXILIAR = esWin ? 'siaf-automator.exe' : 'siaf-automator';

module.exports = { esMac, esWin, ATAJO_DETENER, TEXTO_ATAJO_DETENER, AUXILIAR };
