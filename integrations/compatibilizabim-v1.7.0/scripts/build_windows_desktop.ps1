$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

if (-not (Test-Path ".venv")) {
  py -m venv .venv
}
& .\.venv\Scripts\python.exe -m pip install --upgrade pip
& .\.venv\Scripts\python.exe -m pip install . pyinstaller
& .\.venv\Scripts\pyinstaller.exe --clean packaging\compatibilizabim.spec

$iscc = Get-Command ISCC.exe -ErrorAction SilentlyContinue
if ($iscc) {
  & $iscc.Source packaging\CompatibilizaBIM.iss
  Write-Host "Instalador criado em dist\installer"
} else {
  Write-Host "Executável criado em dist\CompatibilizaBIM.exe"
  Write-Host "Inno Setup não encontrado; instale-o para gerar o Setup.exe."
}
