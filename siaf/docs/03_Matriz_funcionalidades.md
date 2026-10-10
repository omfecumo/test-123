# Entregable 3 — Matriz de funcionalidades

Relación entre los módulos originales, las mejoras, su prioridad, esfuerzo y dependencias.
Esfuerzo: B = bajo (< 1 día) · M = medio (1–3 días) · A = alto (> 3 días). Estado: ✔ implementada y probada · ◐ mitigada · ⏳ hoja de ruta.

| Módulo original | Mejora | Prioridad | Esfuerzo | Dependencias | Estado | Prueba |
|---|---|---|---|---|---|---|
| Utilidades (`U.modal`, `U.confirmar`) | Título como texto plano; HTML depurado en confirmaciones; foco devuelto y `aria-labelledby` | P1 | B | — | ✔ | S01, S02 |
| Fotos (`fotosHTML`, ficha animal, `verImagen`) | Solo se muestran imágenes `data:image/*;base64` válidas | P1 | B | `U.srcSeguro` | ✔ | R08, F10 |
| Respaldo (Configuración) | Formato 2: versión de app y esquema, conteos, huella SHA-256 | P1 | M | `Seguro` | ✔ | R01–R03 |
| Restauración | Validación (IDs, imágenes, referencias, roles), vista previa por colección, confirmación reforzada si el archivo fue alterado | P1 | M | `Respaldo.validar` | ✔ | R04, R07–R09, R13 |
| Restauración | Conservar las fotos actuales cuando el respaldo no las trae (corrige pérdida de fotos) | P1 | B | `DB.importar(…, {conservarFotos})` | ✔ | R06, R12 |
| Recuperación | Puntos de restauración automáticos (antes de restaurar, migrar y borrar todo), manuales, descargables | P1 | M | IndexedDB `siaf_recuperacion` | ✔ | R05, R10 |
| Datos | Esquema versionado v6 con historial de migraciones; aviso si los datos son de una versión más nueva | P1 | B | `Migracion` | ✔ | Regresión |
| Costos (`costosDetalle`) | Integrar costos directos de cultivos | P1 | B | — | ✔ | Regresión (diferencia esperada) |
| Ganado / Sanidad grupal | Ayuda contra doble conteo de medicamentos | P1 | B | — | ◐ | Revisión |
| Usuarios | Duración de sesión configurable; aviso de PIN inicial en Calidad | P1 | B | `D.param('diasSesion')` | ◐ | F14 |
| Resumen | Acceso directo a Indicadores | P2 | B | `BI` | ✔ | Humo |
| — (nuevo) Indicadores y análisis | 25 indicadores (hato, producción, reproducción y sanidad, potreros y forraje, recursos, economía); filtros por periodo, lote, categoría, grupo, sexo; comparación con el periodo anterior; naturaleza del dato; trazabilidad con CSV; 6 gráficos mensuales; impresión | P2 | A | `An`, `Traza`, Chart.js | ✔ | F17, F18, humo |
| — (nuevo) Flujo de caja y rentabilidad | Flujo mensual aproximado, fijo/variable configurable, margen de contribución, resultado, punto de equilibrio, comparación por categoría, posibles duplicados | P2 | M | `Fin` | ✔ | F19 |
| Alertas | Estados (posponer 1/7/30 días, reactivar), fecha de detección, prioridad, registro relacionado, filtros por nivel, paginación | P2 | M | `AlertasCfg` | ✔ | F15, rendimiento |
| Alertas | Tipos activables y parámetros (Configuración → Alertas) | P2 | B | `config/alertasConfig` | ✔ | F16 |
| Alertas | Nuevas: riesgo de agotamiento proyectado, animales sin pesaje (agrupadas por lote), gasto mensual atípico | P2 | M | `Alertas6`, `An.proyeccion` | ✔ | Humo |
| Ganado (ficha) | Pestaña Genealogía: madre, abuela, padre, crías, partos, edad al primer parto, IEP | P2 | B | `Genea` | ✔ | Humo |
| Reportes | +5: flujo de caja, entradas/salidas por mes, uso y recuperación de potreros, reproducción por vaca, calidad de datos | P2 | M | `Fin`, `An`, `Calidad` | ✔ | F12 |
| — (nuevo) Calidad de datos | 16 verificaciones de solo lectura + estado del almacenamiento | P2 | M | `Calidad` | ✔ | F20 |
| — (nuevo) Asistente de consultas | Preguntas sobre costos, potreros, tareas, peso, inventario, lluvia, sanidad, animal y lote; muestra periodo y registros | P3 | M | `Asistente` | ✔ | Humo |
| Asistente | Conector opcional con IA externa | P3 | A | Servidor intermedio para la clave | ⏳ | — |
| Datos | Sincronización entre dispositivos | P3 | A | Servidor, resolución de conflictos | ⏳ | — |
| Inventario | Costo promedio ponderado | P3 | M | Migración de movimientos | ⏳ | — |
| Seguridad | Cifrado local con frase clave; bloqueo por intentos | P3 | A | Web Crypto | ⏳ | — |
| Mapa | Georreferenciación GPS | P3 | A | Puntos de control | ⏳ | — |
| Ganado | Lectores EID / básculas Bluetooth | P3 | A | Web Bluetooth / hardware | ⏳ | — |

## Funcionalidades originales preservadas (no modificadas)

Mapa y capas, ficha del lote, movimiento por arrastre, Resumen, ganado (inventario, ficha, eventos, pesaje y sanidad grupal), lotes, rotación y Gantt, aforo (3 métodos), fertilización, pluviosidad, agenda y calendario, inventario, agricultura, maquinaria, mantenimiento, infraestructura, agua, ambiental, costos, 23 reportes, bitácora, parámetros, usuarios, plano, datos de demostración, exportación JSON/Excel/CSV/PDF, buscador global, registro rápido. Verificadas por la línea base, la regresión y las pruebas de humo.
