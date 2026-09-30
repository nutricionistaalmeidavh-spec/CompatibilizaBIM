param(
  [string]$RevitInstallDir = "C:\Program Files\Autodesk\Revit 2027",
  [string]$Configuration = "Release",
  [string]$DotNet = "C:\Program Files\dotnet\dotnet.exe"
)
$ErrorActionPreference = "Stop"
if (-not (Test-Path (Join-Path $RevitInstallDir "RevitAPI.dll"))) { throw "RevitAPI.dll não encontrado em $RevitInstallDir" }
if (-not (Test-Path $DotNet)) { $DotNet = (Get-Command dotnet -ErrorAction Stop).Source }
Write-Host "[CBIM] Building shared contracts..."
& $DotNet build "$PSScriptRoot\CBIM.Revit.Contracts\CBIM.Revit.Contracts.csproj" -c $Configuration
& $DotNet build "$PSScriptRoot\CBIM.Library.Contract\CBIM.Library.Contract.csproj" -c $Configuration
Write-Host "[CBIM] Building Revit 2027 hosts against $RevitInstallDir ..."
& $DotNet build "$PSScriptRoot\CBIM.Revit.Plugin\CBIM.Revit.Plugin.csproj" -c $Configuration -p:RevitInstallDir="$RevitInstallDir"
& $DotNet build "$PSScriptRoot\CBIM.Hydraulic.Plugin\CBIM.Hydraulic.Plugin.csproj" -c $Configuration -p:RevitInstallDir="$RevitInstallDir"
Write-Host "[CBIM] Build concluído. Rode install_revit_2027.ps1 para instalar os add-ins."
