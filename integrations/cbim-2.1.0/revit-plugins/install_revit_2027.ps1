param(
  [string]$RevitInstallDir = "C:\Program Files\Autodesk\Revit 2027",
  [switch]$SkipBuild,
  [switch]$SkipCore
)
$ErrorActionPreference = "Stop"
if (-not $SkipCore) { & "$PSScriptRoot\install_core_windows.ps1" }
if (-not $SkipBuild) { & "$PSScriptRoot\build_revit_2027.ps1" -RevitInstallDir $RevitInstallDir }
# Per-user manifests are supported by Revit 2027 and do not require elevation.
$addinRoot = Join-Path $env:APPDATA "Autodesk\Revit\Addins\2027"
$cbimRoot = Join-Path $addinRoot "CBIM"
$genericDst = Join-Path $cbimRoot "CBIM.Revit.Plugin"
$hydDst = Join-Path $cbimRoot "CBIM.Hydraulic.Plugin"
$contractDst = Join-Path $cbimRoot "CBIM.Library.Contract"
New-Item -ItemType Directory -Force -Path $genericDst,$hydDst,$contractDst | Out-Null

$genericBin = "$PSScriptRoot\CBIM.Revit.Plugin\bin\Release\net10.0-windows"
$hydBin = "$PSScriptRoot\CBIM.Hydraulic.Plugin\bin\Release\net10.0-windows"
$libraryBin = "$PSScriptRoot\CBIM.Library.Contract\bin\Release\net10.0-windows"
Copy-Item "$genericBin\*.dll" $genericDst -Force
Copy-Item "$hydBin\*.dll" $hydDst -Force
Copy-Item "$libraryBin\*.dll" $contractDst -Force
$genericManifest = (Get-Content "$PSScriptRoot\CBIM.Revit.Plugin\CBIM.Revit.Plugin.addin" -Raw).Replace("__CBIM_PLUGIN_ROOT__", $cbimRoot)
$hydManifest = (Get-Content "$PSScriptRoot\CBIM.Hydraulic.Plugin\CBIM.Hydraulic.Plugin.addin" -Raw).Replace("__CBIM_PLUGIN_ROOT__", $cbimRoot)
Set-Content (Join-Path $addinRoot "CBIM.Revit.Plugin.addin") $genericManifest -Encoding utf8
Set-Content (Join-Path $addinRoot "CBIM.Hydraulic.Plugin.addin") $hydManifest -Encoding utf8

$libraryHome = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) "CBIM\Library"
New-Item -ItemType Directory -Force -Path $libraryHome | Out-Null
if (-not (Test-Path (Join-Path $libraryHome "manifest.json"))) {
  Copy-Item "$PSScriptRoot\library-manifest.example.json" (Join-Path $libraryHome "manifest.example.json") -Force
}
Write-Host "[CBIM] Plugins instalados separadamente em $addinRoot"
Write-Host "[CBIM] CBIM.Revit.Plugin + CBIM.Hydraulic.Plugin usam o contrato CBIM.Library.Contract; a biblioteca master continua separada."
