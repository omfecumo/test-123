# Entregable 1 — Informe de auditoría técnica de SIAFver5.html

**Sistema:** SIAF — Sistema Integral de Administración de Finca (Finca Puerto López)
**Autor del desarrollo original:** © 2026 Omar Fernando Cuadro Mogollón. Todos los derechos reservados.
**Archivo auditado:** `SIAFver5.html` · 2.419.255 bytes · 5.184 líneas · SHA-256 `59ccfff9a12e2d03f9fc82ba49d999ebd4f17fe606d4095529840d196b19c914`
**Fecha de la auditoría:** 10/10/2026
**Método:** lectura completa del código propio (≈ 4.600 líneas de JavaScript y 470 de CSS), ejecución real en Chromium (Playwright) y verificación con datos. Las referencias `l.NNNN` son números de línea de `SIAFver5.html`.

> Regla aplicada: una funcionalidad se marca «Operativa (verificada)» solo si su flujo completo se ejecutó en las pruebas. Ver el Entregable 6.

---

## 1. Resumen ejecutivo

SIAF v5 es una aplicación web **autónoma, sin servidor y realmente offline**: todo (código, fuentes tipográficas, Chart.js 4.5.1, SheetJS, íconos y el plano vectorizado de la finca) está incrustado en un único HTML. Los datos viven en IndexedDB del navegador con caché en memoria, transacciones atómicas y una bitácora automática con valores anteriores y nuevos. Las fórmulas agronómicas (aforo por doble muestreo, regresión, tamaño de muestra, fertilización por nutriente) están documentadas con fuentes y son correctas.

La línea base ejecutada (21 vistas, todas las pestañas) terminó **sin errores de JavaScript y sin ninguna petición a Internet**.

Hallazgos principales:

| # | Hallazgo | Severidad | Estado en v6 |
|---|---|---|---|
| H01 | **XSS almacenado**: el título de los modales se inserta como HTML sin escapar; un nombre de lote con HTML ejecuta código (comprobado) | Crítica | Corregido |
| H02 | La restauración no valida identificadores ni imágenes del respaldo: un archivo manipulado puede inyectar código por atributos (`src`, `data-*`) | Crítica | Corregido |
| H03 | **Restaurar un respaldo «sin fotos» borra todas las fotos del dispositivo** (comprobado: 13 → 0) | Alta | Corregido |
| H04 | Restauración sin vista previa por colección ni punto de recuperación previo | Alta | Corregido |
| H05 | Respaldo sin versión de esquema ni verificación de integridad | Media | Corregido |
| H06 | Los «costos directos» de cultivos no se integran a Costos, Resumen ni Reportes (3,81 M COP omitidos en la demostración) | Media | Corregido |
| H07 | Riesgo de doble conteo en eventos sanitarios (costo del evento + producto descontado del inventario) | Media | Mitigado (aviso y detección; no se alteran totales) |
| H08 | Usuarios y permisos solo en el navegador; PIN corto sin límite de intentos; sesión de 14 días | Alta (equipos compartidos) | Mitigado y documentado; solución completa en hoja de ruta |
| H09 | Avalancha de alertas a gran escala (≈ 2.900 alertas con 3.000 animales) | Media | Mitigado (paginación, posponer, desactivar tipos) |
| H10 | Alertas sin estado, sin fecha de detección y no configurables | Media | Corregido |
| H11 | Resumen sin filtros por lote/categoría ni trazabilidad hasta los registros | Media | Corregido (Indicadores y análisis) |
| H12 | Sin flujo de caja, costos fijos/variables ni indicadores de rentabilidad | Media | Corregido |

---

## 2. Arquitectura y organización

| Capa | Módulo (bloque `<script>`) | Líneas | Responsabilidad |
|---|---|---|---|
| Datos del plano | `data/plano.js` (`window.SIAF_PLANO`) | 498 | 406 elementos vectorizados del plano PDF (lotes, zonas, infraestructura, agua), escala ≈ 11,02 m/unidad |
| Utilidades | `js/util.js` (`U`) | 500–739 | fechas locales, formato es-CO, DOM, modales, formularios declarativos, fotos (reducción a JPEG 1280 px), voz, CSV, tabla, SHA-256 propio |
| Persistencia | `js/db.js` (`DB`) | 741–900 | IndexedDB `siaf_finca` v3, 24 colecciones, caché `Map`, índices en memoria, `lote()` transaccional con bitácora, exportar/importar |
| Seguridad | `js/auth.js` (`Auth`) | 902–987 | 5 roles, 18 permisos, PIN con hash SHA-256, sesión en localStorage |
| Dominio | `js/domain.js` (`D`) | 989–1344 | catálogos, parámetros, potreros, ganado, movimientos, inventario, costos, alertas |
| Carga | `js/seed.js`, `js/demo.js` | 1346–1502, 4704–5027 | lotes desde el plano; 12 meses de demostración marcados `demo:true` |
| Librerías | Chart.js 4.5.1 (MIT), SheetJS (Apache-2.0), Lucide (ISC), Barlow (OFL) | 1504–1520, 5158–5181 | gráficos y Excel, locales |
| Presentación | `app.js`, `map.js`, `charts.js`, `acciones.js`, `v_*.js`, `rapido.js`, `v_config.js` | 1521–5157 | navegación por hash, mapa SVG con gestos, 21 vistas |

**Modelo de datos (24 colecciones):** config, lotes, animales, eventos, movimientos, ocupaciones, planes, insumos, movinv, equipos, mantenimientos, infra, agua, ambiental, tareas, cultivos, labores, costos, usuarios, auditoria, fotos, lluvias, fertilizaciones, aforos. Relaciones por campos `*Id` (loteId, animalId, insumoId, madreId, objetivoId…). El stock no se guarda: se calcula de los movimientos (`D.stock`, l.1206), lo que evita inconsistencias.

**Fortalezas:** independencia total de Internet; transacciones atómicas con bitácora de diferencias (l.812–842); datos de demostración aislados y removibles (l.879–896); fórmulas con fuentes citadas; tablas accesibles bajo los gráficos; validaciones de negocio (stock negativo, arete duplicado, lote bloqueado, descanso mínimo, máximo de N por aplicación); diseño móvil con navegación inferior.

**Debilidades:** archivo único de 2,4 MB difícil de mantener sin un proceso de construcción documentado; la inserción de HTML por plantillas exige escape manual en cada punto; la seguridad depende del navegador; no existe versionado del esquema.

---

## 3. Matriz de auditoría

Estados: **OV** = operativa verificada en prueba · **OP** = operativa con problema · **NV** = existe pero no se verificó de extremo a extremo · **AU** = ausente.

| Módulo | Funcionalidad identificada | Estado | Evidencia en el código | Problema o limitación | Riesgo | Mejora propuesta | Prioridad | Prueba requerida |
|---|---|---|---|---|---|---|---|---|
| Mapa | Plano SVG, capas (lotes, ganado, cultivos, aforo, fertilización, infraestructura, agua, tareas, maquinaria, alertas), zoom/pellizco, arrastrar ganado entre lotes, edición de polígonos | OV | `Mapa` l.1706–1953 | Coordenadas del plano, no geográficas (sin GPS) | Bajo | Georreferenciación opcional (hoja de ruta) | 3 | Humo, navegación |
| Mapa / Lote | Ficha del lote (12 pestañas), acciones rápidas | OV | `Lote.abrir` l.2382 | Títulos de modales sin escapar (`Acc.estado`, `Lote.editar`) | **Crítico (XSS)** | Título como texto | 1 | S01 |
| Resumen | KPIs con tendencia 30/90/365 días, gráficos, plano vivo | OV | `Dash` l.2625–2862 | Sin filtros por lote/categoría/grupo; no lleva a los registros | Medio | Vista «Indicadores y análisis» con trazabilidad | 2 | F17–F18 |
| Ganado | Inventario, ficha individual, pesajes, sanidad, reproducción, movimientos, costos por animal | OV | `Ganado` l.2868–3122 | Sin vista de genealogía (crías, abuela, IEP) aunque `madreId`/`padre` existen; eliminar deja eventos huérfanos | Bajo | Pestaña Genealogía; verificación de huérfanos | 2 | F02–F09, humo |
| Ganado | Eventos sanitarios con descuento de inventario | OP | l.1173–1177, 1243, 1247 | «Costo del evento» + producto valorizado puede contar dos veces | Medio | Aviso en formulario + detección de duplicados | 1 | F19, revisión Fin |
| Potreros | Ocupación, descanso, carga (an/ha, UA/ha), planificador, Gantt | OV | `infoPotrero` l.1072, `Rotacion` l.3513 | — | — | Indicadores de recuperación (descanso real vs mínimo) | 2 | Regresión |
| Aforo | 3 métodos, regresión, R², tamaño de muestra, UGG, días de pastoreo, tasa de crecimiento | OV | `Aforo.calcular` l.4273–4321 | Fórmulas correctas (revisadas); no se modifican | — | Usar en indicadores y asistente | — | Regresión (186 aforos idénticos) |
| Fertilización | Catálogo con fuentes, aporte por nutriente, restricción de pastoreo, inventario | OV | `Fert` l.3955–4227 | Bien resuelto el doble conteo (costoProducto = 0 si descuenta inventario) | — | — | — | Regresión (119 aplicaciones idénticas) |
| Pluviosidad | Registros por pluviómetro, promedio diario, acumulados | OV | `Lluvia` l.3861 | — | — | Usar en indicadores | — | Regresión |
| Agenda | Tareas, calendario integrado | OV | `Tareas` l.3128 | — | — | — | — | Humo |
| Alertas | ≈ 26 tipos derivados de los datos | OP | `alertasCalc` l.1263–1330 | Sin estado (posponer/atendida), sin fecha de detección, no configurables; 1 alerta por animal en «sin movimiento» | Medio | Estados, configuración, paginación, 3 alertas nuevas | 2 | F15–F16, rendimiento |
| Inventario | Existencias, movimientos, mínimos, vencimiento | OV | `Inv` l.3241 | Valoriza con el valor unitario actual (no costo promedio) | Medio | Costo promedio ponderado (hoja de ruta) | 3 | F08 |
| Agricultura | Cultivos, labores, zonas del plano | OV | `Agri` l.3464 | `costo` del cultivo no llega a Costos | Medio | Integrar en `costosDetalle` | 1 | Regresión |
| Maquinaria / Mantenimiento | Equipos, horómetro, programación y calendario | OV | `Maq`, `Mant` l.3341–3458 | — | — | — | — | Humo |
| Infraestructura / Agua / Ambiental | Elementos del plano, revisiones, calibración de básculas | OV | `Infra` l.3582 | — | — | — | — | Humo |
| Costos | Integración automática de 8 fuentes, por lote/animal | OP | `costosDetalle` l.1237 | Omite cultivos; sin fijo/variable, sin flujo de caja, sin naturaleza del dato | Medio | Vista «Flujo de caja y rentabilidad» | 2 | F19 |
| Reportes | 23 reportes, PDF (impresión), Excel (SheetJS), CSV | OV | `Reportes` l.3733 | — | — | 5 reportes nuevos | 2 | F11–F13 |
| Bitácora | Registro de cada operación con diferencias | OV | `DB.lote` l.834 | No incluye la restauración realizada | Bajo | Registrar restauraciones | 1 | R04 |
| Configuración | Parámetros, usuarios, respaldo, demostración | OP | `v_config` l.5029 | Ver H02–H05 | Alto | Respaldo v2, vista previa, puntos de restauración | 1 | R01–R14 |
| Usuarios y permisos | 5 roles, PIN, matriz | OP | `Auth` l.905 | Control solo en el navegador (ver §5) | Alto | Duración de sesión configurable; aviso de PIN inicial; hoja de ruta: cifrado/servidor | 1 | F14 |
| Fotos | Cámara, reducción, galería por entidad | OP | `leerFoto` l.660, `fotosHTML` l.1980 | `dataUrl` insertado en `src` sin validar | **Crítico (vía respaldo)** | Aceptar solo `data:image/*;base64` | 1 | F10, R08 |
| Respaldo | Exportar JSON (con o sin fotos), Excel; importar | OP | l.854–871, 5049–5066 | H02–H05 | Alto | Formato 2 con SHA-256, validación, vista previa, punto previo | 1 | R01–R14 |
| PWA / offline | Archivo único sin dependencias; SW solo en versión multiarchivo | OV (offline) | `registrarSW` l.2125 | En archivo único no hay instalación PWA (decisión de diseño correcta) | Bajo | Documentar | 3 | F22 |
| Rendimiento | Caché en memoria, índices, memo por versión | OV | l.755–759, 1235 | Vista de alertas lenta con miles de alertas | Medio | Paginación | 2 | Rendimiento |
| Código | `Rapido.indicadores()` | NV | l.4677 | Función definida y nunca usada (código muerto) | Bajo | Se usa en la regresión; evaluar retiro | 3 | — |

---

## 4. Cálculos verificados

Se revisaron las fórmulas y se ejecutaron sobre 144 animales, 1.792 eventos, 186 aforos y 119 fertilizaciones:

* **Carga:** UA = peso vivo ÷ 450 kg; UA/ha y animales/ha con área registrada o estimada del plano (marcada «≈»). Correcto.
* **GDP:** (último − penúltimo pesaje) ÷ días. Correcto.
* **Aforo:** MS (kg/ha) = (g ÷ 1000) ÷ m² × 10.000 × %MS ÷ 100; regresión por mínimos cuadrados; N = t²·S²/(0,1·x̄)². Correcto (INTA).
* **Fertilización:** kg nutriente = kg producto × % ÷ 100 (sólidos) o m³ × kg/m³ (líquidos); bulto = 50 kg; fanegada = 0,64 ha. Correcto.
* **Stock:** Σ entradas − Σ salidas ± ajustes. Correcto.
* **Costos:** suma de 8 fuentes; **omisión** de `cultivos.costo` (H06) y **riesgo** de doble conteo sanitario (H07).

Ninguna fórmula correcta se modificó en v6 (Entregable 6, prueba de regresión).

---

## 5. Seguridad, datos y recuperación

| Aspecto | Situación en v5 | Riesgo |
|---|---|---|
| Inyección / XSS | La mayoría de los datos se escapan con `U.esc`, pero los títulos de modal (l.546), `U.confirmar` (l.560) y las imágenes (l.1982, 2973) no | Crítico |
| Autenticación | PIN de 4–8 dígitos, hash SHA-256 con sal fija; sin bloqueo por intentos; el PIN inicial de cada rol se muestra en el ingreso (por diseño, l.961) | Alto en equipos compartidos |
| Autorización | `Auth.exigir` en funciones de dominio y vistas; `DB.lote` no lo exige. Quien tenga el navegador abierto o use las herramientas de desarrollo puede leer o modificar IndexedDB | **No equivale a la seguridad de un servidor** |
| Datos sensibles | Sin cifrado en reposo (IndexedDB y respaldos JSON en texto claro) | Medio |
| Integridad | Validaciones de negocio sólidas; sin verificación de integridad de respaldos | Medio |
| Respaldo | Manual, con recordatorio configurable | Medio |
| Recuperación | Sin punto de restauración; restaurar reemplaza todo | Alto |
| Versionado | Sin versión de esquema; `formato: 1` fijo | Medio |
| Bitácora | Completa en operaciones; no registra restauraciones | Bajo |

**Advertencia expresa:** los usuarios, roles y PIN de SIAF organizan el trabajo en un mismo dispositivo y dejan trazabilidad, pero **no son una barrera de seguridad** frente a alguien con acceso físico al equipo. Para protección real se requiere cifrado de los datos con una clave del usuario o un servidor con autenticación (Entregable 8).

---

## 6. Compatibilidad, dispositivos y dependencias externas

* **Recursos externos:** ninguno. La ejecución bloqueando toda conexión http/https solicitó **0** recursos (pruebas F22, humo).
* **Dispositivos:** diseño adaptable con navegación inferior < 900 px; verificado a 390 px sin desplazamiento horizontal (F21).
* **Navegadores:** requiere IndexedDB, `DOMParser`, ES2020. Probado en Chromium 1194 (Playwright 1.56).
* **Funciones que dependen de Internet:** solo el dictado por voz en algunos navegadores (lo advierte la propia app).
* **Instalación PWA:** solo en la variante multiarchivo servida por HTTP (`registrarSW`); el archivo único funciona offline al abrirse localmente.

## 7. Calidad del código y mantenibilidad

* Código consistente, compacto y con buena separación por módulos lógicos, pero concatenado en un archivo sin proceso de construcción en el repositorio.
* Patrón de plantillas con `innerHTML` y escape manual: eficaz pero propenso a omisiones (origen de H01).
* Bajo acoplamiento con librerías; respaldo SVG si Chart.js no está disponible.
* Rendimiento adecuado: con 3.044 animales y 36.592 eventos la carga tarda < 1 s y el Resumen ≈ 0,6 s (Entregable 6).

**Recomendación de mantenimiento aplicada en v6:** los cambios se generan con un script reproducible (`fuente/construir_v6.py`) que aplica parches verificados sobre el original intacto e inserta un módulo nuevo (`fuente/siaf6.js`), en lugar de reescribir módulos.
