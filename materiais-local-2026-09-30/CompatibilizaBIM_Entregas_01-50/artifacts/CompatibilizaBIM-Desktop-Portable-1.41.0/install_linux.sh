#!/usr/bin/env bash
set -e
python3 -m venv .venv
.venv/bin/python -m pip install --upgrade pip
.venv/bin/python -m pip install --find-links wheels cbim-sdk compatibilizabim-core
echo 'CompatibilizaBIM instalado. Use ./launch_linux.sh <workspace>'
