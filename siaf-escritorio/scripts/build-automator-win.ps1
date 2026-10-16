# Compila el auxiliar nativo de Windows (siaf-automator.exe) con el compilador C# incluido en .NET Framework 4.x
# (presente en todo Windows 10/11): no requiere Visual Studio ni el SDK de .NET. Deja el resultado en build\bin\.
#   powershell -ExecutionPolicy Bypass -File scripts\build-automator-win.ps1
$ErrorActionPreference = 'Stop'
$raiz = Split-Path -Parent $PSScriptRoot
$fw = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319'
if (-not (Test-Path "$fw\csc.exe")) { $fw = Join-Path $env:WINDIR 'Microsoft.NET\Framework\v4.0.30319' }
$csc = Join-Path $fw 'csc.exe'
if (-not (Test-Path $csc)) { throw 'No se encontró csc.exe de .NET Framework 4.x' }

function Buscar-Dll($nombre) {
  $candidatos = @(
    (Join-Path $fw "WPF\$nombre"),
    (Join-Path $fw $nombre),
    "${env:ProgramFiles(x86)}\Reference Assemblies\Microsoft\Framework\.NETFramework\v4.8\$nombre",
    "${env:ProgramFiles(x86)}\Reference Assemblies\Microsoft\Framework\.NETFramework\v4.7.2\$nombre"
  )
  foreach ($c in $candidatos) { if (Test-Path $c) { return $c } }
  $gac = Get-ChildItem -Path (Join-Path $env:WINDIR 'Microsoft.NET\assembly') -Recurse -Filter $nombre -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($gac) { return $gac.FullName }
  throw "No se encontró $nombre"
}
$refs = @('UIAutomationClient.dll', 'UIAutomationTypes.dll', 'WindowsBase.dll', 'System.Web.Extensions.dll') | ForEach-Object { "/r:" + (Buscar-Dll $_) }

New-Item -ItemType Directory -Force -Path (Join-Path $raiz 'build\bin') | Out-Null
$salida = Join-Path $raiz 'build\bin\siaf-automator.exe'
$fuente = Join-Path $raiz 'native\SIAFAutomatorWin\SiafAutomator.cs'
$manifiesto = Join-Path $raiz 'native\SIAFAutomatorWin\app.manifest'
& $csc /nologo /optimize+ /platform:anycpu /target:exe "/win32manifest:$manifiesto" "/out:$salida" @refs $fuente
if ($LASTEXITCODE -ne 0) { throw "csc.exe terminó con código $LASTEXITCODE" }
& $salida version
if ($LASTEXITCODE -ne 0) { throw 'El auxiliar no se ejecutó correctamente' }
Write-Host "OK $salida"
