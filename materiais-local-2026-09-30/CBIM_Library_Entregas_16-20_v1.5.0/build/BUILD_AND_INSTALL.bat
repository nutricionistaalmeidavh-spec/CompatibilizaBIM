@echo off
setlocal
cd /d "%~dp0.."
powershell -NoProfile -ExecutionPolicy Bypass -File ".\build\BUILD_RELEASE.ps1" -InstallAfterBuild
if errorlevel 1 (
  echo.
  echo BUILD FALHOU. Veja a mensagem acima.
  pause
  exit /b 1
)
echo.
echo CBIM Library v1.5.0 compilado e instalado.
pause
