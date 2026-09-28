from __future__ import annotations

import argparse
import sys
from pathlib import Path

from .issues import IssueService, IssueStore


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="compatibilizabim-issues",
        description="Gerencia pendências BIM derivadas dos clashes.",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    imp = sub.add_parser("import", help="Importa clashes de um rules-report.json")
    imp.add_argument("report", type=Path)
    imp.add_argument("--project", required=True)
    imp.add_argument("--obra-id", default=None)
    imp.add_argument("--store", type=Path, default=Path("issues.json"))

    ls = sub.add_parser("list", help="Lista pendências")
    ls.add_argument("--store", type=Path, default=Path("issues.json"))
    ls.add_argument("--status", choices=("open", "in_review", "resolved", "ignored"), default=None)

    upd = sub.add_parser("update", help="Atualiza uma pendência")
    upd.add_argument("issue_id")
    upd.add_argument("--store", type=Path, default=Path("issues.json"))
    upd.add_argument("--status", choices=("open", "in_review", "resolved", "ignored"))
    upd.add_argument("--assignee")
    upd.add_argument("--due-date")
    upd.add_argument("--storey")
    upd.add_argument("--ignored-reason")
    upd.add_argument("--viewpoint", type=Path)
    upd.add_argument("--screenshot")

    comment = sub.add_parser("comment", help="Adiciona comentário a uma pendência")
    comment.add_argument("issue_id")
    comment.add_argument("--store", type=Path, default=Path("issues.json"))
    comment.add_argument("--author", required=True)
    comment.add_argument("--text", required=True)
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    service = IssueService()
    try:
        if args.command == "import":
            result = service.import_rule_report(
                args.report,
                args.store,
                project_id=args.project,
                obra_id=args.obra_id,
            )
            print(f"Importação concluída: {result.created} criada(s), {result.existing} existente(s)")
            return 0

        if args.command == "list":
            issues = IssueStore(args.store).load()
            if args.status:
                issues = tuple(issue for issue in issues if issue.status == args.status)
            for issue in issues:
                assignee = issue.assignee or "sem responsável"
                print(f"{issue.issue_id}\t{issue.status}\t{issue.severity}\t{assignee}\t{issue.title}")
            print(f"Total: {len(issues)}")
            return 0

        if args.command == "update":
            if not any(
                value is not None
                for value in (
                    args.status,
                    args.assignee,
                    args.due_date,
                    args.storey,
                    args.ignored_reason,
                    args.viewpoint,
                    args.screenshot,
                )
            ):
                raise ValueError("Informe pelo menos um campo para atualizar")
            issue = service.update_issue(
                args.store,
                args.issue_id,
                status=args.status,
                assignee=args.assignee,
                due_date=args.due_date,
                storey=args.storey,
                ignored_reason=args.ignored_reason,
                viewpoint_path=args.viewpoint,
                screenshot=args.screenshot,
            )
            print(f"Atualizada: {issue.issue_id} [{issue.status}]")
            return 0

        if args.command == "comment":
            issue = service.add_comment(
                args.store,
                args.issue_id,
                author=args.author,
                text=args.text,
            )
            print(f"Comentário adicionado: {issue.issue_id} ({len(issue.comments)} comentário(s))")
            return 0

        raise ValueError(f"Comando desconhecido: {args.command}")
    except (ValueError, KeyError, OSError, RuntimeError) as exc:
        print(f"Erro: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
