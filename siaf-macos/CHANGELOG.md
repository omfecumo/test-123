# Registro de cambios — SIAF para macOS

## 9.3.3 (escritorio 1) — 2026-10-14

Primera versión de escritorio para macOS. Versión de la app = versión de SIAF empaquetada (9.3.3).

### Añadido
- Aplicación Electron 44.5.1 que ejecuta `SIAF_v9_3_3.html` sin reescribirlo (SHA-256 verificado en cada compilación) bajo el origen fijo `siaf://app`.
- Icono propio derivado del logo de SIAF; menús nativos (Archivo, Edición, Visualización, Herramientas, Ventana, Ayuda); atajos ⌘1–⌘9, ⌘S, ⌘P, ⌘F, ⌘⌥Z, ⌘⇧T; tema claro/oscuro; ventana que recuerda tamaño y posición; ayuda integrada.
- Respaldos nativos en `~/Library/Application Support/SIAF/Respaldos`: ZIP oficial de SIAF, escritura atómica, verificación SHA-256, índice, rotación configurable, carpeta espejo, respaldo automático por intervalo, al salir y tras cierre inesperado; punto de recuperación en disco antes de restaurar, importar todo o borrar todo; indicador de estado en la barra superior; restauración desde la lista de respaldos.
- Migración verificable desde la versión HTML (análisis previo, vista previa de SIAF, verificación posterior e informe).
- «SIAF Control y Automatización»: grabación, edición, organización, exportación/importación y reproducción de secuencias; paso a paso, pausa, detener inmediato (barra flotante, ⌘⇧⎋, menú), reintentos seguros, confirmación de operaciones sensibles, detección de cambios de interfaz, puntos de recuperación, historial; automatización de apps autorizadas mediante el auxiliar Swift `siaf-automator` (Accesibilidad, CGEvent, menús, AppleScript aprobado, Atajos).
- Empaquetado `.app` universal, `.dmg`, `.zip`, `.pkg`; Hardened Runtime y entitlements mínimos; fuses de Electron; scripts de compilación; CI en macOS (Apple Silicon e Intel).
- Pruebas unitarias (29 + 2 en macOS) y de extremo a extremo (18) con evidencias.

### Corregido durante el desarrollo (encontrado por las pruebas)
- El grabador usaba el valor de un campo como texto del selector: un PIN escrito durante la grabación podía quedar en la secuencia. Ahora nunca se usa el valor de un campo como selector.
- La navegación de SIAF por `history.replaceState` no se grababa; ahora se registra antes de cada acción.

### Limitaciones conocidas
- Sin firma Developer ID ni notarización (no hay credenciales de Apple): firma ad-hoc.
- Respaldo en Google Drive y dictado por voz del navegador no disponibles en la app.
- Automatización de otras apps no probada en un Mac con permisos concedidos (requiere intervención manual).
