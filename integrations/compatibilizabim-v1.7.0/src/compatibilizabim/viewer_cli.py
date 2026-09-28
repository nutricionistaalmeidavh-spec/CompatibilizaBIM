from __future__ import annotations

import argparse
import sys
from pathlib import Path

from .ifc_backend import IfcOpenShellBackend, IfcOpenShellUnavailable
from .viewer import ViewerEngine, load_rule_clashes
from .viewer_html import write_viewer_html


def _positive_int(value: str) -> int:
    parsed = int(value)
    if parsed <= 0:
        raise argparse.ArgumentTypeError("deve ser maior que zero")
    return parsed


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="compatibilizabim-viewer",
        description="Gera um visualizador WebGL local e autocontido para modelos IFC federados.",
    )
    parser.add_argument("files", nargs="+", type=Path, help="Um ou mais modelos IFC")
    parser.add_argument(
        "--out",
        type=Path,
        default=Path("viewer.html"),
        help="Arquivo HTML de saída (padrão: ./viewer.html)",
    )
    parser.add_argument(
        "--clashes",
        type=Path,
        default=None,
        help="Relatório JSON gerado por compatibilizabim-rules para foco dos clashes",
    )
    parser.add_argument(
        "--max-elements",
        type=_positive_int,
        default=None,
        help="Limita a quantidade de geometrias exportadas por modelo",
    )
    return parser


def _validate_ifc(path: Path) -> None:
    if not path.exists() or not path.is_file():
        raise ValueError(f"Arquivo não encontrado: {path}")
    if path.suffix.lower() != ".ifc":
        raise ValueError(f"Arquivo deve ter extensão .ifc: {path}")


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        for path in args.files:
            _validate_ifc(path)
        clashes = load_rule_clashes(args.clashes) if args.clashes is not None else ()
        session = ViewerEngine(IfcOpenShellBackend()).build(
            args.files, clashes=clashes, max_elements=args.max_elements
        )
        write_viewer_html(args.out, session)
    except (ValueError, IfcOpenShellUnavailable) as exc:
        print(f"Erro: {exc}", file=sys.stderr)
        return 2
    print(f"Viewer gerado: {args.out} ({len(session.elements)} elementos)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
