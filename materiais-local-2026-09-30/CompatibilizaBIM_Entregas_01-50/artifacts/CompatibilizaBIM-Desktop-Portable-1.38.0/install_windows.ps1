$ErrorActionPreference = "Stop"
py -3 -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install --find-links wheels cbim-sdk compatibilizabim-core
Write-Host "CompatibilizaBIM instalado. Use launch_windows.bat <workspace>"
