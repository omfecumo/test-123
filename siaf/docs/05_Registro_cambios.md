# Entregable 5 — Registro de cambios (SIAF v5 → v6)

## Cómo se construyó la versión 6

* `SIAFver5.html` se conserva **intacto** (SHA-256 `59ccfff9…c914`).
* `SIAFver6.html` se genera con `python3 fuente/construir_v6.py`, que:
  1. lee el original;
  2. aplica **32 parches** de texto exacto; cada uno debe coincidir **exactamente una vez** o la construcción se detiene;
  3. inserta el módulo nuevo `fuente/siaf6.js` (antes de `v_config.js`) y los estilos `fuente/siaf6.css`.
* No se reescribió ningún módulo original, no se renombraron campos, identificadores ni formatos, y no se agregaron dependencias externas. Los créditos y avisos de propiedad intelectual se mantienen.
* Los parches llevan el comentario `v6` en el código para identificarlos.

## 1. Correcciones (Prioridad 1)

| # | Cambio | Ubicación | Justificación |
|---|---|---|---|
| C1 | Título de los modales como **texto plano** (decodifica entidades, descarta etiquetas) | `U.modal` | XSS almacenado comprobado (H01) |
| C2 | `U.confirmar` depura el HTML: solo `<b> <strong> <i> <em> <u> <small> <br>` sin atributos | `U.confirmar`, `U.limpiarHTML` | Las confirmaciones mezclaban nombres de lotes sin escapar |
| C3 | Solo se muestran fotos `data:image/(jpeg|png|webp|gif);base64,…` | `U.srcSeguro`, `App.fotosHTML`, ficha animal, `U.verImagen` | Inyección por `src` desde un respaldo manipulado (H02) |
| C4 | `DB.importar(json, { conservarFotos })` | `db.js` | Restaurar un respaldo «sin fotos» borraba todas las fotos (H03) |
| C5 | Restauración con validación, vista previa, punto de restauración previo y registro en bitácora | `Respaldo.restaurarArchivo` (sustituye el manejador del botón «Restaurar respaldo»; el código v5 queda como referencia sin uso) | H02, H04 |
| C6 | Exportación en **formato 2**: `formato`, `versionApp`, `esquema`, `finca`, `sinFotos`, `conteos`, `integridad {alg: SHA-256, hash}` | `Respaldo.construirDesde` | H05. Compatible: v5 sigue leyendo estos archivos (prueba R11) |
| C7 | Costos directos de cultivos (`cultivos.costo`) integrados a `D.costosDetalle` con categoría y origen «Cultivos (costos directos)» | `domain.js` | H06. El módulo Agricultura ya los sumaba (`costoCultivo`); Costos, Resumen y Reportes los omitían. Efecto en la demostración: +3.814.500 COP en 3 registros. No hay doble conteo: las labores del cultivo son registros separados y el formulario indica que «las labores asociadas se suman automáticamente» |
| C8 | Ayuda en «Costo del evento» y «Costo por animal» para no repetir el valor del producto descontado del inventario; detección de posibles duplicados (no altera totales) | `Ganado.evento`, `Rapido.sanidadGrupal`, `Fin.duplicados` | H07. No se cambian los totales porque no es posible saber si el costo incluía el producto; se informa para que el usuario decida |
| C9 | Parámetro `diasSesion` (predeterminado 14, igual que v5) | `Auth.restaurarSesion`, Parámetros | H08: en equipos compartidos permite exigir el PIN a diario |
| C10 | Accesibilidad de modales: `aria-labelledby` y retorno del foco al cerrar | `U.modal` | Navegación con teclado y lectores de pantalla |

## 2. Funcionalidades nuevas

| # | Funcionalidad | Módulo | Notas |
|---|---|---|---|
| N1 | **Puntos de restauración** (base IndexedDB separada `siaf_recuperacion`, 3 más recientes) | `Recuperacion` | Automáticos antes de restaurar, migrar y «Borrar todo»; también manuales. Restaurables y descargables (formato 2) |
| N2 | **Esquema versionado** `config/esquema` con historial | `Migracion` | v5 → v6 sin cambios destructivos; crea punto previo; si los datos son de una versión más nueva, avisa y no migra |
| N3 | **Indicadores y análisis** (25 indicadores, filtros, comparación, trazabilidad, 6 gráficos, CSV, impresión) | `BI`, `An`, `Traza` | Cada indicador indica su naturaleza: Medido, Registrado, Calculado, Estimado o Proyección |
| N4 | **Flujo de caja y rentabilidad** | `Fin` | Flujo aproximado = ingresos − costos registrados − compras de inventario (valor unitario actual). El consumo de inventario y las estimaciones por catálogo se muestran como costos, no como salidas de caja |
| N5 | **Centro de alertas con estados** y **configuración de alertas** | `AlertasCfg` | Posponer (1/7/30 d), reactivar, fecha de detección (por dispositivo), filtros por prioridad, paginación de 200 |
| N6 | 3 alertas nuevas | `Alertas6` | Riesgo de agotamiento (≤ 15 días, sin repetir productos ya en «Stock bajo/Agotado»), animales sin pesaje (> 120 días, agrupadas por lote), gasto mensual atípico (> 1,5 × promedio de 6 meses, con al menos 3 meses de datos) |
| N7 | **Asistente de consultas** local | `Asistente` | Sin Internet, solo lectura, sin recomendaciones veterinarias; muestra periodo y registros usados |
| N8 | **Calidad de datos** (16 verificaciones + almacenamiento) | `Calidad` | Solo lectura; cada hallazgo lleva a sus registros |
| N9 | Pestaña **Genealogía** en la ficha individual | `Genea` | Usa `madreId`, `madre`, `padre` y eventos de parto existentes |
| N10 | 5 reportes nuevos | `Reportes.REPORTES` | Mantienen PDF, Excel y CSV del módulo original |
| N11 | Menú: Indicadores y análisis, Asistente de consultas, Flujo de caja, Calidad de datos; pestaña Configuración → Alertas | `App.RUTAS` | Las rutas existentes no cambian |

## 3. Rendimiento

| Cambio | Resultado |
|---|---|
| Paginación del Centro de alertas (200 por página) | Con 3.044 animales: 264 ms (v5) → 121 ms (v6) |
| Cálculos nuevos sobre índices en memoria existentes (`DB.de`) | Indicadores 257 ms, Flujo de caja 45 ms, Calidad 48 ms con 36.592 eventos |

## 4. Modelo de datos

| Elemento | Tipo de cambio | Compatibilidad con v5 |
|---|---|---|
| `config/esquema` `{v: 6, historial[]}` | Nuevo documento | v5 lo ignora |
| `config/alertasConfig` `{desactivadas[], p{}}` | Nuevo documento | v5 lo ignora |
| `config/alertasEstado` `{mapa{}}` | Nuevo documento | v5 lo ignora |
| `config/clasesCosto` `{mapa{}}` | Nuevo documento | v5 lo ignora |
| `config/parametros.diasSesion` | Campo opcional | v5 lo ignora |
| IndexedDB `siaf_recuperacion` | Base separada | No afecta a `siaf_finca` (versión 3 sin cambios) |
| Respaldo formato 2 | Campos de cabecera adicionales | v5 lo restaura (R11) |

**No se modificó ningún registro existente.** La base `siaf_finca` mantiene la versión 3 (no hay `onupgradeneeded`).

## 5. Estrategia de reversión

1. Abrir `SIAFver5.html` en el mismo navegador: lee los mismos datos (los documentos nuevos se ignoran).
2. Si se requiere el estado exacto anterior a la actualización: Configuración → Respaldo → Puntos de restauración → «Antes de actualizar los datos a SIAF v6» → Descargar, y restaurarlo en v5.
3. Un respaldo exportado por v6 puede restaurarse en v5 (prueba R11).

## 6. Dependencias

Sin dependencias nuevas. Se reutilizan Chart.js 4.5.1 (MIT) y SheetJS (Apache-2.0) ya incluidos. SHA-256: Web Crypto cuando está disponible, implementación propia verificada contra Node `crypto` en caso contrario (R02).
