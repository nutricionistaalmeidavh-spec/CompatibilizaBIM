$ErrorActionPreference = "Stop"
if (-not (Test-Path ".\.venv\Scripts\python.exe")) { throw "Instale primeiro o CompatibilizaBIM com .\install_windows.ps1" }
.\.venv\Scripts\python.exe -m pip install "ifcopenshell>=0.8.3,<0.9"
Write-Host "IfcOpenShell instalado. Use --ifc-backend ifcopenshell para testes A/B."
