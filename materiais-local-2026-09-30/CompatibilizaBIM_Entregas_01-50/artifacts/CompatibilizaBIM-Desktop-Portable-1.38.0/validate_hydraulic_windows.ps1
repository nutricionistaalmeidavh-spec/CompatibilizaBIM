param(
  [Parameter(Mandatory=$true)][string]$Dwg,
  [string]$Output = "cbim-real-dwg-result"
)
$ErrorActionPreference = "Stop"
$bridge = Join-Path $PSScriptRoot "bridge-source\bin\Release\net8.0\CompatibilizaBIM.ACadSharpBridge.exe"
if (-not (Test-Path $bridge)) { throw "Bridge nao compilado. Rode .\build_bridge_windows.ps1 primeiro." }
$cli = Join-Path $PSScriptRoot ".venv\Scripts\cbim-validate-dwg.exe"
& $cli --hydraulic $Dwg --bridge-exe $bridge --output $Output
