# Migración desde SIAF HTML (navegador) a SIAF para macOS

## Por qué con un respaldo y no leyendo el navegador

Los datos de la versión HTML viven en la base IndexedDB **del navegador** (Chrome, Safari, Edge…), en un formato interno de cada navegador y ligado a la ubicación del archivo. Leerlos directamente sería frágil y podría dañarlos. El camino verificable es el **respaldo oficial de SIAF**, que ya incluye huellas SHA-256, conteos e imágenes. Los datos del navegador **no se modifican** en ningún momento.

## Procedimiento

1. **En el navegador** (SIAF HTML): Configuración → Respaldo → descargue el respaldo **ZIP** (incluye fotos; recomendado) o «💾 Exportar finca (JSON)». Los respaldos cifrados (`.siaf` o JSON cifrado) también sirven: SIAF pedirá la frase o contraseña.
2. **En SIAF para macOS**: inicie sesión como **administrador** (la migración exige el permiso «importar»).
3. Menú **Archivo → Migrar datos desde SIAF (navegador)…** y elija el archivo.
4. La app analiza el archivo **sin modificarlo** y muestra un informe: tipo, SHA-256, verificación de las huellas del manifiesto, conteo por colección, identificadores inválidos o repetidos, referencias rotas y si hay administrador activo. Si hay errores, no deja continuar.
5. **Continuar en SIAF…** abre la vista previa de restauración **de SIAF** (segunda confirmación) con la comparación «datos actuales / en el respaldo».
6. Al pulsar **♻️ Restaurar**:
   * la app guarda en disco un **punto de recuperación** con los datos actuales (`Respaldos/SIAF_punto_…zip`);
   * SIAF crea su propio punto de restauración interno, reemplaza los datos y verifica los conteos;
   * la app se recarga.
7. Tras recargar, la app compara los conteos de cada colección con los del archivo y muestra **«✅ Migración verificada»** o la lista de diferencias. El informe queda en `~/Library/Application Support/SIAF/Migraciones/migracion_<fecha>.json`.
8. Los usuarios y PIN son los de la versión HTML: ingrese con su PIN de siempre.

## Qué se conserva

Todos los registros de las 29 colecciones con sus **identificadores** (por lo tanto, todas las relaciones: animal ↔ lote, eventos ↔ animal, fotos ↔ entidad…), fechas de creación y modificación, autor, bitácora de auditoría, usuarios con su PIN cifrado (PBKDF2), configuración y fotografías.

## Prueba realizada

`tests/e2e/03-migracion-recuperacion.spec.js` (P10) reproduce la migración real:

1. Abre `SIAF_v9_3_3.html` **original** en Chromium como `file://`, cambia el PIN, registra un animal con fotografía y descarga el ZIP con la función oficial de SIAF (`Resp8.descargarZip`).
2. En una app de escritorio nueva ejecuta Archivo → Migrar datos…
3. Comprueba: informe previo con huellas verificadas, vista previa de SIAF, recarga, ingreso con el PIN del navegador, «Migración verificada», **mismos identificadores en cada colección**, mismas fotos, misma fecha de creación del animal, foto vinculada, informe `estado: verificada` sin diferencias, punto de recuperación en disco y archivo de origen intacto.

Evidencias: `evidencias/migracion-analisis-previo.txt`, `evidencias/migracion-informe.json`, capturas `07`–`09`.

## Volver atrás

Archivo → **Restaurar desde un respaldo de la app…** → elija el punto `SIAF_punto_…` creado antes de la migración. El navegador conserva siempre sus datos originales.

## No elimine la base original hasta

1. ver «Migración verificada»,
2. revisar algunas fichas, fotos y reportes en la app,
3. y tener al menos un respaldo manual nuevo de la app (Archivo → Crear respaldo ahora).
