@echo off
setlocal
if not exist .venv (
  py -m venv .venv
)
call .venv\Scripts\activate.bat
py -m pip install --upgrade pip
pip install -e .
compatibilizabim --help
endlocal
