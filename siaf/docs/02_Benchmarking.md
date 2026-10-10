# Entregable 2 — Informe de benchmarking tecnológico

**Fecha de consulta de fuentes:** 10/10/2026. Precios y características cambian con frecuencia: confirme siempre en la página oficial antes de decidir.

**Convenciones**
* ✔ **Confirmado** en página oficial, tienda de aplicaciones o repositorio oficial.
* ◐ **Comercial / según terceros**: aparece en reseñas (Capterra, GetApp, FitGap, revistas) o depende del plan contratado.
* ? **Pendiente de validación**: no se pudo verificar con fuentes disponibles.

No se copió código ni elementos protegidos de ningún producto. Las mejoras de SIAF v6 son implementaciones propias inspiradas en necesidades funcionales comunes del sector.

---

## 1. Soluciones revisadas

### 1.1 CattleMax — https://cattlemax.com
* **Público:** ganaderos de carne (cría, pie de cría, comerciales), EE. UU.
* **Funcionalidades:** registros individuales, servicios y partos, rotación de potreros, pesajes contra DEP; la página de precios menciona registros completos del hato, mapas de potreros, libro de ingresos y gastos, calendario y usuarios ilimitados; planes para hatos registrados con interfaces a asociaciones de raza y pedigrí de 3 generaciones ✔ ([precios](https://cattlemax.com/pricing)).
* **Offline:** el software principal funciona en línea; la app complementaria **TagMax** trabaja sin conexión en «sesiones» (lectura de chapetas EID y pesos) que luego se exportan a la cuenta ✔ ([App Store](https://apps.apple.com/np/app/tagmax-by-cattlemax/id945614936)); el resto requiere conexión ◐ ([SourceForge](https://sourceforge.net/software/product/HerdQuarters/alternatives)).
* **Licencia/costo:** prueba gratuita de 21 días ✔; precios exactos no visibles en la página consultada; terceros reportan desde US$12/mes (FitGap) o US$145 pago único (Capterra, posiblemente desactualizado) ◐ ([Capterra](https://www.capterra.com/p/5583/CattleMax/), [FitGap](https://us.fitgap.com/products/030482/cattlemax)).
* **Limitaciones para SIAF:** orientado a EE. UU. (DEP, asociaciones), nube obligatoria para la mayoría de funciones, sin aforo de pasturas tropicales.
* **Adaptable a SIAF:** genealogía de 3 generaciones (→ pestaña Genealogía), trazabilidad por animal, libro de ingresos/gastos.

### 1.2 AgriWebb — https://www.agriwebb.com
* **Público:** operaciones ganaderas medianas y grandes (Australia, EE. UU., Reino Unido).
* **Funcionalidades:** planes de pastoreo por potrero, movimientos, inventario animal, mapas, tareas, reportes de cumplimiento, clima, reportes financieros; integra dispositivos de terceros (Gallagher, Tru-Test, Allflex, Shearwell, Farmbot, CiboLabs, entre otros) ◐ ([FlyPix](https://flypix.ai/agriwebb-tool-review/), [FitGap](https://us.fitgap.com/products/021283/agriwebb), [PIRSA](https://pir.sa.gov.au/research/agtech/find_solutions/products/agriwebb)).
* **Offline:** captura en campo sin señal y sincronización posterior con la nube ◐.
* **Costo:** suscripción mensual (PIRSA ✔ sin costo inicial); montos publicados por terceros contradictorios (≈ US$30/mes en 2026; tarifas de 2018 de US$50–200/mes) ? ([OSU 2018](https://u.osu.edu/agsoftwarelibrary/2018/03/21/agriwebb)).
* **Adaptable a SIAF:** días-animal por potrero y descanso/recuperación (→ indicadores de potreros y reporte de uso), integración con básculas EID (→ hoja de ruta).

### 1.3 Farmbrite — https://www.farmbrite.com
* **Público:** fincas pequeñas y medianas mixtas (cultivos + ganado).
* **Funcionalidades:** ganado, cultivos, inventario, tareas, contabilidad integrada, mano de obra, clientes y tienda en línea, app móvil ◐ ([Capterra](https://www.capterra.com/p/136765/Farmbrite/), [GetApp](https://www.getapp.com/industries-software/a/farmbrite/)).
* **Costo:** desde US$29/mes, versión gratuita y prueba ◐.
* **Limitaciones:** nube; reseñas señalan curva de aprendizaje y profundidad variable por especie ◐.
* **Adaptable a SIAF:** contabilidad simplificada (→ flujo de caja, fijos/variables, rentabilidad).

### 1.4 Herdwatch — https://herdwatch.com
* **Público:** ganaderos de carne y leche (Irlanda, Reino Unido, EE. UU.).
* **Funcionalidades:** nacimientos, muertes, movimientos, tratamientos, reproducción, inventario de medicamentos, lectores EID Bluetooth y básculas ✔ ([cattle](https://herdwatch.com/en-uk/solutions/cattle/)).
* **Offline:** registro en el brete o el campo sin señal y sincronización posterior ✔.
* **Costo:** Reino Unido: 6 meses por £79 + IVA ✔; otros mercados con cotización ✔ ([precios](https://herdwatch.com/price/)); versión básica gratuita según FAQ ◐.
* **Adaptable a SIAF:** inventario de medicamentos ligado a tratamientos (SIAF ya lo tiene) y advertencia de doble conteo (→ v6).

### 1.5 MaiaGrazing — https://maiagrazing.com
* **Público:** pastoreo planificado (Australia, EE. UU.).
* **Funcionalidades:** planes de pastoreo, presupuesto forrajero («feed budget»), forraje en oferta, escenarios y pronósticos, gráfica de pastoreo ✔ ([features](https://www.maiagrazing.com/features), [pricing](https://www.maiagrazing.com/pricing)).
* **Offline:** la app MaiaGrazing Plus registra ganado, lluvia y movimientos sin conexión ✔ ([App Store](https://apps.apple.com/app/id1484589740)).
* **Costo:** Lite gratuito; Pro desde A$29/semana ✔ (sin GST).
* **Adaptable a SIAF:** días de forraje disponibles (SIAF ya calcula días de pastoreo y forraje estimado; v6 lo consolida en indicadores y asistente).

### 1.6 PastureMap — https://pasturemap.com
* **Funcionalidades:** planificación de pastoreo por animales/acre y días de descanso, seguimiento de descanso y utilización, mapas ✔ ([App Store](https://apps.apple.com/app/pasturemap/id1664810460)).
* **Costo:** referencias de 2022 (US$200–750/año) ? ([Beef Magazine](https://www.beefmagazine.com/grazing-systems/develop-cattle-grazing-plan-with-these-4-apps)).
* **Adaptable a SIAF:** descanso real frente al mínimo (→ indicador «Descanso real promedio» y reporte de uso de potreros).

### 1.7 Alternativas de código abierto
| Proyecto | Licencia | Características | Uso posible en SIAF |
|---|---|---|---|
| **farmOS** — https://farmos.org | GPL ✔ | Servidor Drupal; áreas, siembras, animales, equipos, análisis de suelo, sensores; app de campo con captura offline y PWA ✔ ([farmos.org](https://farmos.org/), [DPG](https://digitalpublicgoods.net/registry/farmos.html)) | Referencia de arquitectura para sincronización opcional (hoja de ruta). Su licencia GPL obliga a revisar compatibilidad antes de incorporar código; **no se incorporó código**. |
| **LiteFarm** — https://www.litefarm.org | GPL-3.0 ✔ ([GitHub](https://github.com/GOATech/LiteFarm)) | Tareas, mapa de finca, gastos, certificaciones; desplegado en América Latina ✔ ([UBC](https://ubcfarm.ubc.ca/litefarm/)) | Referencia funcional (gastos y tareas). Sin código incorporado. |

### 1.8 Referentes en Colombia
* **Control Ganadero:** app con almacenamiento offline y sincronización web ◐ ([CONtexto Ganadero](https://www.contextoganadero.com/ganaderia-sostenible/control-ganadero-se-renueva-para-brindar-mas-servicios?amp=1)); vigencia de la función offline pendiente ?.
* **SINIGAN (ICA):** registro, trazabilidad y movilización; requiere conexión ✔ ([App Store](https://apps.apple.com/co/app/sinigan/id6758207217)). Relevante para una futura exportación de trazabilidad (hoja de ruta).
* **Software Ganadero SG / Agromanager (UPB):** potreros, rotación, genealogía ◐ ([Engormix](https://www.engormix.com/ganaderia/administracion-ganaderia-carne/informacion-sobre-algun-software_f7980/), [UPB](https://repository.upb.edu.co/handle/20.500.11912/12533)).

### 1.9 Bibliotecas técnicas evaluadas
| Biblioteca | Licencia | Decisión |
|---|---|---|
| Chart.js 4.5.1 | MIT | Ya incluida; reutilizada en v6 |
| SheetJS | Apache-2.0 | Ya incluida; reutilizada (Excel) |
| Web Crypto (`crypto.subtle`) | Estándar del navegador | Usada para SHA-256 cuando existe; respaldo propio en JS puro |
| Leaflet / Turf.js | BSD-2 / MIT | No incorporadas: SIAF usa el plano propio sin GPS; candidatas para georreferenciación (hoja de ruta) |
| Dexie.js | Apache-2.0 | No necesaria: la capa `DB` propia funciona bien |
| jsPDF | MIT | No necesaria: la impresión a PDF del navegador ya funciona offline |

---

## 2. Matriz comparativa de funcionalidades

✔ disponible · ◐ parcial / según plan · ✖ no disponible · ? no verificado

| Funcionalidad | CattleMax | AgriWebb | Farmbrite | Herdwatch | MaiaGrazing | PastureMap | farmOS | SIAF v5 | SIAF v6 |
|---|---|---|---|---|---|---|---|---|---|
| Funciona 100 % sin Internet y sin servidor | ✖ (TagMax ◐) | ◐ sync | ? | ◐ sync | ◐ sync | ? | ◐ sync | ✔ | ✔ |
| Registro individual y sanidad | ✔ | ✔ | ✔ | ✔ | ◐ | ◐ | ✔ | ✔ | ✔ |
| Genealogía / reproducción | ✔ (3 gen.) | ◐ | ◐ | ✔ | ✖ | ✖ | ◐ | ◐ (datos sin vista) | ✔ (madre, abuela, crías, IEP) |
| Mapa de potreros | ✔ | ✔ | ◐ | ✖ | ✔ | ✔ | ✔ | ✔ (plano real) | ✔ |
| Rotación y descanso | ✔ | ✔ | ✖ | ✖ | ✔ | ✔ | ◐ | ✔ | ✔ + descanso real |
| Aforo / forraje disponible | ✖ | ◐ (integraciones) | ✖ | ✖ | ✔ | ◐ | ✖ | ✔ (3 métodos) | ✔ |
| Fertilización por nutriente | ✖ | ✖ | ◐ | ✖ | ✖ | ✖ | ◐ | ✔ | ✔ |
| Inventario con stock mínimo | ◐ | ◐ | ✔ | ✔ (medicinas) | ✖ | ✖ | ◐ | ✔ | ✔ + proyección |
| Ingresos/gastos | ✔ | ✔ | ✔ | ◐ | ◐ | ✖ | ◐ | ✔ | ✔ |
| Flujo de caja / rentabilidad | ? | ◐ | ✔ | ✖ | ◐ | ✖ | ✖ | ✖ | ✔ |
| Indicadores con filtros y trazabilidad | ◐ | ✔ | ◐ | ◐ | ✔ | ◐ | ◐ | ◐ | ✔ |
| Alertas configurables | ? | ◐ | ◐ | ◐ | ? | ? | ✖ | ◐ | ✔ |
| Asistente de consultas | ✖ | ? | ✖ | ✖ | ✖ | ✖ | ✖ | ✖ | ✔ (local) |
| Respaldo verificable y restauración segura | n/a (nube) | n/a | n/a | n/a | n/a | n/a | ◐ | ◐ | ✔ |
| Sincronización multiusuario | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✖ | ✖ (hoja de ruta) |
| Lectores EID / básculas | ◐ | ✔ | ? | ✔ | ? | ? | ◐ | ✖ | ✖ (hoja de ruta) |
| Costo de licencia | Suscripción | Suscripción | Suscripción | Suscripción | Gratis/Pro | Suscripción | Gratis (GPL) | Propio | Propio |

**Lectura:** la ventaja diferencial de SIAF es la operación completamente autónoma, el plano real de la finca y el detalle agronómico (aforo y fertilización tropical). Sus brechas frente al mercado eran analítica con trazabilidad, finanzas, gestión de alertas, genealogía y, sobre todo, la sincronización entre dispositivos y la seguridad de servidor, que exigen infraestructura.

---

## 3. Selección de mejoras (puntuación 1–5)

**Criterios** (5 = más favorable): V valor para la administración · P impacto en productividad · E beneficio económico · F facilidad de uso · A compatibilidad con la arquitectura actual · O funcionamiento offline · C costo de implementación (5 = bajo) · R riesgo técnico (5 = bajo) · S seguridad y protección de datos · M mantenimiento (5 = simple). Se implementa si el total ≥ 38/50 y no requiere servidor.

| Mejora candidata | V | P | E | F | A | O | C | R | S | M | Total | Decisión |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Corrección de XSS y saneamiento de respaldos | 5 | 3 | 3 | 5 | 5 | 5 | 5 | 5 | 5 | 5 | **46** | Implementada (P1) |
| Respaldo v2 con SHA-256, vista previa y puntos de restauración | 5 | 4 | 4 | 4 | 5 | 5 | 4 | 4 | 5 | 4 | **44** | Implementada (P1) |
| Integrar costos de cultivos y detectar duplicados contables | 4 | 3 | 5 | 5 | 5 | 5 | 5 | 5 | 3 | 5 | **45** | Implementada (P1) |
| Migración versionada con punto previo | 4 | 3 | 3 | 5 | 5 | 5 | 4 | 4 | 5 | 4 | **42** | Implementada (P1) |
| Indicadores con filtros y trazabilidad | 5 | 4 | 4 | 4 | 5 | 5 | 3 | 4 | 3 | 3 | **40** | Implementada (P2) |
| Flujo de caja, fijo/variable, rentabilidad | 5 | 3 | 5 | 4 | 5 | 5 | 4 | 4 | 3 | 4 | **42** | Implementada (P2) |
| Alertas configurables con estado | 4 | 5 | 3 | 4 | 5 | 5 | 4 | 4 | 3 | 4 | **41** | Implementada (P2) |
| Genealogía y reproducción (IEP) | 4 | 3 | 4 | 5 | 5 | 5 | 5 | 5 | 3 | 5 | **44** | Implementada (P2) |
| Verificación de calidad de datos | 4 | 4 | 3 | 4 | 5 | 5 | 4 | 5 | 4 | 4 | **42** | Implementada (P2) |
| Asistente de consultas local | 4 | 4 | 3 | 5 | 5 | 5 | 4 | 4 | 4 | 4 | **42** | Implementada (P3) |
| Asistente con IA externa (LLM) | 4 | 4 | 3 | 5 | 3 | 1 | 3 | 2 | 2 | 3 | 30 | Documentada; no implementada |
| Sincronización entre dispositivos | 5 | 5 | 4 | 4 | 2 | 3 | 1 | 2 | 3 | 2 | 31 | Hoja de ruta (requiere servidor) |
| Lectores EID / básculas Bluetooth | 4 | 5 | 3 | 4 | 3 | 5 | 2 | 2 | 4 | 3 | 35 | Hoja de ruta (requiere hardware) |
| Georreferenciación GPS del plano | 3 | 3 | 2 | 4 | 3 | 4 | 3 | 3 | 4 | 3 | 32 | Hoja de ruta |
| Imágenes satelitales (NDVI) | 3 | 3 | 3 | 4 | 2 | 1 | 2 | 2 | 3 | 2 | 25 | Descartada por ahora (requiere Internet) |

No se incorporó ninguna función solo porque otro software la tenga: cada mejora implementada usa datos que SIAF ya registra y funciona sin Internet.
