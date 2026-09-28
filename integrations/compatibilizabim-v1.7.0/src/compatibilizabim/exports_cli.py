from __future__ import annotations

import argparse
import tempfile
from pathlib import Path
from typing import Sequence

from .exports import ExportService


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="compatibilizabim-export",
        description="Exporta pendencias BIM para BCF 3.0, CSV e PDF.",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    bcf = sub.add_parser("bcf", help="Exportar issue store para arquivo BCF 3.0")
    bcf.add_argument("store", type=Path)
    bcf.add_argument("output", type=Path)
    bcf.add_argument("--author", required=True)

    csv_cmd = sub.add_parser("csv", help="Exportar issue store para CSV")
    csv_cmd.add_argument("store", type=Path)
    csv_cmd.add_argument("output", type=Path)

    pdf = sub.add_parser("pdf", help="Exportar issue store para relatorio PDF")
    pdf.add_argument("store", type=Path)
    pdf.add_argument("output", type=Path)
    pdf.add_argument("--title", default="Relatorio tecnico de compatibilizacao BIM")
    pdf.add_argument("--author", default="CompatibilizaBIM")

    all_cmd = sub.add_parser("all", help="Gerar BCF, CSV e PDF em uma pasta")
    all_cmd.add_argument("store", type=Path)
    all_cmd.add_argument("output_dir", type=Path)
    all_cmd.add_argument("--author", required=True)
    all_cmd.add_argument("--title", default="Relatorio tecnico de compatibilizacao BIM")
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    service = ExportService()

    if args.command == "bcf":
        summary = service.write_bcf(args.store, args.output, author=args.author)
        print(f"{summary.issue_count} issue(s) exportada(s) para {args.output}")
        return 0
    if args.command == "csv":
        summary = service.write_csv(args.store, args.output)
        print(f"{summary.issue_count} issue(s) exportada(s) para {args.output}")
        return 0
    if args.command == "pdf":
        summary = service.write_pdf(args.store, args.output, title=args.title, author=args.author)
        print(f"{summary.issue_count} issue(s) exportada(s) para {args.output}")
        return 0
    if args.command == "all":
        args.output_dir.parent.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(
            prefix=f".{args.output_dir.name}-", dir=args.output_dir.parent
        ) as temp_dir:
            temp = Path(temp_dir)
            temp_bcf = temp / "issues.bcf"
            temp_csv = temp / "issues.csv"
            temp_pdf = temp / "issues.pdf"
            summary = service.write_bcf(args.store, temp_bcf, author=args.author)
            service.write_csv(args.store, temp_csv)
            service.write_pdf(args.store, temp_pdf, title=args.title, author=args.author)
            args.output_dir.mkdir(parents=True, exist_ok=True)
            for source in (temp_bcf, temp_csv, temp_pdf):
                source.replace(args.output_dir / source.name)
        print(f"{summary.issue_count} issue(s) exportada(s) para {args.output_dir}")
        return 0
    raise AssertionError(f"Comando inesperado: {args.command}")


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
