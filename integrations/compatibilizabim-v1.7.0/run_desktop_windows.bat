@echo off
setlocal
if exist .venv\Scripts\python.exe (
  .venv\Scripts\python.exe -m compatibilizabim.desktop_cli %*
) else (
  py -m compatibilizabim.desktop_cli %*
)
endlocal
