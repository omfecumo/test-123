# Entregable 8 — Hoja de ruta tecnológica

Escala: Impacto, Costo, Complejidad y Riesgo de 1 (bajo) a 5 (alto). Las fases se ordenan por valor y por dependencia. Todo lo listado aquí **no está implementado** en v6.

## Fase A — Corto plazo (sin servidor, 1–3 meses)

| Mejora | Impacto | Costo | Complejidad | Riesgo | Descripción |
|---|---|---|---|---|---|
| Agrupar alertas repetitivas por lote | 4 | 1 | 2 | 2 | «Animal sin movimiento» y «sin lote» como una alerta por lote cuando superen un umbral (hoy se mitiga con paginación y posponer) |
| Cifrado local opcional | 5 | 2 | 4 | 3 | Cifrar IndexedDB y los respaldos con AES-GCM derivado de una frase clave (PBKDF2, Web Crypto). Riesgo: si se olvida la frase, no hay recuperación |
| Bloqueo por intentos y PIN con sal por usuario | 4 | 1 | 2 | 2 | Retardo progresivo tras PIN incorrectos; sal aleatoria por usuario (migración al cambiar el PIN) |
| Costo promedio ponderado de inventario | 4 | 2 | 3 | 3 | Valorizar consumos con el costo de las entradas (hoy usa el valor unitario actual); requiere guardar el valor en cada entrada |
| Venta/salida múltiple en una sola transacción | 3 | 1 | 2 | 1 | Hoy cada animal se registra por separado; un fallo intermedio deja la operación parcial |
| Limpieza guiada de huérfanos | 3 | 1 | 2 | 2 | Acciones con confirmación desde Calidad de datos (eventos huérfanos, ocupaciones abiertas vacías) |
| Pruebas manuales pendientes | 3 | 1 | 1 | 1 | Gestos del mapa, cámara real, Safari/iOS, Firefox, lector de pantalla |

## Fase B — Mediano plazo (3–9 meses)

| Mejora | Impacto | Costo | Complejidad | Riesgo | Descripción |
|---|---|---|---|---|---|
| Variante multiarchivo instalable (PWA) | 4 | 2 | 2 | 2 | Publicar la variante con *service worker* en un servidor local o HTTPS para instalar en teléfonos; mantener el archivo único como opción |
| Lectores EID y básculas (Web Bluetooth / Web Serial) | 4 | 3 | 4 | 4 | Lectura de chapetas y pesos directa a pesaje grupal (como Herdwatch y CattleMax/TagMax). Requiere hardware y pruebas por modelo |
| Georreferenciación del plano | 3 | 2 | 4 | 3 | Registrar puntos de control GPS para convertir el plano a coordenadas; habilita ubicar animales/fotos por GPS. Biblioteca candidata: Leaflet (BSD-2) |
| Exportación de trazabilidad oficial | 4 | 2 | 3 | 3 | Formato compatible con los registros de movilización exigidos por el ICA (validar requisitos vigentes) |
| Presupuesto y alertas por categoría | 3 | 1 | 2 | 2 | Presupuesto mensual por categoría de costo con seguimiento |

## Fase C — Largo plazo (con infraestructura opcional)

| Mejora | Impacto | Costo | Complejidad | Riesgo | Descripción |
|---|---|---|---|---|---|
| Sincronización entre dispositivos | 5 | 4 | 5 | 5 | Servidor propio (p. ej., CouchDB/PouchDB o API con cola de cambios), identificadores únicos ya existentes, marcas de tiempo `actualizado`, resolución de conflictos por campo y bitácora. **SIAF debe seguir funcionando 100 % offline**; la sincronización sería opcional |
| Autenticación y autorización en servidor | 5 | 4 | 4 | 4 | Necesaria para una seguridad real multiusuario; hoy los permisos son locales |
| Conector opcional de IA externa | 3 | 3 | 3 | 4 | El asistente local enviaría a un **servidor intermedio propio** (que guarda la clave del proveedor) solo un resumen agregado y anónimo de los indicadores, con consentimiento explícito, sin permisos de escritura y con respuestas que citen los datos. No se implementó en v6 para no exponer claves en el navegador ni depender de Internet |
| Análisis predictivo | 3 | 3 | 4 | 4 | Proyección de peso por animal (regresión sobre pesajes) y de forraje con lluvia; mostrar siempre como *Proyección* con su error |
| Sensores (pluviómetros, bebederos, básculas fijas) | 3 | 4 | 4 | 4 | Ingesta por archivo CSV o MQTT en la variante con servidor |
| Imágenes satelitales (NDVI) | 3 | 3 | 4 | 4 | Requiere Internet y proveedor; útil para comparar con aforos |

## Principios que deben mantenerse

1. Operación completa sin Internet; cualquier servicio en red es opcional.
2. Ningún dato real se sobrescribe sin vista previa y punto de restauración.
3. Las estimaciones se identifican como tales.
4. Cambios aplicados como parches verificables sobre el original y probados con la batería de regresión (`pruebas/ejecutar_todo.sh`).
