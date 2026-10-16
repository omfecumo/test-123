#!/usr/bin/env bash
# Compila el auxiliar nativo «siaf-automator» (Swift) como binario universal (arm64 + x86_64) y lo deja en
# build/bin/, desde donde electron-builder lo copia a SIAF.app/Contents/Resources/bin/.
# Requisitos: macOS con Xcode 14 o posterior (o Command Line Tools con Swift 5.7+).
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "✖ El auxiliar nativo solo se compila en macOS (usa AppKit y ApplicationServices)." >&2
  exit 1
fi
cd native/SIAFAutomator
swift build -c release --arch arm64 --arch x86_64
BIN="$(swift build -c release --arch arm64 --arch x86_64 --show-bin-path)/siaf-automator"
cd ../..
mkdir -p build/bin
cp "$BIN" build/bin/siaf-automator
chmod 755 build/bin/siaf-automator
lipo -info build/bin/siaf-automator
build/bin/siaf-automator version
echo "✔ build/bin/siaf-automator listo"
