from __future__ import annotations

import argparse
import sys
from pathlib import Path

from .revisions import RevisionService, RevisionStore, write_comparison_json


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="compatibilizabim-revisions",
        description="Armazena snapshots de clashes e compara revisões BIM.",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    add = sub.add_parser("add", help="Adiciona um rules-report como revisão")
    add.add_argument("report", type=Path)
    add.add_argument("--revision", required=True)
    add.add_argument("--label", default=None)
    add.add_argument("--store", type=Path, default=Path("revisions.json"))

    compare = sub.add_parser("compare", help="Compara duas revisões")
    compare.add_argument("base")
    compare.add_argument("current")
    compare.add_argument("--store", type=Path, default=Path("revisions.json"))
    compare.add_argument("--out", type=Path, default=Path("revision-comparison.json"))

    ls = sub.add_parser("list", help="Lista revisões armazenadas")
    ls.add_argument("--store", type=Path, default=Path("revisions.json"))
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    service = RevisionService()
    try:
        if args.command == "add":
            snapshot = service.add_report(
                args.report,
                args.store,
                revision_id=args.revision,
                label=args.label,
            )
            print(f"Revisão adicionada: {snapshot.revision_id} ({len(snapshot.clashes)} clashes)")
            return 0

        if args.command == "compare":
            result = service.compare(args.store, args.base, args.current)
            write_comparison_json(args.out, result)
            print(
                f"Comparação {result.base_revision} -> {result.current_revision}: "
                f"{result.new_count} novo(s), {result.persistent_count} persistente(s), "
                f"{result.resolved_count} resolvido(s)"
            )
            print(f"Relatório: {args.out}")
            return 0

        if args.command == "list":
            snapshots = RevisionStore(args.store).load()
            for snapshot in snapshots:
                label = snapshot.label or ""
                print(f"{snapshot.revision_id}\t{len(snapshot.clashes)}\t{snapshot.created_at}\t{label}")
            print(f"Total: {len(snapshots)}")
            return 0

        raise ValueError(f"Comando desconhecido: {args.command}")
    except (ValueError, KeyError, OSError, RuntimeError) as exc:
        print(f"Erro: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
