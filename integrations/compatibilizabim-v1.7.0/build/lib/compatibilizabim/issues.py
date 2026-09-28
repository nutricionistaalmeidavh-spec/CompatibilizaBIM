from __future__ import annotations

import hashlib
import json
from dataclasses import asdict, dataclass, replace
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any, Callable, Literal

from .preflight import infer_discipline

IssueStatus = Literal["open", "in_review", "resolved", "ignored"]
_ALLOWED_STATUSES: set[str] = {"open", "in_review", "resolved", "ignored"}


@dataclass(frozen=True, slots=True)
class IssueComment:
    comment_id: str
    author: str
    text: str
    created_at: str


@dataclass(frozen=True, slots=True)
class BimIssue:
    issue_id: str
    source_key: str
    project_id: str
    obra_id: str | None
    title: str
    source_rule_id: str
    source_rule_name: str
    severity: str
    status: IssueStatus
    discipline_a: str
    discipline_b: str
    file_a: str
    file_b: str
    a_global_id: str
    b_global_id: str
    a_ifc_class: str
    b_ifc_class: str
    a_name: str | None
    b_name: str | None
    point: tuple[float, float, float]
    depth_m: float
    storey: str | None
    assignee: str | None
    due_date: str | None
    ignored_reason: str | None
    viewpoint: dict[str, Any] | None
    screenshot: str | None
    comments: tuple[IssueComment, ...]
    created_at: str
    updated_at: str


@dataclass(frozen=True, slots=True)
class ImportSummary:
    created: int
    existing: int


class IssueStore:
    SCHEMA_VERSION = 1

    def __init__(self, path: Path) -> None:
        self.path = Path(path)

    def load(self) -> tuple[BimIssue, ...]:
        if not self.path.exists():
            return ()
        payload = json.loads(self.path.read_text(encoding="utf-8"))
        if payload.get("schema_version") != self.SCHEMA_VERSION:
            raise ValueError(
                f"Versão de issue store não suportada: {payload.get('schema_version')}"
            )
        rows = payload.get("issues")
        if not isinstance(rows, list):
            raise ValueError(f"Issue store inválido: {self.path}")
        return tuple(_issue_from_json(row) for row in rows)

    def get(self, issue_id: str) -> BimIssue:
        for issue in self.load():
            if issue.issue_id == issue_id:
                return issue
        raise KeyError(f"Issue não encontrada: {issue_id}")

    def save(self, issues: tuple[BimIssue, ...] | list[BimIssue]) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "schema_version": self.SCHEMA_VERSION,
            "issues": [_issue_to_json(issue) for issue in issues],
        }
        temp = self.path.with_name(f".{self.path.name}.tmp")
        temp.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        temp.replace(self.path)


class IssueService:
    def __init__(self, clock: Callable[[], datetime] | None = None) -> None:
        self.clock = clock or (lambda: datetime.now(timezone.utc))

    def import_rule_report(
        self,
        report_path: Path,
        store_path: Path,
        *,
        project_id: str,
        obra_id: str | None = None,
    ) -> ImportSummary:
        if not project_id.strip():
            raise ValueError("project_id não pode ser vazio")
        payload = json.loads(Path(report_path).read_text(encoding="utf-8"))
        rows = payload.get("clashes")
        if not isinstance(rows, list):
            raise ValueError(f"Relatório de regras inválido: {report_path}")

        file_a = str(payload.get("file_a") or "")
        file_b = str(payload.get("file_b") or "")
        discipline_a = infer_discipline(Path(file_a or "A.ifc"), {})
        discipline_b = infer_discipline(Path(file_b or "B.ifc"), {})

        store = IssueStore(store_path)
        issues = list(store.load())
        existing_keys = {issue.source_key for issue in issues}
        created = 0
        existing = 0
        now = self._now()

        for row in rows:
            if not isinstance(row, dict):
                raise ValueError(f"Clash inválido em {report_path}")
            source_key = _source_key(project_id, row)
            if source_key in existing_keys:
                existing += 1
                continue

            point = _point3(row.get("point"))
            rule_id = str(row.get("rule_id") or "unknown-rule")
            rule_name = str(row.get("rule_name") or "Clash BIM")
            a_class = str(row.get("a_ifc_class") or "")
            b_class = str(row.get("b_ifc_class") or "")
            a_name = _optional_text(row.get("a_name"))
            b_name = _optional_text(row.get("b_name"))
            issue_id = f"CBIM-{source_key[:10].upper()}"
            title_a = a_name or a_class or "Elemento A"
            title_b = b_name or b_class or "Elemento B"
            issues.append(
                BimIssue(
                    issue_id=issue_id,
                    source_key=source_key,
                    project_id=project_id.strip(),
                    obra_id=_optional_text(obra_id),
                    title=f"{rule_name}: {title_a} × {title_b}",
                    source_rule_id=rule_id,
                    source_rule_name=rule_name,
                    severity=str(row.get("severity") or "high"),
                    status="open",
                    discipline_a=discipline_a,
                    discipline_b=discipline_b,
                    file_a=file_a,
                    file_b=file_b,
                    a_global_id=str(row.get("a_global_id") or ""),
                    b_global_id=str(row.get("b_global_id") or ""),
                    a_ifc_class=a_class,
                    b_ifc_class=b_class,
                    a_name=a_name,
                    b_name=b_name,
                    point=point,
                    depth_m=float(row.get("depth_m") or 0.0),
                    storey=None,
                    assignee=None,
                    due_date=None,
                    ignored_reason=None,
                    viewpoint=None,
                    screenshot=None,
                    comments=(),
                    created_at=now,
                    updated_at=now,
                )
            )
            existing_keys.add(source_key)
            created += 1

        store.save(issues)
        return ImportSummary(created=created, existing=existing)

    def update_issue(
        self,
        store_path: Path,
        issue_id: str,
        *,
        status: str | None = None,
        assignee: str | None = None,
        due_date: str | None = None,
        storey: str | None = None,
        ignored_reason: str | None = None,
        viewpoint_path: Path | None = None,
        screenshot: str | None = None,
    ) -> BimIssue:
        store = IssueStore(store_path)
        issues = list(store.load())
        index = _find_index(issues, issue_id)
        issue = issues[index]

        next_status: IssueStatus = issue.status
        next_ignored_reason = issue.ignored_reason
        if status is not None:
            if status not in _ALLOWED_STATUSES:
                raise ValueError(
                    f"Status inválido: {status}. Use: {', '.join(sorted(_ALLOWED_STATUSES))}"
                )
            next_status = status  # type: ignore[assignment]
            if next_status != "ignored":
                next_ignored_reason = None
        if ignored_reason is not None:
            next_ignored_reason = _optional_text(ignored_reason)
        if next_status == "ignored" and not next_ignored_reason:
            raise ValueError("Informe o motivo para ignorar a pendência")

        next_due = issue.due_date
        if due_date is not None:
            date.fromisoformat(due_date)
            next_due = due_date

        viewpoint = issue.viewpoint
        if viewpoint_path is not None:
            loaded = json.loads(Path(viewpoint_path).read_text(encoding="utf-8"))
            if not isinstance(loaded, dict):
                raise ValueError("Viewpoint deve ser um objeto JSON")
            viewpoint = loaded

        updated = replace(
            issue,
            status=next_status,
            assignee=_optional_text(assignee) if assignee is not None else issue.assignee,
            due_date=next_due,
            storey=_optional_text(storey) if storey is not None else issue.storey,
            ignored_reason=next_ignored_reason,
            viewpoint=viewpoint,
            screenshot=_optional_text(screenshot) if screenshot is not None else issue.screenshot,
            updated_at=self._now(),
        )
        issues[index] = updated
        store.save(issues)
        return updated

    def add_comment(
        self,
        store_path: Path,
        issue_id: str,
        *,
        author: str,
        text: str,
    ) -> BimIssue:
        author_clean = author.strip()
        text_clean = text.strip()
        if not author_clean or not text_clean:
            raise ValueError("Autor e comentário não podem ser vazios")

        store = IssueStore(store_path)
        issues = list(store.load())
        index = _find_index(issues, issue_id)
        issue = issues[index]
        now = self._now()
        seed = f"{issue_id}|{len(issue.comments)}|{now}|{author_clean}|{text_clean}"
        comment_id = "CMT-" + hashlib.sha256(seed.encode("utf-8")).hexdigest()[:10].upper()
        comment = IssueComment(comment_id, author_clean, text_clean, now)
        updated = replace(
            issue,
            comments=issue.comments + (comment,),
            updated_at=now,
        )
        issues[index] = updated
        store.save(issues)
        return updated

    def _now(self) -> str:
        value = self.clock()
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value.isoformat()


def _source_key(project_id: str, row: dict[str, Any]) -> str:
    a = str(row.get("a_global_id") or "")
    b = str(row.get("b_global_id") or "")
    if a and b:
        pair = "|".join(sorted((a, b)))
    else:
        point = _point3(row.get("point"))
        pair = "|".join(
            [
                str(row.get("a_ifc_class") or ""),
                str(row.get("b_ifc_class") or ""),
                *(f"{value:.4f}" for value in point),
            ]
        )
    seed = f"{project_id.strip()}|{row.get('rule_id') or ''}|{pair}"
    return hashlib.sha256(seed.encode("utf-8")).hexdigest()


def _point3(value: Any) -> tuple[float, float, float]:
    raw = value or (0.0, 0.0, 0.0)
    point = tuple(float(item) for item in raw)
    if len(point) != 3:
        raise ValueError("Ponto de clash deve conter 3 coordenadas")
    return point  # type: ignore[return-value]


def _optional_text(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _find_index(issues: list[BimIssue], issue_id: str) -> int:
    for index, issue in enumerate(issues):
        if issue.issue_id == issue_id:
            return index
    raise KeyError(f"Issue não encontrada: {issue_id}")


def _issue_to_json(issue: BimIssue) -> dict[str, Any]:
    data = asdict(issue)
    data["point"] = list(issue.point)
    data["comments"] = [asdict(comment) for comment in issue.comments]
    return data


def _issue_from_json(row: dict[str, Any]) -> BimIssue:
    comments = tuple(IssueComment(**comment) for comment in row.get("comments", []))
    return BimIssue(
        issue_id=str(row["issue_id"]),
        source_key=str(row["source_key"]),
        project_id=str(row["project_id"]),
        obra_id=_optional_text(row.get("obra_id")),
        title=str(row.get("title") or "Pendência BIM"),
        source_rule_id=str(row.get("source_rule_id") or ""),
        source_rule_name=str(row.get("source_rule_name") or ""),
        severity=str(row.get("severity") or "high"),
        status=str(row.get("status") or "open"),  # type: ignore[arg-type]
        discipline_a=str(row.get("discipline_a") or "Unknown"),
        discipline_b=str(row.get("discipline_b") or "Unknown"),
        file_a=str(row.get("file_a") or ""),
        file_b=str(row.get("file_b") or ""),
        a_global_id=str(row.get("a_global_id") or ""),
        b_global_id=str(row.get("b_global_id") or ""),
        a_ifc_class=str(row.get("a_ifc_class") or ""),
        b_ifc_class=str(row.get("b_ifc_class") or ""),
        a_name=_optional_text(row.get("a_name")),
        b_name=_optional_text(row.get("b_name")),
        point=_point3(row.get("point")),
        depth_m=float(row.get("depth_m") or 0.0),
        storey=_optional_text(row.get("storey")),
        assignee=_optional_text(row.get("assignee")),
        due_date=_optional_text(row.get("due_date")),
        ignored_reason=_optional_text(row.get("ignored_reason")),
        viewpoint=row.get("viewpoint") if isinstance(row.get("viewpoint"), dict) else None,
        screenshot=_optional_text(row.get("screenshot")),
        comments=comments,
        created_at=str(row.get("created_at") or ""),
        updated_at=str(row.get("updated_at") or ""),
    )
