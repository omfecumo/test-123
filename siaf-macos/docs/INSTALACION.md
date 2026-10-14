# Instalación, actualización y desinstalación

## Requisitos

* macOS 12 Monterey o posterior (mínimo de Electron 44).
* Apple Silicon (M1–M4…) o Intel: el instalador es **universal** (un solo archivo para ambos).
* ~500 MB libres para la app y espacio adicional para los respaldos (cada respaldo pesa aproximadamente lo mismo que los datos; con fotos puede ser varios MB).

## Instalar con el DMG (recomendado)

1. Abra `SIAF-9.3.3-universal.dmg`.
2. Arrastre **SIAF** a la carpeta **Aplicaciones**.
3. Expulse el disco «SIAF 9.3.3».
4. Abra SIAF desde Launchpad, Spotlight (⌘ Espacio → «SIAF») o Aplicaciones. Para fijarla en el Dock: clic derecho en su ícono → Opciones → Mantener en el Dock.

### Si macOS dice que no puede verificar la app

Ocurre cuando el instalador **no está firmado con un certificado Developer ID ni notarizado** (caso de los instaladores generados sin credenciales de Apple; ver `DISTRIBUCION.md`):

* macOS 15 o posterior: intente abrirla una vez, luego **Ajustes del Sistema → Privacidad y seguridad →** «SIAF se bloqueó…» → **Abrir de todos modos**, e introduzca su contraseña.
* macOS 12–14: clic derecho (o Control+clic) sobre SIAF en Aplicaciones → **Abrir** → **Abrir**.

Hágalo solo si obtuvo el instalador de una fuente de confianza. Con una versión firmada y notarizada este paso no aparece.

## Instalar con el PKG

Doble clic en `SIAF-9.3.3-universal.pkg` y siga el asistente; instala en `/Applications/SIAF.app`. Útil para instalar en varios equipos o con herramientas de administración (MDM).

## Primer inicio

1. Pantalla de ingreso: el administrador entra con el PIN inicial **1234** y SIAF obliga a cambiarlo.
2. La instalación nueva incluye **datos de demostración** (marcados como tales). Elimínelos en Configuración → Respaldo cuando empiece a trabajar con datos reales, o migre sus datos (ver `MIGRACION.md`).
3. En la barra superior aparece el indicador **💾 Respaldo …**: la app ya hizo la primera copia en disco.

## Dónde se guardan los datos

| Qué | Dónde |
|---|---|
| Base de datos de SIAF (IndexedDB) | `~/Library/Application Support/SIAF/IndexedDB/` |
| Respaldos automáticos, manuales y puntos de recuperación | `~/Library/Application Support/SIAF/Respaldos/` |
| Informes de migración | `~/Library/Application Support/SIAF/Migraciones/` |
| Secuencias de automatización e historial | `~/Library/Application Support/SIAF/Automatizacion/` |
| Preferencias de la app | `~/Library/Application Support/SIAF/preferencias.json` |
| Registro técnico | `~/Library/Application Support/SIAF/logs/siaf.log` |

Para abrir la carpeta: en Finder, menú Ir → Ir a la carpeta… (⇧⌘G) y pegue `~/Library/Application Support/SIAF`. En la app: **Archivo → Abrir carpeta de respaldos**.

## Actualizar

1. Cierre SIAF (⌘Q). Al cerrar, la app guarda un respaldo si hubo cambios.
2. Instale la versión nueva igual que la primera vez (arrastrar al DMG y **Reemplazar**, o el PKG).
3. Abra SIAF: los datos, la sesión, los respaldos y las preferencias se conservan porque viven fuera del paquete de la app y el origen interno `siaf://app` no cambia. Si la versión trae cambios de esquema, SIAF crea su propio punto de restauración antes de migrar (comportamiento original).

Verificado por prueba automatizada (`tests/e2e/05-actualizacion-desinstalacion.spec.js`): 9.3.3 → 9.3.4 conserva todas las colecciones con los mismos conteos y todos los respaldos.

> No instale una versión **anterior** sobre datos creados por una más nueva: SIAF lo detecta y se niega a abrir para no perder información. Use primero la versión más reciente para exportar un respaldo.

## Desinstalar

1. (Recomendado) **Archivo → Crear respaldo ahora** y copie la carpeta `Respaldos` a un lugar seguro.
2. Cierre SIAF y arrastre `SIAF.app` desde Aplicaciones a la Papelera.

Esto **no borra** sus datos ni sus respaldos (están en `~/Library/Application Support/SIAF`). Si reinstala, todo vuelve a aparecer.

Para borrar también los datos (irreversible): elimine la carpeta `~/Library/Application Support/SIAF` **después** de haber guardado una copia de `Respaldos`. Opcionalmente quite SIAF de Ajustes del Sistema → Privacidad y seguridad → Accesibilidad / Monitorización de entrada.
