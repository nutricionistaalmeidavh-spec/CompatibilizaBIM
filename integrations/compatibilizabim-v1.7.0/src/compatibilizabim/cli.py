from __future__ import annotations

import argparse
import sys
from pathlib import Path

from .engine import ClashEngine
from .ifc_backend import IfcOpenShellBackend, IfcOpenShellUnavailable
from .models import ClashRequest
from .reporting import write_csv, write_json


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="compatibilizabim",
        description="Compara dois modelos IFC e gera uma lista de conflitos BIM.",
    )
    parser.add_argument("file_a", type=Path, help="Primeiro arquivo IFC")
    parser.add_argument("file_b", type=Path, help="Segundo arquivo IFC")
    parser.add_argument(
        "--class-a", default="IfcElement", help="Classe IFC do grupo A (padrão: IfcElement)"
    )
    parser.add_argument(
        "--class-b", default="IfcElement", help="Classe IFC do grupo B (padrão: IfcElement)"
    )
    parser.add_argument(
        "--mode",
        choices=("intersection", "collision", "clearance"),
        default="intersection",
        help="Tipo de análise geométrica",
    )
    parser.add_argument(
        "--tolerance",
        type=float,
        default=0.002,
        help="Tolerância de interseção em metros (padrão: 0.002 = 2 mm)",
    )
    parser.add_argument(
        "--clearance",
        type=float,
        default=0.05,
        help="Distância mínima em metros para modo clearance (padrão: 0.05 = 50 mm)",
    )
    parser.add_argument(
        "--fast",
        action="store_true",
        help="Para na primeira interseção relevante por par quando suportado",
    )
    parser.add_argument(
        "--out",
        type=Path,
        default=Path("reports"),
        help="Diretório de saída (padrão: ./reports)",
    )
    parser.add_argument(
        "--format",
        choices=("json", "csv", "both"),
        default="both",
        help="Formato do relatório (padrão: both)",
    )
    return parser


def validate_args(args: argparse.Namespace) -> None:
    for path in (args.file_a, args.file_b):
        if not path.exists():
            raise ValueError(f"Arquivo não encontrado: {path}")
        if not path.is_file():
            raise ValueError(f"Caminho não é um arquivo: {path}")
        if path.suffix.lower() != ".ifc":
            raise ValueError(f"Arquivo deve ter extensão .ifc: {path}")
    if args.tolerance < 0:
        raise ValueError("tolerance deve ser maior ou igual a zero")
    if args.clearance < 0:
        raise ValueError("clearance deve ser maior ou igual a zero")


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    try:
        validate_args(args)
        request = ClashRequest(
            file_a=args.file_a,
            file_b=args.file_b,
            class_a=args.class_a,
            class_b=args.class_b,
            mode=args.mode,
            tolerance=args.tolerance,
            clearance=args.clearance,
            check_all=not args.fast,
        )
        results = ClashEngine(IfcOpenShellBackend()).run(request)
    except (ValueError, IfcOpenShellUnavailable, RuntimeError) as exc:
        print(f"Erro: {exc}", file=sys.stderr)
        return 2

    args.out.mkdir(parents=True, exist_ok=True)
    stem = f"{args.file_a.stem}__x__{args.file_b.stem}__{args.mode}"
    summary = {
        "file_a": str(args.file_a.resolve()),
        "file_b": str(args.file_b.resolve()),
        "class_a": args.class_a,
        "class_b": args.class_b,
        "mode": args.mode,
        "tolerance_m": args.tolerance,
        "clearance_m": args.clearance,
        "check_all": not args.fast,
        "count": len(results),
    }

    created: list[Path] = []
    if args.format in ("json", "both"):
        path = args.out / f"{stem}.json"
        write_json(path, summary, results)
        created.append(path)
    if args.format in ("csv", "both"):
        path = args.out / f"{stem}.csv"
        write_csv(path, results)
        created.append(path)

    print(f"Conflitos encontrados: {len(results)}")
    for path in created:
        print(f"Relatório: {path}")
    return 0
