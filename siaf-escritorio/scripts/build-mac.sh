#!/usr/bin/env bash
# Compilación reproducible de SIAF para macOS: .app, .dmg, .zip y .pkg.
#
#   bash scripts/build-mac.sh                 # universal (Apple Silicon + Intel)
#   SIAF_ARCH=arm64 bash scripts/build-mac.sh # solo Apple Silicon (también: x64)
#
# Firma y notarización (opcionales; sin ellas se produce una firma AD-HOC que Gatekeeper NO acepta en otros Mac):
#   Firma Developer ID:  CSC_LINK=<.p12 o base64>  CSC_KEY_PASSWORD=<clave>   (o CSC_NAME="Developer ID Application: …")
#   Instalador .pkg:     certificado «Developer ID Installer» en el llavero (electron-builder lo detecta)
#   Notarización (una de las dos):
#     APPLE_API_KEY=<ruta .p8> APPLE_API_KEY_ID=<id> APPLE_API_ISSUER=<uuid>
#     APPLE_ID=<correo> APPLE_APP_SPECIFIC_PASSWORD=<clave de app> APPLE_TEAM_ID=<equipo>
set -euo pipefail
cd "$(dirname "$0")/.."
[[ "$(uname -s)" == "Darwin" ]] || { echo "✖ Este script debe ejecutarse en macOS." >&2; exit 1; }
ARCH="${SIAF_ARCH:-universal}"
case "$ARCH" in universal|arm64|x64) ;; *) echo "✖ SIAF_ARCH debe ser universal, arm64 o x64" >&2; exit 1;; esac

echo "▶ 1/6 Dependencias (npm ci, versiones exactas de package-lock.json)"
npm ci --no-audit --no-fund
echo "▶ 2/6 Preparar SIAF (verificación SHA-256 del original + puente de escritorio)"
node scripts/prepare-web.mjs
echo "▶ 3/6 Pruebas unitarias"
npm run test:unit
echo "▶ 4/6 Auxiliar nativo de automatización (Swift, universal)"
bash scripts/build-automator.sh

FIRMA=no; [[ -n "${CSC_LINK:-}" || -n "${CSC_NAME:-}" ]] && FIRMA=si
NOTARIZAR=false; [[ "$FIRMA" == si && ( -n "${APPLE_API_KEY:-}" || -n "${APPLE_ID:-}" ) ]] && NOTARIZAR=true
rm -rf dist
echo "▶ 5/6 Empaquetado ($ARCH) · firma Developer ID: $FIRMA · notarización: $NOTARIZAR"
if [[ "$FIRMA" == si ]]; then
  npx electron-builder --mac dmg zip pkg "--$ARCH" -c.mac.notarize=$NOTARIZAR --publish never
  APP="$(find dist -maxdepth 2 -name SIAF.app -type d | head -1)"
else
  echo "⚠  Sin certificado Developer ID: firma AD-HOC. Sirve para probar en ESTE Mac; en otros Mac Gatekeeper la bloqueará."
  npx electron-builder --mac dir "--$ARCH" -c.mac.identity=null --publish never
  APP="$(find dist -maxdepth 2 -name SIAF.app -type d | head -1)"
  codesign --force --deep --sign - "$APP"
  npx electron-builder --mac dmg zip pkg "--$ARCH" -c.mac.identity=null --prepackaged "$APP" --publish never
fi

echo "▶ 6/6 Verificación"
codesign --verify --deep --strict --verbose=2 "$APP"
codesign -dv --verbose=2 "$APP" 2>&1 | grep -E "Identifier|Authority|Signature|TeamIdentifier|Runtime" || true
lipo -info "$APP/Contents/MacOS/SIAF"
lipo -info "$APP/Contents/Resources/bin/siaf-automator"
if spctl --assess --type execute --verbose=4 "$APP" 2>&1; then echo "✔ Gatekeeper acepta la app"; else echo "⚠ Gatekeeper rechaza la app (esperado sin firma Developer ID + notarización)"; fi
if [[ "$NOTARIZAR" == true ]]; then for f in dist/*.dmg; do xcrun stapler validate "$f"; done; fi
(cd dist && shasum -a 256 *.dmg *.zip *.pkg > SHA256SUMS.txt && cat SHA256SUMS.txt)
echo "✔ Artefactos en dist/"
