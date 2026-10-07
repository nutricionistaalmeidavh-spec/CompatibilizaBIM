param(
  [string]$Python = "python",
  [string]$DotNet = "C:\Program Files\dotnet\dotnet.exe",
  [string]$CoreWheel = ""
)
$ErrorActionPreference = "Stop"
$coreHome = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) "CBIM\Revit\2027\Core"
$venv = Join-Path $coreHome ".venv"
$bridgeHome = Join-Path $coreHome "bridge"
New-Item -ItemType Directory -Force -Path $coreHome,$bridgeHome | Out-Null

if (-not (Test-Path $venv)) {
  & $Python -m venv $venv
}
$venvPython = Join-Path $venv "Scripts\python.exe"
$venvPip = Join-Path $venv "Scripts\pip.exe"

$sdkDist = Join-Path (Split-Path $PSScriptRoot -Parent) "cbim-sdk\python\dist"
$sdkWheel = Get-ChildItem $sdkDist -Filter "cbim_sdk-*.whl" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $sdkWheel) { throw "Wheel local do CBIM SDK não encontrado em $sdkDist." }
& $venvPip install --no-deps --upgrade --force-reinstall $sdkWheel.FullName

if (-not $CoreWheel) {
  $dist = Join-Path (Split-Path $PSScriptRoot -Parent) "compatibilizabim-core\dist"
  $candidate = Get-ChildItem $dist -Filter "compatibilizabim_core-*.whl" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
  if (-not $candidate) {
    $project = Join-Path (Split-Path $PSScriptRoot -Parent) "compatibilizabim-core"
    & $Python -m pip wheel $project --no-deps -w $dist
    $candidate = Get-ChildItem $dist -Filter "compatibilizabim_core-*.whl" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
  }
  if (-not $candidate) { throw "Wheel do CompatibilizaBIM Core não encontrado." }
  $CoreWheel = $candidate.FullName
}
& $venvPip install --upgrade --force-reinstall $CoreWheel

$bridgeProject = Join-Path (Split-Path $PSScriptRoot -Parent) "dwg-acadsharp-bridge\CompatibilizaBIM.ACadSharpBridge.csproj"
if (-not (Test-Path $DotNet)) { $DotNet = (Get-Command dotnet -ErrorAction Stop).Source }
& $DotNet build $bridgeProject -c Release
$bridgeOutput = Join-Path (Split-Path $bridgeProject -Parent) "bin\Release\net8.0"
if (-not (Test-Path (Join-Path $bridgeOutput "CompatibilizaBIM.ACadSharpBridge.exe"))) { throw "Bridge ACadSharp não foi gerado." }
Copy-Item (Join-Path $bridgeOutput "*") $bridgeHome -Recurse -Force
$bridgeExe = Join-Path $bridgeHome "CompatibilizaBIM.ACadSharpBridge.exe"

$cliExe = Join-Path $venv "Scripts\cbim-revit.exe"
if (-not (Test-Path $cliExe)) { throw "cbim-revit.exe não foi instalado no ambiente local." }
$cmd = Join-Path $coreHome "cbim-revit.cmd"
$wrapper = "@echo off`r`nset CBIM_ACADSHARP_BRIDGE=$bridgeExe`r`n`"$cliExe`" %*`r`n"
Set-Content -Path $cmd -Encoding ASCII -Value $wrapper

[Environment]::SetEnvironmentVariable("CBIM_REVIT_CLI", $cmd, "User")
[Environment]::SetEnvironmentVariable("CBIM_ACADSHARP_BRIDGE", $bridgeExe, "User")
$env:CBIM_REVIT_CLI = $cmd
$env:CBIM_ACADSHARP_BRIDGE = $bridgeExe
Write-Host "[CBIM] Core CLI instalado: $cmd"
Write-Host "[CBIM] ACadSharp bridge instalado: $bridgeExe"
Write-Host "[CBIM] Reinicie o Revit se ele já estiver aberto."
