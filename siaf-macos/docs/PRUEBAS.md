# Matriz de pruebas

Leyenda: ✅ ejecutada y superada · ❌ ejecutada y fallida · ⏳ no ejecutada (motivo indicado) · ➖ no aplica.
«Linux» = contenedor Linux x64 con Xvfb (Electron 44.5.1, misma app). «macOS» = runners de GitHub Actions macOS 15 (Apple Silicon `macos-15`, Intel `macos-15-intel`), ejecución [#1](https://github.com/omfecumo/test-123/actions/runs/38602512138). Ninguna prueba se marca superada sin haberse ejecutado.

Suites: unitarias `tests/unit/*.test.js` (node:test) · extremo a extremo `tests/e2e/*.spec.js` (Playwright sobre la app Electron real). Salidas completas: `evidencias/linux/`, `evidencias/ci/` (macOS) y artefactos de la ejecución de CI.

| # | Prueba (requisito) | Resultado esperado | Linux | macOS | Evidencia |
|---|---|---|---|---|---|
| 1 | Instalación limpia | Instalar desde DMG (arrastrar a /Applications) y desde PKG, abrir y usar | ➖ | MACOS_1 | CI: pasos «Instalación limpia desde el DMG…» y «…desde el PKG» + `07-app-empaquetada` sobre /Applications/SIAF.app |
| 2 | Inicio desde Finder y Dock | La app abre con su icono y ventana propia | ⏳ | ⏳ manual | Requiere interacción en un Mac (el CI lanza el ejecutable del paquete, equivalente técnico). Comprobar: doble clic en Aplicaciones y clic en el Dock |
| 3 | Apertura y cierre repetidos | 5 aperturas/cierres consecutivos sin pérdida | ✅ | MACOS_E2E | P02–P06 |
| 4 | Persistencia tras reiniciar | Datos, fotos y sesión presentes al reabrir | ✅ (reinicio de la app) | MACOS_E2E | P02–P06. Reinicio del **equipo**: ⏳ manual (los datos están en disco en `~/Library/Application Support/SIAF`, mismo mecanismo) |
| 5 | Sin conexión | Cero peticiones de red externas durante todo el uso | ✅ | MACOS_E2E | Todas las E2E bloquean y registran peticiones http/https/ws: 0 |
| 6 | Crear, editar, consultar | Animal con foto, tarea creada y editada, búsqueda global, bitácora | ✅ | MACOS_E2E | P02–P06, capturas 03, 03a |
| 7 | Importación y exportación | Plantilla Excel, export JSON con SHA-256, Excel, import CSV con vista previa y descarte de fila inválida | ✅ | MACOS_E2E | P07, captura 04 |
| 8 | Restauración y recuperación | Respaldo manual verificado, restauración con vista previa, punto de recuperación previo con el estado exacto; recuperación tras `kill -9` | ✅ | MACOS_E2E | P08, P08b, unitarias de respaldos (9), capturas 05, 10 |
| 9 | Fotos y adjuntos | Foto guardada, vinculada, incluida en respaldo y migración | ✅ | MACOS_E2E | P02, P10 |
| 10 | Migración desde HTML original | Mismos ids, relaciones, fotos y fechas; informe «verificada» | ✅ | MACOS_E2E | P10, `evidencias/migracion-*.{txt,json}`, capturas 07–09 |
| 11 | Usuarios, roles y permisos | Operario y Consulta limitados; bloqueo tras 5 intentos; cambio obligatorio de PIN | ✅ | MACOS_E2E | P11, captura 06 |
| 12 | Grabación y reproducción | Grabar en SIAF, guardar, reproducir (crea el mismo registro); paso a paso, validación, condición, punto de recuperación; exportar/importar; PIN nunca grabado | ✅ | MACOS_E2E | P12, P12b, P12c, P12d, capturas 11–15 |
| 13 | Automatización de app de prueba autorizada | TextEdit: abrir, ⌘N, escribir, validar | ➖ (solo macOS) | ⏳ | P13-mac se omite: requiere conceder Accesibilidad a SIAF manualmente (los runners no pueden). Auxiliar: compila (universal) y su protocolo pasa en macOS (`auxiliar-macos.test.js`) |
| 14 | Denegación de permisos y recuperación | Sin Accesibilidad: mensaje claro, el resto funciona; tras concederla, funciona | ⏳ | ⏳ manual / parcial | En CI los permisos están denegados: el auxiliar reporta `accesibilidad:false` y rechaza enviar teclas a una app que no está al frente (unitaria). Concesión posterior: manual en un Mac |
| 15 | Interrupción y operaciones destructivas | Detener en < 5 s; destructivo sin confirmar no se ejecuta; interfaz cambiada → error claro sin reintentar clic | ✅ | MACOS_E2E | P15, P15b, P15c + 12 unitarias del motor |
| 16 | Actualización sin pérdida | 9.3.3 → 9.3.4 con conteos idénticos y respaldos intactos | ✅ | MACOS_E2E | P16, captura 16 |
| 17 | Desinstalación sin borrar respaldos | Borrar el paquete deja base y respaldos | ✅ | MACOS_E2E | P16 (parte P17) |
| 18 | Versiones y arquitecturas | Universal arm64 + x86_64; mínimo macOS 12 | ➖ | MACOS_ARCH | `lipo -info` en el registro de empaquetado; probado en macOS 15 arm64 e Intel. macOS 12/13/14/26: ⏳ no probados |

## Pruebas adicionales

| Prueba | Linux | macOS |
|---|---|---|
| 26 secciones originales se dibujan sin errores + asistente local responde | ✅ | MACOS_E2E |
| Seguridad del contenedor: contextIsolation, sandbox, sin Node, CSP, origen fijo | ✅ | MACOS_E2E |
| Protocolo `siaf://`: sin recorrido de directorios ni enlaces simbólicos | ✅ (unitaria) | ✅ (unitaria) |
| Esquema de secuencias: campos desconocidos eliminados, sin comandos, AppleScript con huella y sin aprobación heredada | ✅ | ✅ |
| App empaquetada (asar + fuses + auxiliar incluido) | ✅ (paquete Linux) | MACOS_1 |
| Impresión / Guardar como PDF | ⏳ diálogo del sistema | ⏳ manual |
| Respaldo cifrado AES-GCM completo | ⏳ | ⏳ (crypto.subtle disponible: verificado) |
| Sincronización Supabase | ⏳ requiere proyecto del usuario | ⏳ |

## Errores encontrados y corregidos por las pruebas

1. **Fuga de PIN en grabaciones** (P12b): el selector de un campo usaba su valor como «texto». Corregido; la prueba lo impide en adelante.
2. **Navegación no grabada** (P12): SIAF usa `history.replaceState`. Corregido.
3. Pruebas: carreras de tiempo propias de la prueba (foto aún no guardada; aviso de novedades) corregidas esperando la señal que emite SIAF.

## Errores conocidos y funciones pendientes

* Firma Developer ID y notarización: pendientes de credenciales (`DISTRIBUCION.md`).
* Automatización real de otras apps y flujo de permisos: pendiente de ejecución manual en un Mac (P13-mac está escrita y se ejecuta automáticamente cuando se concede Accesibilidad).
* Dictado por voz y respaldo en Google Drive: no disponibles en la app (alternativas documentadas).
* Reconocimiento visual por imagen: no implementado.
