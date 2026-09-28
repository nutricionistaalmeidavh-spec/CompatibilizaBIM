from __future__ import annotations

import argparse
import sys
from pathlib import Path

from .ifc_backend import IfcOpenShellBackend, IfcOpenShellUnavailable
from .reporting import write_rule_report_json
from .rules import RuleEngine, get_preset, preset_names


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="compatibilizabim-rules",
        description="Executa uma matriz de regras de compatibilização entre dois IFCs.",
    )
    parser.add_argument("file_a", type=Path, help="Modelo IFC do lado A")
    parser.add_argument("file_b", type=Path, help="Modelo IFC do lado B")
    parser.add_argument(
        "--preset",
        choices=preset_names(),
        default="mep-structure",
        help="Matriz de regras pronta (padrão: mep-structure)",
    )
    parser.add_argument(
        "--fast",
        action="store_true",
        help="Pede ao backend para reduzir a busca quando suportado",
    )
    parser.add_argument(
        "--out",
        type=Path,
        default=Path("rules-report.json"),
        help="Arquivo JSON de saída (padrão: ./rules-report.json)",
    )
    return parser


def _validate_ifc(path: Path) -> None:
    if not path.exists():
        raise ValueError(f"Arquivo não encontrado: {path}")
    if not path.is_file():
        raise ValueError(f"Caminho não é um arquivo: {path}")
    if path.suffix.lower() != ".ifc":
        raise ValueError(f"Arquivo deve ter extensão .ifc: {path}")


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        _validate_ifc(args.file_a)
        _validate_ifc(args.file_b)
        rules = get_preset(args.preset)
        report = RuleEngine(IfcOpenShellBackend()).run(
            args.file_a,
            args.file_b,
            rules,
            check_all=not args.fast,
        )
        write_rule_report_json(args.out, report, preset=args.preset)
    except (ValueError, RuntimeError, IfcOpenShellUnavailable) as exc:
        print(f"Erro: {exc}", file=sys.stderr)
        return 2

    print(f"Preset: {args.preset}")
    print(f"Regras executadas: {len(report.rules)}")
    print(f"Conflitos brutos: {report.raw_clash_count}")
    print(f"Conflitos únicos: {report.unique_clash_count}")
    print(f"Relatório: {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
