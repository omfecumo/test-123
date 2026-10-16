# SIAF para Windows

Misma aplicación que la versión de macOS (una sola base de código: `siaf-escritorio/`), empaquetada para **Windows 10 y 11, x64 y ARM64**. SIAF (`source/SIAF_v9_3_3.html`) se ejecuta sin reescribirse, con los mismos respaldos, migración, roles y módulo de automatización. Este documento recoge solo lo que cambia en Windows; el resto está en los demás documentos de `docs/`.

## Arquitectura en Windows

| Pieza | macOS | Windows |
|---|---|---|
| Motor de la app | Electron 44 (Chromium) | Igual |
| Datos de SIAF | `~/Library/Application Support/SIAF` | `%APPDATA%\SIAF` (p. ej. `C:\Users\<usuario>\AppData\Roaming\SIAF`) |
| Respaldos | `…/SIAF/Respaldos` | `%APPDATA%\SIAF\Respaldos` |
| Auxiliar de automatización | Swift: AXUIElement, CGEvent, CGEventTap | **C# (.NET Framework 4.x, incluido en Windows): UI Automation, SendInput, hooks de bajo nivel en modo solo lectura** |
| Instaladores | DMG, PKG, ZIP (universal) | **NSIS `.exe` (por usuario), MSI (por equipo), ZIP portátil** — x64 y ARM64 |
| Firma | Developer ID + notarización | Authenticode (certificado de firma de código) |
| Atajo «detener automatización» | ⌘⇧⎋ | **Ctrl+Alt+Mayús+X** (Ctrl+Mayús+Esc está reservado al Administrador de tareas) |
| Atajos de la app | ⌘1…⌘9, ⌘S, ⌘P, ⌘F | Ctrl+1…Ctrl+9, Ctrl+S, Ctrl+P, Ctrl+F; Preferencias de respaldo en Herramientas (Ctrl+,) |

Por qué no se usó otra tecnología: WebView2 (motor de Edge) también es Chromium, pero exigiría reescribir en .NET los respaldos, la migración, los menús y la automatización que ya están probados en Electron, y mantener dos bases de código. Con Electron, Windows y macOS comparten exactamente el mismo código y las mismas pruebas.

## Instalar

### Instalador NSIS (recomendado)

1. Ejecute `SIAF-<versión>-x64-instalador.exe` (o `-arm64-` en equipos ARM como Surface Pro X / Copilot+ PC).
2. Elija «Solo para mí» (no pide contraseña de administrador; instala en `%LOCALAPPDATA%\Programs\SIAF`) o «Para todos los usuarios» (pide administrador; instala en `C:\Program Files\SIAF`), y la carpeta.
3. Se crean accesos directos en el **menú Inicio** y en el **Escritorio**. Para la barra de tareas: clic derecho en SIAF → Anclar a la barra de tareas.

Instalación silenciosa (equipos administrados): `SIAF-<versión>-x64-instalador.exe /S` (por usuario) o `/S /allusers`.

### MSI (empresas, GPO, Intune)

`msiexec /i SIAF-<versión>-x64.msi /qn` — instala para todos los usuarios en `C:\Program Files\SIAF` con accesos directos.

### ZIP portátil

Descomprima y ejecute `SIAF.exe`. No crea accesos directos ni entrada en «Agregar o quitar programas». Los datos van igualmente a `%APPDATA%\SIAF`.

### Si aparece «Windows protegió su PC» (SmartScreen)

Ocurre porque los instaladores generados en este proyecto **no están firmados** con un certificado Authenticode (no se dispone de uno). Pulse **Más información → Ejecutar de todas formas**, solo si obtuvo el instalador de una fuente de confianza. Con una versión firmada el aviso desaparece o se reduce (un certificado nuevo gana reputación en SmartScreen con el uso).

## Actualizar

Cierre SIAF (al cerrar hace un respaldo si hubo cambios) y ejecute el instalador de la versión nueva: reemplaza los archivos del programa y conserva datos, sesión, respaldos y preferencias (están en `%APPDATA%\SIAF`, fuera de la carpeta del programa).

## Desinstalar

Configuración → Aplicaciones → SIAF → Desinstalar (o «Agregar o quitar programas»). **No borra** `%APPDATA%\SIAF` (datos y respaldos): el instalador está configurado con `deleteAppDataOnUninstall: false`, y la CI lo verifica. Para borrar todo (irreversible), elimine después esa carpeta, habiendo copiado antes `Respaldos`.

## Migración desde SIAF en el navegador

Igual que en macOS (`MIGRACION.md`): en Chrome/Edge, Configuración → Respaldo → descargar el ZIP; en la app, Archivo → Migrar datos desde SIAF (navegador)…

## Automatización en Windows

* **Sin permisos especiales:** Windows permite a una aplicación normal usar UI Automation y enviar teclado/ratón a la aplicación que está al frente. SIAF igualmente solo actúa sobre las aplicaciones que usted autoriza (pestaña «Permisos y aplicaciones» → elegir el `.exe` o una app abierta) y solo mientras graba o ejecuta.
* **Identificador de la aplicación:** el nombre del ejecutable en minúsculas (`notepad.exe`, `excel.exe`); si la autoriza eligiendo el `.exe`, se guarda la ruta para poder abrirla.
* **Mecanismos:** pulsar con los patrones de UI Automation (Invoke, Toggle, SelectionItem, ExpandCollapse; si no hay, clic en el centro del control); escribir con ValuePattern o, en modo «teclear», con pulsaciones Unicode (SendInput); leer con ValuePattern/TextPattern; menús por nombre; clic por posición relativa a la ventana como complemento. Un paso «Validar valor» o «Escribir texto» sin control indicado usa el **control que tiene el foco**.
* **Grabación:** hooks `WH_MOUSE_LL`/`WH_KEYBOARD_LL` en modo solo lectura, instalados solo durante la grabación; solo se emiten eventos cuando la app al frente está autorizada; los **campos de contraseña** (`IsPassword`) nunca se graban ni se escriben. Escape dos veces detiene.
* **No disponibles en Windows:** pasos AppleScript y Atajos (son de macOS; no aparecen en el editor en Windows).
* **Limitación UIPI:** Windows impide que un programa normal controle uno abierto «como administrador». SIAF no lo intenta saltar: abra ese programa sin elevar o no lo automatice.
* Otras limitaciones como en macOS: apps sin controles accesibles (juegos, interfaces dibujadas a mano) solo admiten clic por posición; no hay reconocimiento de imágenes.

## Compilar en Windows

Requisitos: Windows 10/11, Node.js 22, Git. **No** se necesita Visual Studio: el auxiliar se compila con el `csc.exe` de .NET Framework incluido en Windows.

```powershell
cd siaf-escritorio
powershell -ExecutionPolicy Bypass -File scripts\build-win.ps1        # x64
$env:SIAF_ARCH='todas'; powershell -ExecutionPolicy Bypass -File scripts\build-win.ps1   # x64 + ARM64
```

Salidas en `dist\`: `SIAF-<versión>-<arch>-instalador.exe`, `SIAF-<versión>-<arch>.msi`, `SIAF-<versión>-<arch>-win.zip`, `win-unpacked\` y `SHA256SUMS.txt`. Desde Linux/macOS solo puede generarse el ZIP sin firma (`npm run dist:win:sin-firma-desde-linux`).

CI: `.github/workflows/siaf-windows.yml` compila y prueba en **Windows Server 2025 x64** y **Windows 11 ARM64**: auxiliar, pruebas unitarias, diagnóstico con el Bloc de notas, pruebas E2E, empaquetado, instalación silenciosa NSIS y MSI, prueba de la app instalada y verificación de que la desinstalación conserva los respaldos.

## Firma de código (Authenticode)

**Estado: sin firmar** (no hay certificado). No se simula ninguna firma.

Opciones para firmar:

1. **Certificado de firma de código OV/EV** de una autoridad (DigiCert, Sectigo, GlobalSign…). Desde 2023 la clave privada debe estar en un token/HSM; electron-builder admite firmar con `signtool` y un certificado del almacén (`win.certificateSubjectName`) o con un `.pfx` si el proveedor lo permite: `CSC_LINK=C:\cert.pfx`, `CSC_KEY_PASSWORD=…`.
2. **Azure Trusted Signing** (servicio de Microsoft, económico): configure `win.azureSignOptions` (endpoint, perfil de certificado, cuenta) y las variables `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`.

Verificación: `Get-AuthenticodeSignature dist\SIAF-*-instalador.exe` debe indicar `Valid`. En CI, guarde las credenciales como *secrets* y páselas como variables de entorno al paso «Empaquetar».

## Pruebas en Windows

Ver la columna Windows en `PRUEBAS.md` y los registros `evidencias/ci-windows-*.txt`.
