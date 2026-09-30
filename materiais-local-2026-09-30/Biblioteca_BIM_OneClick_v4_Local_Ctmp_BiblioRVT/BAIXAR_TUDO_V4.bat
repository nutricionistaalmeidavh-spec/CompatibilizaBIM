@echo off
setlocal
title Biblioteca BIM One-Click V4 - Todas as Fontes
echo.
echo Destino fixo: C:\tmp\BiblioRVT
echo ============================================================
echo    BIBLIOTECA BIM V4 - TODAS AS FONTES
echo ============================================================
echo.
echo Este processo pode baixar varios GB.
echo Nenhum cadastro/login sera solicitado ou burlado.
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0baixar_biblioteca_bim_v4_todas_fontes.ps1"
echo.
echo Consulte RELATORIO_FINAL.txt e RELATORIO_FONTES.csv na biblioteca.
pause
