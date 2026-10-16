# Compilación, firma, notarización y distribución

## Compilar en un Mac (reproducible)

Requisitos: macOS 13+ con **Xcode 14+** (Swift 5.7+), **Node.js 22**, Python 3 (solo si regenera iconos).

```bash
cd siaf-escritorio
bash scripts/build-mac.sh                 # universal: Apple Silicon + Intel
SIAF_ARCH=arm64 bash scripts/build-mac.sh # solo Apple Silicon (o x64)
```

El script ejecuta en orden: `npm ci` (versiones exactas de `package-lock.json`) → `prepare-web` (verifica el SHA-256 del HTML original y añade el puente) → pruebas unitarias → auxiliar Swift universal → electron-builder → verificación (`codesign`, `lipo`, `spctl`, `stapler`) → `dist/SHA256SUMS.txt`.

Salidas en `dist/`:

| Archivo | Uso |
|---|---|
| `mac-universal/SIAF.app` | Aplicación |
| `SIAF-<versión>-universal.dmg` | Instalador por arrastre |
| `SIAF-<versión>-universal-mac.zip` | Distribución alternativa / actualizaciones |
| `SIAF-<versión>-universal.pkg` | Instalador para /Applications (MDM, varios equipos) |
| `SHA256SUMS.txt` | Huellas para verificar la descarga |

Desde Linux solo es posible un `.app`/`.zip` **sin firma** (`npm run dist:mac:sin-firma-desde-linux`), útil para inspeccionar el paquete; no sustituye la compilación en Mac.

### Integración continua

`.github/workflows/siaf-macos.yml` compila y prueba en **macOS 15 Apple Silicon** y **macOS 15 Intel**: auxiliar Swift, pruebas unitarias, pruebas E2E de Electron, empaquetado universal, **instalación limpia desde el DMG y desde el PKG** y prueba de la app instalada. Publica los instaladores y las evidencias como artefactos de la ejecución.

## Estado de la firma

**Los instaladores generados en este proyecto NO tienen firma Developer ID ni notarización**: no se dispone de una cuenta de Apple Developer ni de certificados. Sin credenciales, el script aplica una **firma ad-hoc** (`codesign -s -`), que:

* permite ejecutar la app en el Mac donde se compiló y en Apple Silicon (que exige al menos firma ad-hoc);
* **no** es aceptada por Gatekeeper en otros Mac (`spctl` la rechaza; el script lo informa). El usuario tendría que usar «Abrir de todos modos» (ver `INSTALACION.md`).

No se simula ninguna firma ni notarización.

## Completar la firma y la notarización

1. Inscribirse en el **Apple Developer Program** (99 USD/año) como persona u organización.
2. En developer.apple.com → Certificates, crear:
   * **Developer ID Application** (firma la app),
   * **Developer ID Installer** (firma el `.pkg`).
   Instálelos en el Llavero del Mac de compilación, o exporte el de aplicación como `.p12`.
3. Credenciales de notarización — una de dos:
   * **Clave API de App Store Connect** (recomendado): Users and Access → Integrations → Keys, rol *Developer*; descargue el `.p8`.
   * **ID de Apple + contraseña específica de app** (appleid.apple.com) + Team ID.
4. Compilar con las variables:

```bash
export CSC_LINK=/ruta/DeveloperID_Application.p12   # o CSC_NAME="Developer ID Application: Nombre (TEAMID)"
export CSC_KEY_PASSWORD='…'
export APPLE_API_KEY=/ruta/AuthKey_XXXX.p8 APPLE_API_KEY_ID=XXXX APPLE_API_ISSUER=xxxxxxxx-xxxx-…
#   o: export APPLE_ID=correo@… APPLE_APP_SPECIFIC_PASSWORD=xxxx-xxxx-xxxx-xxxx APPLE_TEAM_ID=TEAMID
bash scripts/build-mac.sh
```

electron-builder firma con **Hardened Runtime** y los entitlements de `build/entitlements.mac.plist` (JIT de V8 y Apple Events; nada más), firma también el auxiliar `siaf-automator`, envía a notarizar y grapa el ticket. Verificación manual:

```bash
codesign --verify --deep --strict --verbose=2 dist/mac-universal/SIAF.app
spctl --assess --type execute --verbose=4 dist/mac-universal/SIAF.app   # «accepted, source=Notarized Developer ID»
xcrun stapler validate dist/SIAF-*.dmg
pkgutil --check-signature dist/SIAF-*.pkg
```

En GitHub Actions: guarde `CSC_LINK` (p12 en base64), `CSC_KEY_PASSWORD` y las variables de notarización como *secrets* del repositorio y páselas como `env` al paso «Empaquetar». Nunca las escriba en archivos del repositorio.

## Versión y actualizaciones

* La versión de la app es `version` en `package.json` (hoy `9.3.3`, igual que SIAF). Para publicar una actualización: suba la versión, añada la entrada en `CHANGELOG.md`, compile y distribuya el nuevo DMG/PKG.
* Si actualiza SIAF (nuevo HTML): reemplace `source/SIAF_v9_3_3.html` (o agregue el nuevo y cambie el nombre en `SHA256SUMS`), regenere la huella `cd source && sha256sum <archivo> > SHA256SUMS`, ejecute las pruebas y compile.
* **Nunca** cambie el esquema/host `siaf://app` ni el `appId` `co.siaf.finca`: son la identidad de la base de datos y de la carpeta de datos.
* La app no incluye actualización automática por Internet (no hay servidor ni telemetría). Si en el futuro se desea, electron-builder admite `electron-updater` con el `.zip` firmado y un servidor HTTPS propio; exige firma Developer ID.

## Arquitecturas y versiones de macOS

* Binario **universal** (arm64 + x86_64) para la app y el auxiliar.
* Mínimo declarado: **macOS 12.0** (`LSMinimumSystemVersion`, requisito de Electron 44).
* Probado automáticamente en: macOS 15 Apple Silicon y macOS 15 Intel (runners de GitHub, sin interfaz de usuario interactiva). macOS 12, 13, 14 y 26 **no se probaron**.
