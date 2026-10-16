# Solución de problemas

| Síntoma | Causa probable | Qué hacer |
|---|---|---|
| «No se puede abrir SIAF porque Apple no puede comprobar…» | Instalador sin firma Developer ID / sin notarizar | Ajustes del Sistema → Privacidad y seguridad → **Abrir de todos modos** (macOS 15+), o Control+clic → Abrir (12–14). Ver `INSTALACION.md` |
| «SIAF está dañado y no puede abrirse» | Archivo descargado con cuarentena y firma ad-hoc | Use una versión firmada. Como último recurso, y solo si confía en el origen: `xattr -dr com.apple.quarantine /Applications/SIAF.app` |
| La app abre con la base vacía | Se abrió con otra carpeta de datos (`SIAF_USER_DATA`) o se borró `~/Library/Application Support/SIAF` | Restaure desde `Respaldos/` (Archivo → Restaurar desde un respaldo de la app…) o desde un ZIP/JSON (Configuración → Respaldo) |
| «Los datos de este dispositivo fueron creados con una versión MÁS NUEVA de SIAF» | Se instaló una versión anterior | Reinstale la versión más reciente |
| Indicador «⚠️ Respaldo con error» | Disco lleno, carpeta espejo desconectada o permiso | Pase el ratón sobre el indicador para ver el motivo; libere espacio; revise Preferencias de respaldo (⌘,); consulte el registro técnico |
| «No se pudo guardar el punto de recuperación en disco» al restaurar | Falta de espacio | Cancele, libere espacio y repita. Solo continúe sin copia si tiene otro respaldo reciente |
| Aviso «La sesión anterior no se cerró correctamente» | Apagón, cierre forzado o fallo | Los datos confirmados están intactos; la app ya guardó un punto de recuperación. Revise los últimos registros |
| Dictado por voz 🎤 no funciona | Electron no incluye el servicio de dictado del navegador | Use el dictado de macOS: pulse 🌐/Fn dos veces en cualquier campo |
| Respaldo en Google Drive no funciona | Google solo autoriza orígenes https; la app usa `siaf://app` | Configure una **carpeta espejo** dentro de Google Drive para escritorio o iCloud Drive (Preferencias de respaldo) |
| La automatización de otra app dice «falta el permiso de Accesibilidad» | SIAF no está activado en Accesibilidad | Ajustes → Privacidad y seguridad → Accesibilidad → active SIAF (si ya estaba, quítelo con «–», agréguelo de nuevo y reabra SIAF) |
| «macOS no permitió escuchar el teclado» | Falta Monitorización de entrada | Ajustes → Privacidad y seguridad → Monitorización de entrada → SIAF; reabra SIAF. O grabe sin teclado |
| «La interfaz cambió: no se encontró …» | La app/ventana cambió desde la grabación, otro diálogo abierto o tiempo de espera corto | Deje la app en el estado inicial grabado, aumente «Tiempo máximo por paso», edite el paso o regrabe |
| «El auxiliar nativo no está disponible» | App compilada sin `siaf-automator` (por ejemplo, desde Linux) | Compile en un Mac con `scripts/build-mac.sh` |
| Un AppleScript no se ejecuta | No está aprobado en este Mac o se modificó | Secuencias → paso AppleScript → «Revisar y aprobar» |
| Impresión/PDF no muestra el diálogo | — | Archivo → Imprimir (⌘P). Elija «Guardar como PDF» en el diálogo del sistema |

## Registro técnico

Herramientas → **Abrir registro técnico** (`~/Library/Application Support/SIAF/logs/siaf.log`, rota a 2 MB). Contiene arranques, cierres, respaldos, errores y eventos de automatización. No contiene datos de la finca; PIN, claves y tokens se ocultan. Adjúntelo al reportar un problema.

## Verificar respaldos

Archivo → **Verificar integridad de los respaldos**: relee cada ZIP y comprueba la huella SHA-256 del archivo y las de su manifiesto. En Terminal: `cd ~/Library/Application\ Support/SIAF/Respaldos && shasum -a 256 -c *.sha256`.
