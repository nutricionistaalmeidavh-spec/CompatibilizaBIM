$ErrorActionPreference = "Stop"
$addinRoot = Join-Path $env:ProgramData "Autodesk\Revit\Addins\2027"
Remove-Item (Join-Path $addinRoot "CBIM.Revit.Plugin.addin") -Force -ErrorAction SilentlyContinue
Remove-Item (Join-Path $addinRoot "CBIM.Hydraulic.Plugin.addin") -Force -ErrorAction SilentlyContinue
Remove-Item (Join-Path $addinRoot "CBIM") -Recurse -Force -ErrorAction SilentlyContinue
Write-Host "[CBIM] Add-ins Revit 2027 removidos. A biblioteca local em AppData não foi apagada."
