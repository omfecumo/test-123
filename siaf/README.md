# SIAF — Sistema Integral de Administración de Finca · versión 6

© 2026 Omar Fernando Cuadro Mogollón. Todos los derechos reservados.

| Archivo | Descripción |
|---|---|
| [`SIAFver6.html`](SIAFver6.html) | **Entregable 4.** Nueva versión, un solo archivo, funciona sin Internet. Ábralo en el navegador. |
| [`SIAFver5.html`](SIAFver5.html) | Versión original, **sin modificar** (referencia y reversión). |
| [`docs/01_Informe_auditoria.md`](docs/01_Informe_auditoria.md) | Entregable 1 — Auditoría técnica y matriz de auditoría |
| [`docs/02_Benchmarking.md`](docs/02_Benchmarking.md) | Entregable 2 — Benchmarking, fuentes y matriz de selección |
| [`docs/03_Matriz_funcionalidades.md`](docs/03_Matriz_funcionalidades.md) | Entregable 3 — Matriz de funcionalidades |
| [`docs/05_Registro_cambios.md`](docs/05_Registro_cambios.md) | Entregable 5 — Registro de cambios, modelo de datos y reversión |
| [`docs/06_Informe_pruebas.md`](docs/06_Informe_pruebas.md) | Entregable 6 — Informe de pruebas |
| [`docs/07_Manual_usuario.md`](docs/07_Manual_usuario.md) | Entregable 7 — Manual de usuario |
| [`docs/08_Hoja_ruta.md`](docs/08_Hoja_ruta.md) | Entregable 8 — Hoja de ruta tecnológica |
| [`fuente/`](fuente/) | `construir_v6.py` (32 parches verificados sobre v5), `siaf6.js` y `siaf6.css` (código nuevo) |
| [`pruebas/`](pruebas/) | Batería Playwright (`ejecutar_todo.sh`), resultados JSON y capturas |

## Reconstruir y probar

```bash
cd siaf
python3 fuente/construir_v6.py          # regenera SIAFver6.html desde SIAFver5.html
cd pruebas && ./ejecutar_todo.sh        # requiere Node 18+ y Playwright con Chromium
```
