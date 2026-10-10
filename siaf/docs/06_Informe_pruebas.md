# Entregable 6 — Informe de pruebas

**Versión probada:** `SIAFver6.html` SHA-256 `974645b85681e3e8e90fadb3f51b6271984b7fa158f13990387802c2667dfa07`
**Referencia:** `SIAFver5.html` SHA-256 `59ccfff9a12e2d03f9fc82ba49d999ebd4f17fe606d4095529840d196b19c914`
**Fecha de ejecución:** 10/10/2026 · **Entorno:** Linux, Chromium 1194 sin interfaz (Playwright 1.56.1), Node 22. Perfiles de navegador limpios en cada batería.
**Reproducción:** `cd siaf/pruebas && ./ejecutar_todo.sh` (requiere Node y Playwright). Los resultados en bruto están en `pruebas/resultados/*.json` y las capturas en `pruebas/resultados/capturas/`.

## Resumen

| Batería | Script | Resultado |
|---|---|---|
| 1. Línea base de v5 (21 vistas y pestañas) | `linea_base_v5.js` | 0 errores, 0 peticiones externas |
| 2. Regresión v5 → v6 sobre los mismos datos | `regresion_v5_v6.js` | 0 diferencias inesperadas; 9 esperadas (ver §2) |
| 3. Humo v6 (25 vistas, todas las pestañas, 25 trazas, 7 preguntas, genealogía) | `humo_v6.js` | 0 errores, 0 peticiones externas |
| 4. Respaldo y restauración | `respaldo.js` | **14/14 aprobadas** |
| 5. Funcionales, seguridad, permisos, móvil, offline | `funcional.js` | **25/25 aprobadas** |
| 6. Rendimiento con volumen | `rendimiento.js` | 0 errores; tiempos en §5 |

Durante el desarrollo, la batería 5 reportó 2 fallos que se debían a **aserciones incorrectas de la prueba**, no a la aplicación: F12 esperaba 25 reportes cuando v5 trae 23 (+5 = 28) y S01 esperaba ver la etiqueta HTML literal en el título, cuando v6 la descarta como texto. Se corrigieron las aserciones y se repitió toda la batería; los resultados de este informe son de la ejecución final.

## 1. Matriz de resultados

| ID | Prueba | Resultado esperado | Resultado obtenido | Estado | Evidencia |
|---|---|---|---|---|---|
| L01 | Línea base v5: abrir las 21 vistas | Sin errores | 0 errores, 0 recursos externos | Aprobada | `linea_base_v5.json` |
| G01 | Regresión de cálculos (186 aforos, 20 stocks, 119 fertilizaciones, 394 potreros, 144 animales, KPIs del Resumen 30/90/365, alertas por tipo, indicadores) | Idénticos salvo cambios documentados | Idénticos; solo cambian costos por C7 | Aprobada | `regresion_v5_v6.json` |
| G02 | Migración v5 → v6 | Esquema 6, historial, punto previo, datos intactos | `esquema.v = 6`, punto «Antes de actualizar los datos a SIAF v6» con 144 animales | Aprobada | ídem |
| H01 | Humo: 25 vistas y todas las pestañas | Sin errores | 0 errores | Aprobada | salida de `humo_v6.js` |
| H02 | 25 indicadores abren su traza | Modal con registros | 25/25 | Aprobada | ídem |
| H03 | Asistente responde las 7 preguntas sugeridas | Respuesta con periodo | 7/7 | Aprobada | ídem |
| R01 | Exportar respaldo con versión, conteos y SHA-256 | Huella = SHA-256 de `datos` | `7b5cd171…` = Node `crypto` | Aprobada | `respaldo.json` |
| R02 | SHA-256 propio vs referencia (100 KB con UTF-8 multibyte) | Igual | Igual | Aprobada | ídem |
| R03 | Exportar sin fotos | `sinFotos: true` | Sí | Aprobada | ídem |
| R04 | Restaurar respaldo válido | Vista previa «Integridad verificada», reemplazo, bitácora | Cambio posterior revertido; entrada «Restauración» | Aprobada | ídem |
| R05 | Punto de restauración automático antes de restaurar | Creado | «Antes de restaurar «finca_backup_….json»» | Aprobada | ídem |
| R06 | Restaurar respaldo sin fotos conservando fotos | Fotos intactas | 13 → 13 | Aprobada | ídem |
| R07 | Archivo modificado | «Huella no coincide» y casilla obligatoria | Detectado; sin aceptar no restaura | Aprobada | ídem |
| R08 | Archivo malicioso (HTML en nombre, ID con comillas, `dataUrl` y `loteId` inyectados) | Descartar/vaciar; sin ejecución | `xss = null`, animal descartado, `loteId` vaciado | Aprobada | ídem |
| R09 | JSON corrupto y JSON ajeno | Rechazo sin tocar datos | Mensaje de error; botón deshabilitado | Aprobada | ídem |
| R10 | Restaurar un punto de restauración | Datos recuperados | Recuperado | Aprobada | ídem |
| R11 | Respaldo v6 restaurado en v5 (reversión) | Funciona | 144 animales | Aprobada | ídem |
| R12 | Defecto de v5: restaurar respaldo sin fotos | (Documentar) | v5 borra las fotos: 13 → 0 | Defecto confirmado en v5; corregido en v6 (R06) | ídem |
| R13 | Respaldo v5 (formato 1) en v6 | Aviso «sin huella»; restaura; re-migra | Esquema 6 | Aprobada | ídem |
| R14 | Errores JS en respaldo | 0 | 0 | Aprobada | ídem |
| F01 | Inicio y PIN | Ingreso | 1,4 s con carga inicial | Aprobada | `funcional.json` |
| F02 | Crear animal por formulario | Animal en lote, pesaje y compra | Correcto | Aprobada | ídem |
| F03 | Arete duplicado | Rechazo | «Arete duplicado…» | Aprobada | ídem |
| F04 | Editar animal | Guardado | Correcto | Aprobada | ídem |
| F05 | Pesaje | Peso actual/anterior | 350 → 380 | Aprobada | ídem |
| F06 | Mover entre lotes | Lote, ocupación y movimiento | Correcto | Aprobada | ídem |
| F07 | Persistencia tras recargar | Datos presentes | Correcto | Aprobada | ídem |
| F08 | Stock negativo | Bloqueado | Bloqueado | Aprobada | ídem |
| F09 | Eliminar con confirmación | Eliminado | Correcto | Aprobada | ídem |
| F10 | Foto desde archivo/cámara | Guardada y visible | 13 → 14, visible | Aprobada | ídem |
| F11 | Excel y CSV | `.xlsx` válido; CSV UTF-8 con BOM y «;» | Correcto | Aprobada | ídem |
| F12 | 28 reportes | Todos generan tabla | 28/28 | Aprobada | ídem |
| F13 | Exportar finca completa a Excel | `.xlsx` | Correcto | Aprobada | ídem |
| S01 | XSS por nombre de lote | Ejecuta en v5; no en v6 | v5: sí · v6: no | Aprobada | ídem |
| S02 | Depuración de HTML | Solo formato permitido | Correcto | Aprobada | ídem |
| F14 | Permisos rol Consulta | Ve; no mueve, exporta ni restaura | Correcto | Aprobada | ídem |
| F15 | Posponer y reactivar alerta | 42 → 41 → 42 | Correcto | Aprobada | ídem |
| F16 | Desactivar tipo de alerta | 10 → 0 | Correcto | Aprobada | ídem |
| F17 | Indicadores = registros | Inventario 129 = 129; costos iguales | Correcto | Aprobada | ídem |
| F18 | Filtro por grupo | 39 = 39 | Correcto | Aprobada | ídem |
| F19 | Flujo de caja cuadra | Σ meses = total; fijos + variables = total | 160.351.940 | Aprobada | ídem |
| F20 | Calidad detecta huérfano sembrado | ≥ 1 | 4 | Aprobada | ídem |
| F21 | Móvil 390 px sin desborde | `scrollWidth` ≤ 390 | 390 en 8 vistas | Aprobada | capturas `movil_*.png` |
| F22 | Sin red | 0 recursos externos | 0 | Aprobada | ídem |
| F23 | Errores JS | 0 | 0 | Aprobada | ídem |
| P01 | Rendimiento con volumen | Sin degradación | Ver §5 | Aprobada | `rendimiento.json` |

## 2. Diferencias de cálculo v5 → v6 (todas esperadas)

| Indicador | v5 | v6 | Causa |
|---|---|---|---|
| Filas de costos | 664 | 667 | +3 costos directos de cultivos (C7) |
| Costo total | 190.462.640 | 194.277.140 | +3.814.500 (C7) |
| Resumen 90 d: costos / margen | 32.396.440 / 15.067.260 | 33.715.940 / 13.747.760 | C7 |
| Resumen 365 d: costos / margen | 171.462.640 / −123.998.940 | 175.277.140 / −127.813.440 | C7 |
| Documentos de configuración | 6 | 7 | `config/esquema` (N2) |
| Bitácora | +1 | | Registro de la migración |

Todos los demás valores (aforo, fertilización, stock, carga, ocupación, descanso, categorías, ganancia diaria, alertas, lluvia, indicadores productivos) son **idénticos**.

## 3. Cobertura de los 15 puntos mínimos solicitados

| # | Punto | Pruebas |
|---|---|---|
| 1 | Inicio y navegación | F01, L01, H01 |
| 2 | Crear, consultar, editar, eliminar | F02–F09 |
| 3 | Persistencia tras recargar | F07 |
| 4 | Sin Internet | F22, H01, L01 |
| 5 | Cálculos ganaderos, agronómicos y financieros | G01, F17–F19 |
| 6 | Mapa (navegación y selección) | H01 (vista mapa y ficha), F10 (ficha de lote) — el arrastre con gestos no se automatizó |
| 7 | Fotografías | F10, R06, R08 |
| 8 | Usuarios y permisos | F14 |
| 9 | Excel, CSV y JSON | F11–F13, R01–R03 |
| 10 | Restauración | R04–R13 |
| 11 | Archivos inválidos | R07–R09 |
| 12 | Datos de versiones anteriores | G01, G02, R13 |
| 13 | Móvil y escritorio | F21, capturas |
| 14 | Volumen representativo | P01 |
| 15 | Errores y entradas incompletas | F03, F08, R09, validaciones de formularios |

## 4. Aspectos no verificados automáticamente (pendientes de prueba manual)

* Gestos táctiles del mapa (pellizco, arrastrar ganado) y edición de polígonos.
* Cámara real en teléfonos (se probó con selección de archivo).
* Dictado por voz.
* Impresión a PDF (se probó que genera la zona de impresión; el diálogo del sistema no se automatiza).
* Safari / iOS y Firefox (solo se probó Chromium).
* Lectores de pantalla.

## 5. Rendimiento (3.044 animales, 36.592 eventos, 6.033 costos)

| Medición | v5 | v6 |
|---|---|---|
| Carga e ingreso | 954 ms | 978 ms |
| Resumen | 694 ms | 672 ms |
| Ganado | 200 ms | 236 ms |
| Costos | 722 ms | 819 ms |
| Alertas (2.946 alertas) | 264 ms | **121 ms** (paginación) |
| Reportes | 837 ms | 728 ms |
| Indicadores y análisis | — | 257 ms |
| Flujo de caja | — | 45 ms |
| Calidad de datos | — | 48 ms (parte síncrona) |

## 6. Fallos y limitaciones detectados

* **Avalancha de alertas a gran escala** (2.946 alertas «Animal sin movimiento» con datos sintéticos). Mitigado con paginación, posponer y desactivar tipos; la agrupación por lote queda en la hoja de ruta para no cambiar el conteo de alertas original.
* El título de un modal descarta las etiquetas HTML que un usuario escriba en un nombre (p. ej., `<b>`); el texto restante se muestra. Es el comportamiento seguro elegido.
* La fecha «detectada» de una alerta se guarda por dispositivo (almacenamiento local del navegador).
