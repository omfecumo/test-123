# Registro de cambios — SIAF de escritorio

## 9.3.3 (escritorio 2) — 2026-10-16 · Windows

### Añadido
- Versión para **Windows 10/11, x64 y ARM64** con la misma base de código (proyecto renombrado a `siaf-escritorio/`).
- Auxiliar `siaf-automator.exe` en C# (.NET Framework 4.x incluido en Windows, sin SDK): UI Automation, SendInput, hooks de bajo nivel en modo solo lectura para grabar; omite campos de contraseña; no salta UIPI.
- Instalador NSIS por usuario (no pide administrador, elección de carpeta, accesos directos, conserva datos al desinstalar), MSI por equipo y ZIP portátil; icono `.ico`; `scripts/build-win.ps1`, `scripts/build-automator-win.ps1`; CI en Windows x64 y ARM64 con instalación y desinstalación silenciosas.
- Atajo de detención en Windows **Ctrl+Alt+Mayús+X** (Ctrl+Mayús+Esc es del Administrador de tareas); «Acerca de» y «Preferencias de respaldo» en los menús de Windows; `docs/WINDOWS.md`.

### Corregido
- `.gitattributes`: Git ya no altera el HTML original de SIAF en Windows (verificación SHA-256).
- Activación de ventanas sin abrir la barra de menús de la app; pulsaciones Unicode sin teclas repetidas.
- Tecleo con las teclas reales de la distribución de teclado (VK_PACKET solo como respaldo): en Windows 11 ARM64 el primer texto tras abrir el Bloc de notas salía alterado.
- «Abrir aplicación» espera a que la app acepte entrada; «Escribir texto» (teclear) verifica el resultado y avisa si no coincide, tras restaurar y reintentar una vez.
- Publicación automática de los ejecutables probados como versión preliminar de GitHub (`siaf-windows-v9.3.3`).

### Limitaciones conocidas
- Instaladores sin firma Authenticode (SmartScreen advierte).
- Pasos AppleScript y Atajos solo en macOS.


## 9.3.3 (escritorio 1) — 2026-10-14

Primera versión de escritorio para macOS. Versión de la app = versión de SIAF empaquetada (9.3.3).

### Añadido
- Aplicación Electron 44.5.1 que ejecuta `SIAF_v9_3_3.html` sin reescribirlo (SHA-256 verificado en cada compilación) bajo el origen fijo `siaf://app`.
- Icono propio derivado del logo de SIAF; menús nativos (Archivo, Edición, Visualización, Herramientas, Ventana, Ayuda); atajos ⌘1–⌘9, ⌘S, ⌘P, ⌘F, ⌘⌥Z, ⌘⇧T; tema claro/oscuro; ventana que recuerda tamaño y posición; ayuda integrada.
- Respaldos nativos en `~/Library/Application Support/SIAF/Respaldos`: ZIP oficial de SIAF, escritura atómica, verificación SHA-256, índice, rotación configurable, carpeta espejo, respaldo automático por intervalo, al salir y tras cierre inesperado; punto de recuperación en disco antes de restaurar, importar todo o borrar todo; indicador de estado en la barra superior; restauración desde la lista de respaldos.
- Migración verificable desde la versión HTML (análisis previo, vista previa de SIAF, verificación posterior e informe).
- «SIAF Control y Automatización»: grabación, edición, organización, exportación/importación y reproducción de secuencias; paso a paso, pausa, detener inmediato (barra flotante, ⌘⇧⎋, menú), reintentos seguros, confirmación de operaciones sensibles, detección de cambios de interfaz, puntos de recuperación, historial; automatización de apps autorizadas mediante el auxiliar Swift `siaf-automator` (Accesibilidad, CGEvent, menús, AppleScript aprobado, Atajos).
- Empaquetado `.app` universal, `.dmg`, `.zip`, `.pkg`; Hardened Runtime y entitlements mínimos; fuses de Electron; scripts de compilación; CI en macOS (Apple Silicon e Intel).
- Pruebas unitarias (29 + 2 en macOS) y de extremo a extremo (18; en macOS 17 + app instalada, en Linux 17 + app empaquetada) con evidencias.

### Corregido durante el desarrollo (encontrado por las pruebas)
- El grabador usaba el valor de un campo como texto del selector: un PIN escrito durante la grabación podía quedar en la secuencia. Ahora nunca se usa el valor de un campo como selector.
- La navegación de SIAF por `history.replaceState` no se grababa; ahora se registra antes de cada acción.
- En macOS 15 el texto «tecleado» en otras apps no llegaba (eventos Unicode por el flujo HID global): ahora se inserta con Accesibilidad (`AXSelectedText`) o con eventos dirigidos al proceso.

### Limitaciones conocidas
- Sin firma Developer ID ni notarización (no hay credenciales de Apple): firma ad-hoc.
- Respaldo en Google Drive y dictado por voz del navegador no disponibles en la app.
- Flujo de concesión/denegación de permisos de privacidad no probado con un usuario real; solo se probó macOS 15.
