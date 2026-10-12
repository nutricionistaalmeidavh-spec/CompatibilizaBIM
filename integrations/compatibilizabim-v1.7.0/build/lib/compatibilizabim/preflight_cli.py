from __future__ import annotations

import argparse
import sys
from pathlib import Path

from .ifc_backend import IfcOpenShellBackend, IfcOpenShellUnavailable
from .preflight import PreflightEngine
from .reporting import write_preflight_json


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="compatibilizabim-preflight",
        description="Analisa metadados e alinhamento de um conjunto de modelos IFC.",
    )
    parser.add_argument("files", nargs="+", type=Path, help="Arquivos IFC da federação")
    parser.add_argument(
        "--alignment-tolerance",
        type=float,
        default=5.0,
        help="Separação máxima entre bounding boxes antes de alertar desalinhamento (m)",
    )
    parser.add_argument(
        "--out",
        type=Path,
        default=Path("preflight.json"),
        help="Arquivo JSON de saída (padrão: ./preflight.json)",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        report = PreflightEngine(IfcOpenShellBackend()).run(
            args.files,
            alignment_tolerance_m=args.alignment_tolerance,
        )
        write_preflight_json(args.out, report)
    except (ValueError, RuntimeError, IfcOpenShellUnavailable) as exc:
        print(f"Erro: {exc}", file=sys.stderr)
        return 2

    print(f"Modelos analisados: {len(report.models)}")
    for model in report.models:
        bbox = "sem geometria"
        if model.bbox is not None:
            bbox = (
                f"bbox {model.bbox.minimum} -> {model.bbox.maximum}"
            )
        print(
            f"- {model.path.name}: {model.discipline}, {model.schema}, "
            f"{model.element_count} elementos, {bbox}"
        )
    print(f"Federação: {'ALINHADA' if report.aligned else 'REVISAR ALINHAMENTO'}")
    for warning in report.warnings:
        print(f"Aviso [{warning.code}]: {warning.message}")
    print(f"Relatório: {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
