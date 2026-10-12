from __future__ import annotations

import csv
import math
import uuid
import zipfile
from collections import Counter
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable, Iterable
from xml.etree import ElementTree as ET
from xml.sax.saxutils import escape

from .issues import BimIssue, IssueStore


@dataclass(frozen=True, slots=True)
class ExportSummary:
    issue_count: int
    open_count: int
    critical_count: int


class ExportService:
    """Export persisted BIM issues to exchange/report formats."""

    BCF_VERSION = "3.0"

    def __init__(self, clock: Callable[[], datetime] | None = None) -> None:
        self.clock = clock or (lambda: datetime.now(timezone.utc))

    def write_bcf(self, store_path: Path, output: Path, *, author: str) -> ExportSummary:
        author_clean = author.strip()
        if not author_clean:
            raise ValueError("author não pode ser vazio")
        issues = IssueStore(store_path).load()
        output = Path(output)
        output.parent.mkdir(parents=True, exist_ok=True)

        with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            archive.writestr("bcf.version", _xml_bytes(_bcf_version()))
            for issue in issues:
                topic_guid = _stable_guid("topic", issue.issue_id)
                viewpoint_guid = _stable_guid("viewpoint", issue.issue_id)
                viewpoint_name = f"{viewpoint_guid}.bcfv"
                snapshot_name = _snapshot_name(issue, viewpoint_guid)
                markup = _markup_xml(
                    issue,
                    topic_guid=topic_guid,
                    viewpoint_guid=viewpoint_guid,
                    viewpoint_name=viewpoint_name,
                    snapshot_name=snapshot_name,
                    author=author_clean,
                )
                visinfo = _viewpoint_xml(issue, viewpoint_guid=viewpoint_guid)
                archive.writestr(f"{topic_guid}/markup.bcf", _xml_bytes(markup))
                archive.writestr(f"{topic_guid}/{viewpoint_name}", _xml_bytes(visinfo))
                if snapshot_name and issue.screenshot:
                    screenshot = Path(issue.screenshot)
                    if screenshot.is_file():
                        archive.write(screenshot, f"{topic_guid}/{snapshot_name}")

        return _summary(issues)

    def write_csv(self, store_path: Path, output: Path) -> ExportSummary:
        issues = IssueStore(store_path).load()
        output = Path(output)
        output.parent.mkdir(parents=True, exist_ok=True)
        fields = [
            "issue_id", "project_id", "obra_id", "title", "status", "severity",
            "discipline_a", "discipline_b", "file_a", "file_b", "a_global_id",
            "b_global_id", "a_ifc_class", "b_ifc_class", "a_name", "b_name",
            "storey", "assignee", "due_date", "point_x", "point_y", "point_z",
            "depth_m", "depth_mm", "comment_count", "ignored_reason", "created_at", "updated_at",
        ]
        with output.open("w", newline="", encoding="utf-8-sig") as handle:
            writer = csv.DictWriter(handle, fieldnames=fields)
            writer.writeheader()
            for issue in issues:
                writer.writerow(
                    {
                        "issue_id": issue.issue_id,
                        "project_id": issue.project_id,
                        "obra_id": issue.obra_id or "",
                        "title": issue.title,
                        "status": issue.status,
                        "severity": issue.severity,
                        "discipline_a": issue.discipline_a,
                        "discipline_b": issue.discipline_b,
                        "file_a": issue.file_a,
                        "file_b": issue.file_b,
                        "a_global_id": issue.a_global_id,
                        "b_global_id": issue.b_global_id,
                        "a_ifc_class": issue.a_ifc_class,
                        "b_ifc_class": issue.b_ifc_class,
                        "a_name": issue.a_name or "",
                        "b_name": issue.b_name or "",
                        "storey": issue.storey or "",
                        "assignee": issue.assignee or "",
                        "due_date": issue.due_date or "",
                        "point_x": issue.point[0],
                        "point_y": issue.point[1],
                        "point_z": issue.point[2],
                        "depth_m": issue.depth_m,
                        "depth_mm": round(issue.depth_m * 1000.0, 3),
                        "comment_count": len(issue.comments),
                        "ignored_reason": issue.ignored_reason or "",
                        "created_at": issue.created_at,
                        "updated_at": issue.updated_at,
                    }
                )
        return _summary(issues)

    def write_pdf(
        self,
        store_path: Path,
        output: Path,
        *,
        title: str = "Relatorio tecnico de compatibilizacao BIM",
        author: str = "CompatibilizaBIM",
    ) -> ExportSummary:
        try:
            from reportlab.lib import colors
            from reportlab.lib.enums import TA_LEFT
            from reportlab.lib.pagesizes import A4, landscape
            from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
            from reportlab.lib.units import mm
            from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
        except ImportError as exc:  # pragma: no cover - environment dependent
            raise RuntimeError("PDF requer reportlab>=4. Instale a dependência reportlab.") from exc

        issues = IssueStore(store_path).load()
        output = Path(output)
        output.parent.mkdir(parents=True, exist_ok=True)
        summary = _summary(issues)
        statuses = Counter(issue.status for issue in issues)
        severities = Counter(issue.severity for issue in issues)
        projects = sorted({issue.project_id for issue in issues})
        obras = sorted({issue.obra_id for issue in issues if issue.obra_id})

        styles = getSampleStyleSheet()
        body = ParagraphStyle("BodySmall", parent=styles["BodyText"], fontName="Helvetica", fontSize=8, leading=10, alignment=TA_LEFT)
        small = ParagraphStyle("Cell", parent=body, fontSize=6.7, leading=8)
        doc = SimpleDocTemplate(
            str(output), pagesize=landscape(A4), rightMargin=10 * mm, leftMargin=10 * mm,
            topMargin=10 * mm, bottomMargin=10 * mm, title=title, author=author,
        )
        story = [Paragraph(escape(title), styles["Title"])]
        generated = _ensure_aware(self.clock()).astimezone(timezone.utc).isoformat()
        story.append(Paragraph(escape(f"Gerado em {generated} | Projetos: {', '.join(projects) or '-'} | Obras: {', '.join(obras) or '-'}"), body))
        story.append(Spacer(1, 5 * mm))
        summary_data = [
            ["Total", "Abertas", "Em analise", "Resolvidas", "Ignoradas", "Criticas", "Altas", "Medias", "Baixas"],
            [
                len(issues), statuses.get("open", 0), statuses.get("in_review", 0), statuses.get("resolved", 0),
                statuses.get("ignored", 0), severities.get("critical", 0), severities.get("high", 0),
                severities.get("medium", 0), severities.get("low", 0),
            ],
        ]
        summary_table = Table(summary_data, repeatRows=1)
        summary_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#E8EDF2")),
            ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#AAB4BF")),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 7),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
        ]))
        story.extend([summary_table, Spacer(1, 5 * mm), Paragraph("Pendencias", styles["Heading2"])])

        headers = ["ID", "Status", "Sev.", "Pavimento", "Elementos", "Responsavel", "Prazo", "Prof. mm", "Comentarios"]
        rows = [[Paragraph(f"<b>{escape(h)}</b>", small) for h in headers]]
        for issue in issues:
            pair = f"{issue.a_ifc_class} {issue.a_name or issue.a_global_id} x {issue.b_ifc_class} {issue.b_name or issue.b_global_id}"
            rows.append([
                Paragraph(escape(issue.issue_id), small),
                Paragraph(escape(issue.status), small),
                Paragraph(escape(issue.severity), small),
                Paragraph(escape(issue.storey or "-"), small),
                Paragraph(escape(pair), small),
                Paragraph(escape(issue.assignee or "-"), small),
                Paragraph(escape(issue.due_date or "-"), small),
                Paragraph(f"{issue.depth_m * 1000.0:.1f}", small),
                Paragraph(str(len(issue.comments)), small),
            ])
        detail = Table(rows, repeatRows=1, colWidths=[22*mm, 18*mm, 15*mm, 25*mm, 82*mm, 38*mm, 22*mm, 18*mm, 18*mm])
        detail.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#DCE6EF")),
            ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#B7C1CB")),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 3),
            ("RIGHTPADDING", (0, 0), (-1, -1), 3),
            ("TOPPADDING", (0, 0), (-1, -1), 3),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ]))
        story.append(detail)
        doc.build(story)
        return summary


def _summary(issues: Iterable[BimIssue]) -> ExportSummary:
    rows = tuple(issues)
    return ExportSummary(
        issue_count=len(rows),
        open_count=sum(1 for issue in rows if issue.status == "open"),
        critical_count=sum(1 for issue in rows if issue.severity.lower() == "critical"),
    )


def _bcf_version() -> ET.Element:
    return ET.Element("Version", {"VersionId": ExportService.BCF_VERSION})


def _markup_xml(
    issue: BimIssue,
    *,
    topic_guid: str,
    viewpoint_guid: str,
    viewpoint_name: str,
    snapshot_name: str | None,
    author: str,
) -> ET.Element:
    root = ET.Element("Markup")
    header = ET.SubElement(root, "Header")
    files = ET.SubElement(header, "Files")
    for filename in dict.fromkeys([issue.file_a, issue.file_b]):
        if not filename:
            continue
        file_el = ET.SubElement(files, "File", {"IsExternal": "true"})
        ET.SubElement(file_el, "Filename").text = Path(filename).name

    topic = ET.SubElement(
        root,
        "Topic",
        {
            "Guid": topic_guid,
            "ServerAssignedId": issue.issue_id,
            "TopicType": "Clash",
            "TopicStatus": _bcf_status(issue.status),
        },
    )
    ET.SubElement(topic, "Title").text = issue.title
    ET.SubElement(topic, "Priority").text = issue.severity
    labels = ET.SubElement(topic, "Labels")
    for label in dict.fromkeys([issue.discipline_a, issue.discipline_b, issue.source_rule_name]):
        if label:
            ET.SubElement(labels, "Label").text = label
    ET.SubElement(topic, "CreationDate").text = _xml_datetime(issue.created_at)
    ET.SubElement(topic, "CreationAuthor").text = author
    ET.SubElement(topic, "ModifiedDate").text = _xml_datetime(issue.updated_at or issue.created_at)
    ET.SubElement(topic, "ModifiedAuthor").text = author
    if issue.due_date:
        ET.SubElement(topic, "DueDate").text = _xml_datetime(issue.due_date)
    if issue.assignee:
        ET.SubElement(topic, "AssignedTo").text = issue.assignee
    description = (
        f"Regra: {issue.source_rule_name}. Pavimento: {issue.storey or '-'}. "
        f"Profundidade: {issue.depth_m * 1000.0:.1f} mm. "
        f"Elementos: {issue.a_ifc_class} {issue.a_name or issue.a_global_id} x "
        f"{issue.b_ifc_class} {issue.b_name or issue.b_global_id}."
    )
    if issue.ignored_reason:
        description += f" Motivo de ignorar: {issue.ignored_reason}."
    ET.SubElement(topic, "Description").text = description

    if issue.comments:
        comments = ET.SubElement(topic, "Comments")
        for comment in issue.comments:
            comment_guid = _stable_guid("comment", issue.issue_id, comment.comment_id)
            node = ET.SubElement(comments, "Comment", {"Guid": comment_guid})
            ET.SubElement(node, "Date").text = _xml_datetime(comment.created_at)
            ET.SubElement(node, "Author").text = comment.author
            ET.SubElement(node, "Comment").text = comment.text

    viewpoints = ET.SubElement(topic, "Viewpoints")
    vp = ET.SubElement(viewpoints, "ViewPoint", {"Guid": viewpoint_guid})
    ET.SubElement(vp, "Viewpoint").text = viewpoint_name
    if snapshot_name:
        ET.SubElement(vp, "Snapshot").text = snapshot_name
    ET.SubElement(vp, "Index").text = "0"
    return root


def _viewpoint_xml(issue: BimIssue, *, viewpoint_guid: str) -> ET.Element:
    root = ET.Element("VisualizationInfo", {"Guid": viewpoint_guid})
    guids = [guid for guid in (issue.a_global_id, issue.b_global_id) if _valid_ifc_guid(guid)]
    if guids:
        components = ET.SubElement(root, "Components")
        selection = ET.SubElement(components, "Selection")
        for guid in guids:
            ET.SubElement(selection, "Component", {"IfcGuid": guid})

    camera_point, direction, up = _camera(issue)
    perspective = ET.SubElement(root, "PerspectiveCamera")
    _point_xml(ET.SubElement(perspective, "CameraViewPoint"), camera_point)
    _point_xml(ET.SubElement(perspective, "CameraDirection"), direction)
    _point_xml(ET.SubElement(perspective, "CameraUpVector"), up)
    ET.SubElement(perspective, "FieldOfView").text = "45"
    ET.SubElement(perspective, "AspectRatio").text = str(16.0 / 9.0)
    return root


def _camera(issue: BimIssue) -> tuple[tuple[float, float, float], tuple[float, float, float], tuple[float, float, float]]:
    vp = issue.viewpoint or {}
    target_local = _vec3(vp.get("target"), issue.point)
    origin = _vec3(vp.get("origin"), (0.0, 0.0, 0.0))
    target = tuple(origin[i] + target_local[i] for i in range(3))
    try:
        yaw = float(vp.get("yaw", 0.8))
        pitch = float(vp.get("pitch", 0.45))
        distance = max(0.1, float(vp.get("distance", 10.0)))
    except (TypeError, ValueError):
        yaw, pitch, distance = 0.8, 0.45, 10.0
    cp = math.cos(pitch)
    eye = (
        target[0] + distance * cp * math.cos(yaw),
        target[1] + distance * cp * math.sin(yaw),
        target[2] + distance * math.sin(pitch),
    )
    direction = _normalize(tuple(target[i] - eye[i] for i in range(3)))
    world_up = (0.0, 0.0, 1.0)
    right = _cross(direction, world_up)
    if _length(right) < 1e-8:
        right = (1.0, 0.0, 0.0)
    right = _normalize(right)
    up = _normalize(_cross(right, direction))
    return eye, direction, up


def _point_xml(node: ET.Element, value: tuple[float, float, float]) -> None:
    ET.SubElement(node, "X").text = _float_text(value[0])
    ET.SubElement(node, "Y").text = _float_text(value[1])
    ET.SubElement(node, "Z").text = _float_text(value[2])


def _float_text(value: float) -> str:
    return format(float(value), ".12g")


def _vec3(value: object, fallback: tuple[float, float, float]) -> tuple[float, float, float]:
    if isinstance(value, (list, tuple)) and len(value) == 3:
        try:
            return tuple(float(v) for v in value)  # type: ignore[return-value]
        except (TypeError, ValueError):
            pass
    return fallback


def _normalize(value: tuple[float, float, float]) -> tuple[float, float, float]:
    length = _length(value) or 1.0
    return tuple(component / length for component in value)  # type: ignore[return-value]


def _length(value: tuple[float, float, float]) -> float:
    return math.sqrt(sum(component * component for component in value))


def _cross(a: tuple[float, float, float], b: tuple[float, float, float]) -> tuple[float, float, float]:
    return (
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
    )


def _valid_ifc_guid(value: str) -> bool:
    return len(value) == 22 and all(ch.isalnum() or ch in "_$" for ch in value)


def _stable_guid(*parts: str) -> str:
    return str(uuid.uuid5(uuid.NAMESPACE_URL, "compatibilizabim:" + "|".join(parts)))


def _bcf_status(status: str) -> str:
    return {"open": "Open", "in_review": "InReview", "resolved": "Closed", "ignored": "Closed"}.get(status, status)


def _xml_datetime(value: str) -> str:
    text = str(value).strip()
    if not text:
        return datetime.now(timezone.utc).isoformat()
    if len(text) == 10:
        return text + "T23:59:59+00:00"
    if text.endswith("Z"):
        return text
    try:
        parsed = datetime.fromisoformat(text)
    except ValueError:
        return text
    return _ensure_aware(parsed).isoformat()


def _ensure_aware(value: datetime) -> datetime:
    return value if value.tzinfo is not None else value.replace(tzinfo=timezone.utc)


def _snapshot_name(issue: BimIssue, viewpoint_guid: str) -> str | None:
    if not issue.screenshot:
        return None
    suffix = Path(issue.screenshot).suffix.lower()
    if suffix not in {".png", ".jpg", ".jpeg"}:
        return None
    suffix = ".jpg" if suffix == ".jpeg" else suffix
    if not Path(issue.screenshot).is_file():
        return None
    return f"{viewpoint_guid}{suffix}"


def _xml_bytes(root: ET.Element) -> bytes:
    ET.indent(root, space="  ")
    return ET.tostring(root, encoding="utf-8", xml_declaration=True)
