param([switch]$InstallIfcOpenShell)
$ErrorActionPreference = "Stop"
py -3 -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install --find-links wheels cbim-sdk compatibilizabim-core
if ($InstallIfcOpenShell) {
  Write-Host "Instalando backend opcional IfcOpenShell..."
  .\.venv\Scripts\python.exe -m pip install "ifcopenshell>=0.8.3,<0.9"
}
Write-Host "CompatibilizaBIM 1.41.0 instalado. Use launch_windows.bat <workspace>"
