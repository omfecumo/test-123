# Registro por fases

Entorno de desarrollo: contenedor Linux x64 (sin macOS). Lo que exige un Mac se compiló y probó en **runners macOS de GitHub Actions** (macOS 15, Apple Silicon e Intel). Lo que exige interacción humana en un Mac (conceder permisos de privacidad, Gatekeeper con firma real) queda identificado como pendiente.

| Fase | Cambios | Pruebas | Pendientes |
|---|---|---|---|
| 1. Auditoría | Lectura de los 33 bloques de script; ejecución del original en Chromium y en la app; inventario de módulos, dependencias, almacenamiento, riesgos (`AUDITORIA.md`) | Recorrido automático de las 26 secciones (0 errores) | — |
| 2. Arquitectura | Comparación A/B/C; elección de Electron + auxiliar Swift; IndexedDB en perfil propio + respaldos nativos (`ARQUITECTURA.md`) | — | — |
| 3. Prototipo | Proceso principal, protocolo `siaf://` con CSP, ventana aislada, `prepare-web` con verificación SHA-256 | P01: contexto seguro, sin Node.js, CSP, menús | — |
| 4. Integración | Menús nativos, atajos, icono, descargas y archivos nativos, impresión, tema, ayuda, instancia única, cierre ordenado | P02–P07, P11, módulos | Impresión no automatizada (diálogo del sistema) |
| 5. Persistencia, respaldo y migración | `backups.js`, `zip.js`, `migracion.js`, puente: respaldos automáticos/al salir/tras cierre inesperado, puntos de recuperación, verificación, carpeta espejo, migración verificada | 13 unitarias; P02–P06, P08, P08b, P10, P16 | Carpeta espejo en disco externo/iCloud solo probada con carpeta local |
| 6. Automatización | Esquema validado, almacén, motor (pausa/stop/paso a paso/reintentos seguros/confirmaciones/puntos), controlador SIAF, ventana de control, HUD, atajo global, auxiliar Swift | 16 unitarias; P12–P15c; protocolo del auxiliar en macOS | Flujo de concesión de permisos por un usuario (manual). TextEdit: ✅ en macOS 15 (CI) tras corregir la escritura de texto |
| 7. Pruebas funcionales y de seguridad | Corrección de **fuga de PIN en el grabador** y de navegación no grabada (encontradas por las pruebas); fuses de Electron; pipefail en CI | Matriz completa (`PRUEBAS.md`) | Ver matriz |
| 8. Compilación y empaquetado | electron-builder: `.app` universal, `.dmg`, `.zip`, `.pkg`; Hardened Runtime + entitlements; `build-mac.sh`; CI macOS con instalación desde DMG y PKG | Prueba de la app empaquetada (Linux) e instalada (macOS CI) | Firma Developer ID y notarización (sin credenciales) |
| 9. Documentación y entrega | README, docs, CHANGELOG, ayuda integrada, evidencias | — | — |
