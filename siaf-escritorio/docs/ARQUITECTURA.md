# Fase 2 — Evaluación y selección de arquitectura

## Comparación

| Criterio | A. SwiftUI + WKWebView | B. Electron | C. Tauri |
|---|---|---|---|
| Compatibilidad con el HTML original | Media: motor WebKit (Safari). `showDirectoryPicker` no existe; descargas, `<input type=file>` e impresión requieren código nativo propio; IndexedDB y Web Crypto en esquemas propios tienen restricciones | **Alta**: el mismo motor Chromium en que SIAF se usa hoy; descargas, archivos, impresión, IndexedDB y Web Crypto funcionan sin adaptar | Media: en macOS usa también WKWebView (mismas limitaciones que A) |
| Mantenimiento | Swift + JS; cada API del navegador se reimplementa | JS en todo; el HTML se actualiza reemplazando un archivo | Rust + JS |
| Tamaño del instalador | ~5–10 MB | ~110–130 MB por arquitectura (universal ~220 MB) | ~10 MB |
| Rendimiento | Muy bueno | Bueno (más memoria) | Muy bueno |
| Sistema de archivos | Nativo, con puentes propios | Nativo (proceso principal) con puente limitado | Nativo con permisos declarativos |
| Seguridad | Buena si se limita el puente | Buena con `contextIsolation`, `sandbox`, CSP, fuses | Buena (capacidades) |
| Complejidad | Alta (reimplementar APIs) | **Baja** | Media-alta |
| Verificable fuera de un Mac | No | **Sí** (mismo código en Linux/Windows para pruebas) | Parcial |

## Decisión: **Electron** (alternativa B) + auxiliar nativo en Swift para la automatización

1. **Preserva el comportamiento de SIAF**: corre el archivo original sin reescribirlo, en el mismo motor que el usuario usa hoy. La única modificación es una línea `<script src="desktop-bridge.js">` añadida durante la compilación (`scripts/prepare-web.mjs`, con verificación SHA-256 del original).
2. **Riesgo de datos mínimo**: se conserva IndexedDB y toda la lógica de transacciones, verificación, bitácora y restauración de SIAF; no hay migración de esquema.
3. **Verificable**: la misma app se prueba automáticamente en Linux (este entorno) y en macOS (GitHub Actions, Apple Silicon e Intel).
4. El costo es el tamaño del instalador, aceptable para una app de escritorio profesional.

Lo que exige código nativo de macOS (Accesibilidad, eventos del sistema, grabación global) se implementó en un auxiliar Swift independiente (`native/SIAFAutomator`), invocado solo por el módulo de automatización.

## Persistencia: ¿IndexedDB o SQLite?

Se **mantiene IndexedDB** dentro de un perfil persistente propio de la app y se añade una capa nativa de respaldos:

* Migrar a SQLite obligaría a reescribir `db.js` y todos los módulos que dependen de su caché síncrona, transacciones, índices y verificación (86 puntos de escritura) — riesgo alto de alterar la lógica.
* El perfil persistente está en `~/Library/Application Support/SIAF/` (no lo borra «Borrar datos de navegación» ni depende de la ruta del HTML). El origen fijo `siaf://app` garantiza que cada actualización vea la misma base.
* La protección que faltaba (copias fuera de la base) la aporta la app: respaldos ZIP oficiales de SIAF en disco, verificados por SHA-256.

## Diagrama

```
SIAF.app
├─ Proceso principal (Node.js, src/main)
│   ├─ protocol.js      siaf://app (SIAF) · siaf://control (automatización) · siaf://ayuda — CSP, control de rutas
│   ├─ main.js          ventana, menús, permisos, descargas, cierre ordenado, instancia única, detección de cierre inesperado
│   ├─ backups.js       respaldos en disco: atómicos, SHA-256, índice, rotación, carpeta espejo
│   ├─ migracion.js     análisis previo y verificación posterior de la migración
│   └─ automation/      esquema, almacén, motor de ejecución, controladores SIAF y macOS, HUD, atajo global
├─ Ventana SIAF (Chromium aislado: contextIsolation + sandbox, sin Node.js)
│   ├─ SIAF_v9_3_3.html original
│   └─ desktop-bridge.js  respaldos automáticos, puntos de recuperación, comandos de menú, grabador/reproductor
├─ preload.js / preload-control.js   puentes mínimos (contextBridge), validados en el proceso principal
└─ Resources/bin/siaf-automator      auxiliar Swift: AXUIElement, CGEvent, CGEventTap (solo escucha)
```

## Seguridad aplicada

* `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`, `webSecurity: true` (verificado por prueba).
* CSP por cabecera: sin `eval`, sin `object`, sin marcos, sin `base-uri`; conexiones solo `https:` (sincronización opcional del usuario).
* Navegación a otros orígenes bloqueada; enlaces `https:`/`mailto:` se abren en el navegador **tras confirmación**; `window.open` denegado.
* Permisos web: solo portapapeles y sistema de archivos; cámara, micrófono, ubicación y notificaciones denegados.
* IPC: cada canal verifica el remitente (`siaf://app` o `siaf://control`) y los tipos; nombres de respaldo validados por patrón (sin recorrido de directorios).
* Fuses de Electron: sin `RunAsNode`, sin `NODE_OPTIONS`, cookies cifradas, carga solo desde `app.asar` con verificación de integridad.
* Una sola instancia (evita bloqueos de IndexedDB).
* Sin telemetría. El registro técnico (`logs/siaf.log`) oculta PIN, claves y tokens y no guarda datos de la finca.
