#!/usr/bin/env bash
# Ejecuta toda la batería de pruebas desde perfiles limpios. Requiere Node 18+ y Playwright con Chromium.
#   cd siaf/pruebas && ./ejecutar_todo.sh
set -euo pipefail
export NODE_PATH="${NODE_PATH:-$(npm root -g)}"
cd "$(dirname "$0")"
rm -rf /tmp/siaf-perfil-base /tmp/siaf-perfil-v6 /tmp/siaf-xss-* 
echo "== 1. Línea base v5";            node linea_base_v5.js /tmp/siaf-perfil-base
echo "== 2. Regresión v5 → v6";         node regresion_v5_v6.js /tmp/siaf-perfil-base | grep -E '"(totalDiferencias|inesperadas|mismaBaseQueLineaBase)"' 
echo "== 3. Humo v6";                   node humo_v6.js /tmp/siaf-perfil-v6 | head -1 | cut -c1-400
echo "== 4. Respaldo y restauración";   node respaldo.js | tail -1
echo "== 5. Funcionales y seguridad";   node funcional.js | tail -1
echo "== 6. Rendimiento";               node rendimiento.js
