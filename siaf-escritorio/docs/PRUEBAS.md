# Matriz de pruebas

Leyenda: ✅ ejecutada y superada · ❌ ejecutada y fallida · ⏳ no ejecutada (motivo indicado) · ➖ no aplica.
«Linux» = contenedor Linux x64 con Xvfb (Electron 44.5.1, misma app). «macOS» = runners de GitHub Actions macOS 15 (Apple Silicon `macos-15`, Intel `macos-15-intel`), ejecución [#7](https://github.com/omfecumo/test-123/actions/runs/38607980535) (macOS 15.7.9, Xcode 16.4, Swift 6.1.2), resumen en `evidencias/ci-macos-apple-silicon.txt` y `evidencias/ci-macos-intel.txt`. Ninguna prueba se marca superada sin haberse ejecutado.

Suites: unitarias `tests/unit/*.test.js` (node:test) · extremo a extremo `tests/e2e/*.spec.js` (Playwright sobre la app Electron real). Salidas completas: `evidencias/linux/`, `evidencias/ci/` (macOS) y artefactos de la ejecución de CI.

| # | Prueba (requisito) | Resultado esperado | Linux | macOS | Evidencia |
|---|---|---|---|---|---|
| 1 | Instalación limpia | Instalar desde DMG (arrastrar a /Applications) y desde PKG, abrir y usar | ➖ | ✅ Apple Silicon e Intel (DMG y PKG: «The install was successful», app instalada probada) | CI: pasos «Instalación limpia desde el DMG…» y «…desde el PKG» + `07-app-empaquetada` sobre /Applications/SIAF.app |
| 2 | Inicio desde Finder y Dock | La app abre con su icono y ventana propia | ⏳ | ⏳ manual | Requiere interacción en un Mac (el CI lanza el ejecutable del paquete, equivalente técnico). Comprobar: doble clic en Aplicaciones y clic en el Dock |
| 3 | Apertura y cierre repetidos | 5 aperturas/cierres consecutivos sin pérdida | ✅ | ✅ AS · ✅ Intel | P02–P06 |
| 4 | Persistencia tras reiniciar | Datos, fotos y sesión presentes al reabrir | ✅ (reinicio de la app) | ✅ AS · ✅ Intel | P02–P06. Reinicio del **equipo**: ⏳ manual (los datos están en disco en `~/Library/Application Support/SIAF`, mismo mecanismo) |
| 5 | Sin conexión | Cero peticiones de red externas durante todo el uso | ✅ | ✅ AS · ✅ Intel | Todas las E2E bloquean y registran peticiones http/https/ws: 0 |
| 6 | Crear, editar, consultar | Animal con foto, tarea creada y editada, búsqueda global, bitácora | ✅ | ✅ AS · ✅ Intel | P02–P06, capturas 03, 03a |
| 7 | Importación y exportación | Plantilla Excel, export JSON con SHA-256, Excel, import CSV con vista previa y descarte de fila inválida | ✅ | ✅ AS · ✅ Intel | P07, captura 04 |
| 8 | Restauración y recuperación | Respaldo manual verificado, restauración con vista previa, punto de recuperación previo con el estado exacto; recuperación tras `kill -9` | ✅ | ✅ AS · ✅ Intel | P08, P08b, unitarias de respaldos (9), capturas 05, 10 |
| 9 | Fotos y adjuntos | Foto guardada, vinculada, incluida en respaldo y migración | ✅ | ✅ AS · ✅ Intel | P02, P10 |
| 10 | Migración desde HTML original | Mismos ids, relaciones, fotos y fechas; informe «verificada» | ✅ | ✅ AS · ✅ Intel | P10, `evidencias/migracion-*.{txt,json}`, capturas 07–09 |
| 11 | Usuarios, roles y permisos | Operario y Consulta limitados; bloqueo tras 5 intentos; cambio obligatorio de PIN | ✅ | ✅ AS · ✅ Intel | P11, captura 06 |
| 12 | Grabación y reproducción | Grabar en SIAF, guardar, reproducir (crea el mismo registro); paso a paso, validación, condición, punto de recuperación; exportar/importar; PIN nunca grabado | ✅ | ✅ AS · ✅ Intel | P12, P12b, P12c, P12d, capturas 11–15 |
| 13 | Automatización de app de prueba autorizada | TextEdit: abrir, ⌘N, escribir, validar el texto | ➖ (solo macOS) | ✅ AS · ✅ Intel | P13-mac (secuencia ejecutada por la app Electron con el auxiliar); diagnóstico directo del auxiliar: abrir, ⌘N, teclear, asignar valor AX, menú «Format › Make Plain Text» y **grabación** CGEventTap (clic → «pulsar AXTextArea», ⌘A, Return) — `evidencias/ci-macos-*.txt`. Los runners de GitHub tienen Accesibilidad e Input Monitoring preconcedidos |
| 14 | Denegación de permisos y recuperación | Sin Accesibilidad: mensaje claro, el resto funciona; tras concederla, funciona | ⏳ | ⏳ manual | No reproducible en CI (los runners traen los permisos concedidos y no se pueden revocar sin interacción). Implementado: comprobación previa con mensaje y enlace a Ajustes; el auxiliar se niega a enviar teclas si la app no está al frente (unitaria ✅). Probar en un Mac: revocar Accesibilidad → ejecutar → mensaje; conceder → ejecutar → OK |
| 15 | Interrupción y operaciones destructivas | Detener en < 5 s; destructivo sin confirmar no se ejecuta; interfaz cambiada → error claro sin reintentar clic | ✅ | ✅ AS · ✅ Intel | P15, P15b, P15c + 12 unitarias del motor |
| 16 | Actualización sin pérdida | 9.3.3 → 9.3.4 con conteos idénticos y respaldos intactos | ✅ | ✅ AS · ✅ Intel | P16, captura 16 |
| 17 | Desinstalación sin borrar respaldos | Borrar el paquete deja base y respaldos | ✅ | ✅ AS · ✅ Intel | P16 (parte P17) |
| 18 | Versiones y arquitecturas | Universal arm64 + x86_64; mínimo macOS 12 | ➖ | ✅ app y auxiliar `x86_64 arm64`; ejecutada en macOS 15 arm64 e Intel | `lipo -info` en el registro de empaquetado; probado en macOS 15 arm64 e Intel. macOS 12/13/14/26: ⏳ no probados |

## Pruebas adicionales

| Prueba | Linux | macOS |
|---|---|---|
| 26 secciones originales se dibujan sin errores + asistente local responde | ✅ | ✅ AS · ✅ Intel |
| Seguridad del contenedor: contextIsolation, sandbox, sin Node, CSP, origen fijo | ✅ | ✅ AS · ✅ Intel |
| Protocolo `siaf://`: sin recorrido de directorios ni enlaces simbólicos | ✅ (unitaria) | ✅ (unitaria) |
| Esquema de secuencias: campos desconocidos eliminados, sin comandos, AppleScript con huella y sin aprobación heredada | ✅ | ✅ |
| App empaquetada (asar + fuses + auxiliar incluido) | ✅ (paquete Linux) | ✅ AS · ✅ Intel (instalada desde DMG y PKG) |
| Impresión / Guardar como PDF | ⏳ diálogo del sistema | ⏳ manual |
| Respaldo cifrado AES-GCM completo | ⏳ | ⏳ (crypto.subtle disponible: verificado) |
| Sincronización Supabase | ⏳ requiere proyecto del usuario | ⏳ |

## Errores encontrados y corregidos por las pruebas

1. **Fuga de PIN en grabaciones** (P12b): el selector de un campo usaba su valor como «texto». Corregido; la prueba lo impide en adelante.
2. **Navegación no grabada** (P12): SIAF usa `history.replaceState`. Corregido.
3. **Escritura de texto en otras apps** (macOS real, CI): las pulsaciones Unicode por el flujo HID global no llegaban a TextEdit. Ahora se inserta con Accesibilidad (`AXSelectedText`) y, como respaldo, con eventos dirigidos al proceso. Verificado en Apple Silicon e Intel.
4. **CI**: sin `pipefail`, `tee` ocultaba un fallo de las pruebas; corregido (`shell: bash`).
5. Pruebas: carreras de tiempo propias de la prueba (foto aún no guardada; aviso de novedades; enfoque automático del formulario de PIN en el runner Intel) corregidas esperando la señal que emite SIAF.

## Errores conocidos y funciones pendientes

* Firma Developer ID y notarización: pendientes de credenciales (`DISTRIBUCION.md`).
* Flujo de denegación/concesión de permisos y arranque desde Finder/Dock: pendientes de verificación manual en un Mac con usuario (no reproducibles en CI).
* Solo se probó macOS 15; macOS 12, 13, 14 y 26 no.
* Dictado por voz y respaldo en Google Drive: no disponibles en la app (alternativas documentadas).
* Reconocimiento visual por imagen: no implementado.

## Windows

Ejecución [Windows #6](https://github.com/omfecumo/test-123/actions/runs/38837424817): **Windows Server 2025 Datacenter x64** (10.0.26100) y **Windows 11 Enterprise ARM64** (10.0.26200). Resúmenes en `evidencias/ci-windows-x64.txt` y `evidencias/ci-windows-arm64.txt`.

| # | Prueba | x64 | ARM64 | Evidencia / nota |
|---|---|---|---|---|
| 1 | Instalación limpia | ✅ | ✅ | NSIS silencioso por usuario (`%LOCALAPPDATA%\Programs\SIAF`) con acceso directo en el menú Inicio, y MSI por equipo (`msiexec` código 0); la app instalada se probó en ambos casos |
| 2 | Inicio desde menú Inicio / Escritorio / barra de tareas | ⏳ manual | ⏳ manual | Accesos directos creados (verificado el del menú Inicio); abrirlos con clic requiere interacción |
| 3–11 | Apertura/cierre repetidos, persistencia, sin red, CRUD, importación/exportación, restauración, fotos, migración desde el HTML original en Chromium, roles | ✅ | ✅ | Las mismas pruebas E2E que en macOS: 17/17 |
| 8b | Recuperación tras cierre forzado | ✅ | ✅ | `taskkill /T /F` de todo el árbol de procesos |
| 12 | Grabación y reproducción dentro de SIAF | ✅ | ✅ | P12, P12b (PIN nunca grabado), P12c, P12d |
| 13 | Automatización de app de prueba autorizada (Bloc de notas) | ✅ | ✅ | P13-win (abrir, teclear, validar el texto del control con foco). Diagnóstico directo del auxiliar: teclear, asignar valor (UI Automation), grabación por hooks (clic → «pulsar Document», Ctrl+A, Return) y rechazo a enviar teclas a una app que no está al frente |
| 14 | Permisos | ➖ | ➖ | Windows no exige permisos de privacidad para UI Automation; la limitación UIPI (apps «como administrador») está documentada, no probada |
| 15 | Interrupción y operaciones destructivas | ✅ | ✅ | P15, P15b, P15c |
| 16 | Actualización sin pérdida | ✅ | ✅ | P16 |
| 17 | Desinstalación sin borrar respaldos | ✅ | ✅ | Desinstalación silenciosa NSIS: respaldos antes = después (x64: 1 → 1; ARM64: 2 → 2) |
| 18 | Arquitecturas | ✅ x64 | ✅ ARM64 | Instaladores separados por arquitectura; auxiliar AnyCPU |

Errores encontrados y corregidos en Windows:

1. **Git en Windows alteraba el HTML original** (finales de línea CRLF) y la verificación SHA-256 lo rechazaba: añadido `.gitattributes`.
2. **La técnica de pulsar Alt para traer una ventana al frente abría el menú del Bloc de notas** y se perdía la primera letra: ahora solo se usa como último recurso, si la app no está al frente.
3. **En el Bloc de notas de Windows 11, las pulsaciones enviadas en un mismo lote se repetían**: ahora se envían por separado.
4. Pruebas: cierre forzado de todo el árbol de procesos; confirmación de valores al rellenar formularios; ventanas del sistema del runner que roban el foco («Microsoft account», búsqueda del menú Inicio).

Limitación observada (no resuelta): en Windows 11 ARM64, el **primer** texto tecleado justo después de abrir el Bloc de notas nuevo salió alterado en el diagnóstico directo («Prueba rrrr…»); los textos siguientes y la prueba P13-win fueron correctos. Recomendación: añadir una pausa tras «Abrir aplicación» o usar el modo «valor» (UI Automation), que fue correcto siempre.
