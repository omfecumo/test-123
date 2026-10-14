# Fase 1 — Auditoría técnica de `SIAF_v9_3_3.html`

Archivo auditado: `source/SIAF_v9_3_3.html` · 2 831 300 bytes · 8 853 líneas · SHA-256 `979fd17eb7da2a9a8de2bb12eaf52e7951a34d2bb41e5b8ae134fb6a230de738`.

La auditoría combinó lectura del código y **ejecución real**: el archivo se abrió sin cambios en Chromium (como lo usa hoy el usuario) y dentro de la app de escritorio, y cada sección se recorrió con pruebas automatizadas (`tests/e2e/06-modulos.spec.js`, resultado en `evidencias/modulos.json`). Nada se da por operativo solo por aparecer en el código.

## 1. Arquitectura actual

Aplicación de página única, sin servidor ni dependencias remotas para arrancar. Un único HTML con 1 bloque `<style>` y 33 bloques `<script>` que reproducen los archivos de un proyecto modular original:

| Capa | Bloques (nombre original) | Función |
|---|---|---|
| Datos incrustados | `data/plano.js` (370 KB) | Plano vectorial de la finca (polígonos de lotes, infraestructura, agua) |
| Núcleo | `util.js`, `db.js`, `auth.js`, `domain.js`, `seed.js`, `app.js` | Utilidades, base de datos, usuarios, reglas de negocio, carga inicial, navegación |
| Bibliotecas | `chart.umd.min.js` (Chart.js 4.5.1), SheetJS 0.18.5 + codepages, `iconos.js` (Lucide) | Gráficos, Excel/ODS/CSV, íconos — todas **locales** |
| Vistas | `v_mapa`, `v_dashboard`, `v_ganado`, `v_tareas`, `v_inventario`, `v_maquinaria`, `v_agri`, `v_infra`, `v_reportes`, `v_lluvia`, `v_fert`, `v_aforo`, `v_config` | Pantallas de cada módulo |
| Evoluciones | `rapido.js`, `demo.js`, `siaf6.js`, `siaf7.js`, `siaf8.js`, `siaf9.js` | Buscador global, demostración, seguridad, respaldo cifrado, importación, sincronización, ganadería integrada, papelera |

## 2. Funciones, formularios y menús verificados

26 secciones registradas en `App.RUTAS`; **todas se abren y se dibujan sin errores** dentro de la app (prueba automatizada):

mapa · dashboard (resumen) · indicadores · ganado · lotes · rotación · ganadería y pasto · aforo · fertilización · pluviosidad · tareas · alertas · asistente · inventario · agricultura · maquinaria · mantenimiento · infraestructura · agua · ambiental · costos · finanzas · reportes · bitácora · calidad · configuración.

Flujos ejercitados de punta a punta (no solo renderizado): registro de animal con fotografía, ficha individual, creación y edición de tareas, buscador global, importación de animales desde CSV con vista previa y descarte de filas inválidas, plantilla Excel, exportación JSON y Excel, restauración con vista previa e integridad, cambio obligatorio de PIN, bloqueo por intentos fallidos, permisos por rol, asistente de consultas («costos del mes»).

## 3. Dependencias

* **Internas:** todas incrustadas (Chart.js, SheetJS, Lucide, plano). Funciona sin Internet.
* **Externas opcionales:** Google Identity Services + Google Drive API (respaldo en Drive, `siaf8.js`) y un proyecto Supabase configurado por el usuario (sincronización, `siaf8.js`). Ninguna es necesaria para arrancar.
* **Del navegador:** IndexedDB, `localStorage`, Web Crypto (`crypto.subtle`), `CompressionStream`, File System Access API (`showDirectoryPicker`), Speech Recognition (dictado), Service Worker/PWA, `window.print`, descargas por `<a download>`, `BroadcastChannel`.

## 4. Almacenamiento y recuperación

* **IndexedDB** `siaf_finca`, versión 5: 29 colecciones (`config, lotes, animales, eventos, movimientos, ocupaciones, planes, insumos, movinv, equipos, mantenimientos, infra, agua, ambiental, tareas, cultivos, labores, costos, usuarios, auditoria, fotos, lluvias, fertilizaciones, aforos, lotesganado, incorporaciones, ventaspasto, histgan, papelera`) + 3 internas (`_ops`, `_meta`, `_conf`).
* Escritura transaccional con `durability: 'strict'` y **relectura de verificación**; bitácora automática de cada cambio; metadatos por registro (`_v`, `_h` SHA-256, `_dev`…).
* Fotos como `dataUrl` en la colección `fotos` (no se cargan en memoria).
* Puntos de restauración (`Recuperacion`) y esquema versionado (`Migracion`) — **guardados en la misma base IndexedDB**.
* `localStorage`: sesión (`siaf_sesion`), intentos fallidos, tema, id de dispositivo, avisos vistos, último respaldo.

## 5. Importación y exportación

Respaldo JSON formato 2 con huella SHA-256; ZIP con manifiesto, huellas y CSV por colección (`Resp8`); respaldo cifrado AES-256-GCM (PBKDF2); Excel por hojas; CSV; PDF por impresión; importación de animales e insumos desde Excel/ODS/CSV con mapeo de columnas y validación por fila; plantillas descargables.

## 6. Autenticación, roles y permisos

Usuarios locales con PIN (PBKDF2-SHA256, 150 000 iteraciones, sal por usuario; conversión automática desde el formato antiguo). Roles: Administrador (`*`), Encargado, Veterinario, Operario, Consulta. Bloqueo progresivo tras 5 intentos. El administrador debe cambiar el PIN inicial. Sesión recordada 14 días (configurable).

## 7. Mapas, fotografías, informes y consultas

Mapa SVG propio construido desde el plano PDF (sin mapas en línea); fotos por cámara/archivo con redimensionamiento; reportes con Chart.js y SheetJS; asistente local por reglas (responde costos, potreros, tareas, peso, inventario, lluvia, sanidad, animal o lote; para otras preguntas responde «No entendí» con la lista de temas — comportamiento original, verificado).

## 8. Riesgos de pérdida de información detectados en la versión HTML

| Riesgo | Detalle | Mitigación en la app de escritorio |
|---|---|---|
| Borrado de datos del navegador | «Borrar datos de navegación» o el modo privado eliminan IndexedDB | Base en carpeta propia de la app + respaldos ZIP automáticos en disco |
| Puntos de restauración en la misma base | Si la base se pierde, también se pierden los puntos | Punto de recuperación **en disco** antes de restaurar, importar todo o borrar todo |
| Respaldo manual dependiente del usuario | Solo descarga si el usuario lo recuerda | Respaldo automático (intervalo configurable), al salir y tras cierre inesperado; rotación; carpeta espejo |
| Origen dependiente de la ruta | Mover el HTML o abrirlo en otro navegador muestra una base vacía | Origen fijo `siaf://app` |
| Pestañas múltiples | Dos pestañas con versiones distintas bloquean la base | Una sola instancia de la app |
| Pila de «deshacer» en memoria | Se pierde al recargar | Sin cambios (comportamiento original) |
| Sesión de 14 días | Quien use el equipo entra sin PIN | Sin cambios; se documenta reducir `diasSesion` en Configuración |

## 9. Funcionalidades que dependen del navegador, de Internet o de permisos

| Funcionalidad | Estado en la app de escritorio |
|---|---|
| IndexedDB, Web Crypto, CompressionStream | ✅ Disponibles (contexto seguro verificado por prueba) |
| Descargas (`<a download>`) | ✅ Diálogo nativo «Guardar» (verificado: JSON, Excel, plantilla) |
| `<input type=file>` (fotos, importación, restauración) | ✅ Diálogo nativo (verificado) |
| Impresión / PDF (`window.print`) | ⚠️ Usa el diálogo de impresión del sistema; **no probado automáticamente** |
| Carpeta de respaldos (`showDirectoryPicker`) | ⚠️ Chromium la soporta; **no probado**. Sustituida por los respaldos nativos de la app |
| Service Worker / instalación PWA | ➖ No aplica (la app ya está instalada); se desactiva sin errores |
| Dictado por voz (Speech Recognition) | ❌ No disponible en Electron (SIAF avisa y se puede escribir). Alternativa: dictado de macOS (pulsar 🌐/Fn dos veces) |
| Respaldo en Google Drive | ❌ No disponible: Google solo autoriza orígenes `https://`. Alternativa: carpeta espejo en Google Drive para escritorio o iCloud Drive |
| Sincronización Supabase | ⚠️ Permitida por la CSP (`connect-src https:`); **no probada** (requiere proyecto del usuario) |
| Respaldo cifrado AES-GCM | ⚠️ `crypto.subtle` disponible (verificado); el flujo cifrado completo no se probó automáticamente |

## 10. Errores encontrados durante la auditoría

No se encontraron errores de JavaScript en ninguna sección. Se observaron dos comportamientos que afectan a la automatización y se resolvieron en la capa de escritorio (sin tocar SIAF):

1. SIAF cambia de sección con `history.replaceState` (no emite `hashchange`): el grabador detecta el cambio de sección antes de cada acción.
2. Tras registrar un animal, SIAF abre su «Ficha individual» y, una sola vez por equipo, el aviso «Novedades de SIAF 7»: las secuencias grabadas los incluyen como pasos normales.
