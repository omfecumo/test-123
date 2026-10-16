# SIAF para macOS

Aplicación de escritorio para macOS del **Sistema Integral de Administración de Finca (SIAF) v9.3.3**: se instala con DMG o PKG, se abre desde Finder, el Dock o Launchpad con su propio icono, funciona sin Internet, guarda sus datos y respaldos en el Mac y añade el módulo opcional **SIAF Control y Automatización**.

© 2026 Omar Fernando Cuadro Mogollón. Todos los derechos reservados.

## Estado

| Criterio de aceptación | Estado | Evidencia |
|---|---|---|
| Se instala y ejecuta como app de escritorio | ✅ macOS 15 Apple Silicon e Intel: instalación desde DMG y desde PKG y prueba de la app instalada (CI) | `docs/PRUEBAS.md`, `evidencias/ci-macos-*.txt` |
| Funciones originales operativas | ✅ 26 de 26 secciones, flujos de datos, importación, exportación, roles | `evidencias/modulos.json`, pruebas E2E |
| Datos fuera de la sesión del navegador | ✅ `~/Library/Application Support/SIAF`, persisten tras reinicios y actualizaciones | P02–P06, P16 |
| Importación, exportación y restauración probadas | ✅ | P07, P08, P08b, P10 |
| Instalador generado y estado de firma documentado | ✅ DMG/ZIP/PKG universales · **firma ad-hoc, sin Developer ID ni notarización** | `docs/DISTRIBUCION.md` |
| Automatización en apps de prueba autorizadas | ✅ dentro de SIAF y en TextEdit (grabación y reproducción) en macOS 15 Apple Silicon e Intel · ⏳ flujo de concesión de permisos por un usuario: verificación manual | P12–P15, P13-mac, `docs/AUTOMATIZACION.md` |
| Limitaciones y permisos documentados | ✅ | `docs/AUDITORIA.md`, `docs/AUTOMATIZACION.md` |
| Reconstrucción reproducible | ✅ `scripts/build-mac.sh`, CI | `.github/workflows/siaf-escritorio.yml` |

## Descargar los instaladores ya compilados

Ejecución de CI [#7](https://github.com/omfecumo/test-123/actions/runs/38607980535) → sección **Artifacts** → `SIAF-macOS-instaladores` (DMG, ZIP y PKG universales con `SHA256SUMS.txt`; disponible hasta el 12-01-2027; requiere iniciar sesión en GitHub). Son instaladores con **firma ad-hoc**: siga `docs/INSTALACION.md` («Si macOS dice que no puede verificar la app»).

## Documentación

| Documento | Contenido |
|---|---|
| [docs/AUDITORIA.md](docs/AUDITORIA.md) | Fase 1: arquitectura, módulos, dependencias, almacenamiento, riesgos, funciones dependientes del navegador |
| [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md) | Fase 2: comparación SwiftUI/WKWebView, Electron, Tauri; decisión; persistencia; seguridad |
| [docs/INSTALACION.md](docs/INSTALACION.md) | Instalar, actualizar, desinstalar, dónde están los datos |
| [docs/MIGRACION.md](docs/MIGRACION.md) | Migración verificable desde la versión HTML |
| [docs/AUTOMATIZACION.md](docs/AUTOMATIZACION.md) | Manual del módulo de grabación y automatización, permisos, limitaciones |
| [docs/DISTRIBUCION.md](docs/DISTRIBUCION.md) | Compilación, firma, notarización, versiones y arquitecturas |
| [docs/PRUEBAS.md](docs/PRUEBAS.md) | Matriz de pruebas con resultados reales |
| [docs/FASES.md](docs/FASES.md) | Registro por fases: cambios, pruebas y pendientes |
| [docs/SOLUCION_PROBLEMAS.md](docs/SOLUCION_PROBLEMAS.md) | Problemas frecuentes y registro técnico |
| [CHANGELOG.md](CHANGELOG.md) | Versiones |

## Estructura

```
siaf-escritorio/
├─ source/SIAF_v9_3_3.html     archivo original (sin modificar) + SHA256SUMS
├─ src/main/                   proceso principal: ventana, protocolo siaf://, menús, respaldos, migración, registro
│  └─ automation/              esquema, almacén, motor, controladores SIAF y macOS, cliente del auxiliar
├─ src/preload/                puentes mínimos (contextBridge)
├─ src/web/desktop-bridge.js   puente cargado en SIAF: respaldos automáticos, puntos de recuperación, menús, grabador/reproductor
├─ src/automation-ui/          ventana «SIAF Control y Automatización» y barra flotante
├─ src/help/                   ayuda integrada
├─ native/SIAFAutomator/       auxiliar Swift (Accesibilidad, CGEvent, CGEventTap)
├─ build/                      icono (.icns/.png), entitlements
├─ scripts/                    prepare-web, make-icons, build-automator, build-mac
├─ tests/unit, tests/e2e       pruebas (node:test y Playwright sobre Electron)
├─ evidencias/                 capturas, resultados e informes de las pruebas
└─ docs/
```

## Desarrollo rápido

```bash
cd siaf-escritorio
npm ci
npm start            # abre la app (usa ~/Library/Application Support/SIAF; SIAF_USER_DATA=/otra/carpeta para aislar)
npm run test:unit
npm run test:e2e     # en Linux sin pantalla: xvfb-run -a npm run test:e2e
bash scripts/build-mac.sh   # en un Mac: .app, .dmg, .zip, .pkg en dist/
```

Dependencias exactas: Electron 44.5.1, electron-builder 26.16.1, @playwright/test 1.63.0 (ver `package.json` y `package-lock.json`). Ninguna se descarga en tiempo de ejecución.
