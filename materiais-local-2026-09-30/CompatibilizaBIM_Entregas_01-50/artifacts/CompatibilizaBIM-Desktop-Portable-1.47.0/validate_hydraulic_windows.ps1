param(
  [Parameter(Mandatory=$true)][string]$Dwg,
  [string]$Output = "cbim-real-dwg-result",
  [Nullable[double]]$ProjectDatumElevationM = $null,
  [ValidateSet("legacy","ifcopenshell","auto")][string]$IfcBackend = "legacy"
)
$ErrorActionPreference = "Stop"
$bridge = Join-Path $PSScriptRoot "bridge-source\bin\Release\net8.0\CompatibilizaBIM.ACadSharpBridge.exe"
if (-not (Test-Path $bridge)) { throw "Bridge nao compilado. Rode .\build_bridge_windows.ps1 primeiro." }
$cli = Join-Path $PSScriptRoot ".venv\Scripts\cbim-validate-dwg.exe"
$args = @('--hydraulic',$Dwg,'--bridge-exe',$bridge,'--output',$Output,'--ifc-backend',$IfcBackend)
if ($null -ne $ProjectDatumElevationM) { $args += @('--project-datum-elevation-m',[string]$ProjectDatumElevationM) }
& $cli @args
