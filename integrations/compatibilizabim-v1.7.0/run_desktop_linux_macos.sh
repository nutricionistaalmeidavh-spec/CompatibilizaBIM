#!/usr/bin/env sh
set -eu
if [ -x .venv/bin/python ]; then
  exec .venv/bin/python -m compatibilizabim.desktop_cli "$@"
fi
exec python3 -m compatibilizabim.desktop_cli "$@"
