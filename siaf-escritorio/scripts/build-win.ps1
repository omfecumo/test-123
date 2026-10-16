# Compilación reproducible de SIAF para Windows: instalador NSIS (.exe), MSI y ZIP portátil.
#
#   powershell -ExecutionPolicy Bypass -File scripts\build-win.ps1             # x64
#   $env:SIAF_ARCH='arm64'; powershell -ExecutionPolicy Bypass -File scripts\build-win.ps1
#   $env:SIAF_ARCH='todas'  (x64 + arm64)
#
# Firma Authenticode (opcional; sin ella Windows SmartScreen advierte al instalar):
#   $env:CSC_LINK = 'C:\ruta\certificado.pfx' (o base64)   $env:CSC_KEY_PASSWORD = '…'
#   (Certificados en token USB/HSM o Azure Trusted Signing: ver docs\WINDOWS.md)
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)
$arch = if ($env:SIAF_ARCH) { $env:SIAF_ARCH } else { 'x64' }
$archs = switch ($arch) { 'x64' { @('--x64') } 'arm64' { @('--arm64') } 'todas' { @('--x64', '--arm64') } default { throw 'SIAF_ARCH debe ser x64, arm64 o todas' } }

Write-Host '> 1/6 Dependencias (npm ci)'
npm ci --no-audit --no-fund; if ($LASTEXITCODE) { throw 'npm ci' }
Write-Host '> 2/6 Preparar SIAF (verificación SHA-256 del original + puente de escritorio)'
node scripts/prepare-web.mjs; if ($LASTEXITCODE) { throw 'prepare-web' }
Write-Host '> 3/6 Auxiliar nativo de automatización (C#, .NET Framework 4.x incluido en Windows)'
& powershell -NoProfile -ExecutionPolicy Bypass -File scripts\build-automator-win.ps1; if ($LASTEXITCODE) { throw 'auxiliar' }
Write-Host '> 4/6 Pruebas unitarias'
npm run test:unit; if ($LASTEXITCODE) { throw 'pruebas unitarias' }

$firma = [bool]($env:CSC_LINK -or $env:WIN_CSC_LINK)
Remove-Item -Recurse -Force dist -ErrorAction SilentlyContinue
Write-Host "> 5/6 Empaquetado ($arch) - firma Authenticode: $firma"
if (-not $firma) { Write-Warning 'Sin certificado: los instaladores NO estarán firmados (SmartScreen mostrará una advertencia).' }
npx electron-builder --win nsis msi zip @archs --publish never; if ($LASTEXITCODE) { throw 'electron-builder' }

Write-Host '> 6/6 Verificación'
Get-ChildItem dist -Filter *.exe | ForEach-Object { $s = Get-AuthenticodeSignature $_.FullName; Write-Host ("{0}: firma {1}" -f $_.Name, $s.Status) }
Get-ChildItem dist -Recurse -Filter siaf-automator.exe | ForEach-Object { Write-Host ('Auxiliar incluido: ' + $_.FullName) }
$sumas = Get-ChildItem dist -File | Where-Object { $_.Extension -in '.exe', '.msi', '.zip' } | ForEach-Object { '{0}  {1}' -f (Get-FileHash $_.FullName -Algorithm SHA256).Hash.ToLower(), $_.Name }
$sumas | Set-Content -Encoding ascii dist\SHA256SUMS.txt
$sumas
Write-Host 'OK Artefactos en dist\'
