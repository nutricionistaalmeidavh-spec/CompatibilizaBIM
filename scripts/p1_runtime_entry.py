"""Executable entry point for the relocatable Windows CBIM runtime.

Bundled with PyInstaller (no customer credentials/private signing keys included).
Supported commands:
    cbim-runtime.exe health
    cbim-runtime.exe validate-dwg ...
    cbim-runtime.exe studio prepare|verify|serve ...
    cbim-runtime.exe ifc-clash modelA.ifc modelB.ifc ...
    cbim-runtime.exe ifc-viewer model.ifc ... --out view.html
    cbim-runtime.exe ifc-legacy modelA.ifc modelB.ifc ...
"""
from __future__ import annotations

import json
import sys


def main(argv: list[str] | None = None) -> int:
    args = list(argv if argv is not None else sys.argv[1:])
    if not args:
        print("Uso: cbim-runtime.exe health|validate-dwg|studio|ifc-clash|ifc-viewer|ifc-legacy", file=sys.stderr)
        return 2
    command, *options = args
    if command == 'health':
        import pydantic
        import ezdxf
        import shapely
        import ifcopenshell
        from compatibilizabim_core import __version__ as cbim_version
        print(json.dumps({
            'healthy': True,
            'engine': 'CBIM Core',
            'cbim_version': cbim_version,
            'python': sys.version.split()[0],
            'ifcopenshell': getattr(ifcopenshell, 'version', None),
            'pydantic': pydantic.__version__,
            'ezdxf': ezdxf.__version__,
            'shapely': shapely.__version__
        }))
        return 0
    if command == 'validate-dwg':
        from compatibilizabim_core.validation.cli import main as cli
    elif command == 'studio':
        from compatibilizabim_core.desktop.p1_launcher import main as cli
    elif command == 'ifc-clash':
        from compatibilizabim.bridge_cli import main as cli
    elif command == 'ifc-viewer':
        from compatibilizabim.viewer_cli import main as cli
    elif command == 'ifc-legacy':
        from compatibilizabim.cli import main as cli
    else:
        print('Comando de runtime desconhecido: ' + command, file=sys.stderr)
        return 2
    result = cli(options)
    return 0 if result is None else int(result)


if __name__ == '__main__':
    raise SystemExit(main())
