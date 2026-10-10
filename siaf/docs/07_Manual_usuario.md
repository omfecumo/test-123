# Entregable 7 — Manual de usuario de SIAF v6

## 1. Instalación

SIAF no se instala: es un único archivo.

1. Copie `SIAFver6.html` al computador, tableta o teléfono (USB, correo, nube).
2. Ábralo con un navegador actualizado (Chrome, Edge, Firefox o Safari). Funciona **sin Internet**.
3. Use siempre **el mismo navegador y el mismo archivo/ubicación**: los datos se guardan en ese navegador (IndexedDB).
4. No use modo incógnito: el navegador borra los datos al cerrarlo.

> Si ya usaba SIAF v5 en ese navegador, abra `SIAFver6.html` y sus datos aparecerán. SIAF crea primero un **punto de restauración** con los datos de v5 y luego registra la actualización (no modifica sus registros).

## 2. Ingreso

Seleccione su usuario y escriba el PIN con el teclado en pantalla. PIN iniciales: Administrador 1234 · Encargado 2222 · Veterinario 3333 · Operario 4444 · Consulta 5555. **Cámbielos** en Configuración → Usuarios (la vista «Calidad de datos» avisa qué usuarios conservan el PIN inicial).

La sesión dura 14 días por defecto; en un equipo compartido reduzca este valor en Configuración → Parámetros → «Duración de la sesión».

> Los PIN y roles organizan el trabajo y dejan trazabilidad, pero **no protegen los datos** frente a alguien con acceso al equipo: proteja el dispositivo con su propia contraseña.

## 3. Operación diaria (funciones existentes)

* **Mapa:** toque un lote para su ficha (ganado, potrero, aforo, fertilización, tareas, fotos, costos). Cambie la capa con los botones superiores. Arrastre la burbuja 🐄 a otro lote para mover ganado.
* **Botón ＋:** registro rápido (mover ganado, lluvia, aforo, pesaje y sanidad grupal, fertilización, tarea, observación, foto).
* **🔍:** buscador global (arete, lote, producto, equipo, tarea).
* Los módulos Ganado, Rotación, Aforo, Fertilización, Pluviosidad, Agenda, Inventario, Agricultura, Maquinaria, Mantenimiento, Infraestructura, Agua, Ambiental, Costos, Reportes y Bitácora funcionan igual que en v5.

## 4. Nuevas funciones de v6

### 4.1 Indicadores y análisis
Menú → **Indicadores y análisis** (también desde el Resumen).
1. Elija el periodo (fechas o «Rápido»), y si lo desea un lote, categoría, grupo o sexo.
2. Cada tarjeta muestra el valor, la variación frente al periodo anterior de igual duración y la **naturaleza del dato**: *Medido* (tomado en campo), *Registrado*, *Calculado*, *Estimado* o *Proyección* (no son mediciones).
3. **Toque una tarjeta** para ver los registros que la originan; desde allí puede abrir cada registro o exportar CSV.
4. Al final: gráficos mensuales y una tabla comparativa con la forma de cálculo de cada indicador. «Exportar tabla CSV» e «Imprimir» generan el informe.

Con filtros de animales, los indicadores económicos solo consideran costos asignados a esos animales; con filtro de lote, los asignados a ese lote.

### 4.2 Flujo de caja y rentabilidad
Menú → **Flujo de caja**.
* Tarjetas: ingresos, costos (fijos/variables), margen de contribución, resultado operativo y punto de equilibrio.
* Tabla mensual: **flujo neto aproximado** = ingresos − costos registrados − compras de inventario. El consumo de inventario y los costos estimados se muestran aparte (son costos pero no salidas de caja). Toque un mes para ver sus movimientos.
* «⚙️ Costos fijos / variables» permite clasificar cada categoría.
* «Posibles duplicados contables» señala eventos sanitarios con costo y producto descontado del inventario, y registros de costo idénticos. Revise y corrija desde el registro; SIAF no los modifica.

### 4.3 Centro de alertas
* Filtre por prioridad o tipo. Cada alerta muestra motivo, tipo, prioridad, fecha de detección y estado.
* **Ver registro relacionado** abre el animal, lote, producto, equipo o tarea.
* **Posponer 1 / 7 / 30 días** la oculta temporalmente para todos los usuarios de este dispositivo (queda en «Pospuestas» y puede **reactivarse**).
* Configuración → **Alertas**: active o desactive tipos y ajuste: días de proyección de agotamiento (15), días sin pesaje (120) y factor de gasto atípico (1,5).

### 4.4 Asistente de consultas
Menú → **Asistente de consultas**. Escriba una pregunta o use las sugeridas: costos del mes o del año, potreros que requieren atención, tareas por vencer (puede indicar «en 15 días»), evolución del peso, inventarios con riesgo de agotamiento, lluvia del mes o del año, aplicaciones sanitarias pendientes, un animal (escriba su arete) o un lote («lote 12»). Cada respuesta indica el periodo y permite **ver los registros utilizados**. El asistente funciona sin Internet, no modifica datos y no da recomendaciones veterinarias.

### 4.5 Calidad de datos
Menú → **Calidad de datos**: 16 verificaciones (registros huérfanos, aretes o RFID repetidos, ocupaciones inconsistentes, stock negativo, fechas futuras, pesajes atípicos, datos incompletos, posibles duplicados contables, PIN iniciales) y el estado del almacenamiento (espacio, almacenamiento persistente, fotos, puntos de restauración). Toque un hallazgo para ver los registros y corríjalos en su módulo.

### 4.6 Genealogía
En la ficha de un animal, pestaña **Genealogía**: madre, abuela materna, padre, crías, partos, edad al primer parto e intervalo entre partos.

### 4.7 Reportes nuevos
En Reportes: Flujo de caja mensual, Entradas y salidas del hato por mes, Uso y recuperación de potreros, Indicadores reproductivos por vaca y Calidad de datos. Todos se exportan a PDF, Excel o CSV.

## 5. Respaldo

Configuración → **Respaldo**:
* **Exportar finca (JSON):** descarga `finca_backup_AAAA-MM-DD.json` con todos los datos y fotos, la versión y una **huella SHA-256** para verificar que el archivo no fue alterado.
* **Exportar sin fotos:** más liviano; al restaurarlo puede conservar las fotos del dispositivo.
* **Exportar Excel:** una hoja por módulo (para análisis; no sirve para restaurar).

Recomendación: respalde al menos cada semana (la alerta «Respaldo pendiente» lo recuerda) y guarde copias en otro dispositivo.

> En la vista web incrustada de Claude las descargas están bloqueadas; use el archivo descargado.

## 6. Restauración

1. Configuración → Respaldo → seleccione el archivo `.json` → **Restaurar respaldo** (solo Administrador).
2. Revise la **vista previa**: fecha, usuario y versión del respaldo; estado de integridad (*verificada*, *sin huella* para respaldos de v5, o *huella no coincide*); comparación de cantidades actuales y del respaldo por colección; registros descartados y advertencias.
3. Si el respaldo no trae fotos, marque **conservar las fotos actuales**.
4. Si el archivo fue modificado o tiene registros inválidos, deberá marcar la casilla de confirmación.
5. Al pulsar **Restaurar**, SIAF crea antes un **punto de restauración** con los datos actuales, reemplaza los datos, registra la operación en la bitácora y se reinicia.

## 7. Puntos de restauración (deshacer)

Configuración → Respaldo → **Puntos de restauración**: se crean solos antes de restaurar, actualizar de versión o «Borrar todo», y manualmente con «＋ Crear punto ahora». Se conservan los 3 más recientes. Puede **restaurar** uno (antes se guarda el estado actual) o **descargarlo** como respaldo JSON. Ocupan espacio del navegador; no reemplazan los respaldos en otro dispositivo.

## 8. Actualización y reversión

* **Actualizar:** abra la versión nueva en el mismo navegador; SIAF crea un punto de restauración y migra el esquema sin modificar registros.
* **Volver a v5:** abra `SIAFver5.html` en el mismo navegador (ignora los documentos nuevos) o restaure en v5 un respaldo exportado desde v6. Para el estado exacto previo a la actualización, descargue el punto «Antes de actualizar los datos a SIAF v6» y restáurelo en v5.

## 9. Solución de problemas

| Situación | Qué hacer |
|---|---|
| «No se pudo iniciar SIAF» | Use un navegador actualizado, fuera de modo incógnito |
| Los datos no aparecen | Abra el archivo con el mismo navegador y desde la misma ubicación que antes |
| «La base de datos está abierta en otra pestaña» | Cierre las demás pestañas de SIAF |
| Falta de espacio | Calidad de datos → almacenamiento; exporte un respaldo y elimine puntos de restauración o fotos innecesarias |
| Alertas excesivas | Posponga o desactive tipos en Configuración → Alertas |
| Datos de demostración | Configuración → Respaldo → «Eliminar datos de demostración» antes de operar con datos reales |
