from __future__ import annotations

import csv
import json
from dataclasses import asdict, dataclass, replace
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Sequence


@dataclass(frozen=True, slots=True)
class CostComponent:
    code: str
    description: str
    category: str
    unit: str
    coefficient: float
    unit_cost: float

    @property
    def contribution(self) -> float:
        return self.coefficient * self.unit_cost


@dataclass(frozen=True, slots=True)
class Composition:
    code: str
    description: str
    unit: str
    components: tuple[CostComponent, ...]
    waste_percent: float = 0.0

    @property
    def base_unit_cost(self) -> float:
        return sum(item.contribution for item in self.components)

    @property
    def unit_cost_with_waste(self) -> float:
        return self.base_unit_cost * (1.0 + self.waste_percent / 100.0)


@dataclass(frozen=True, slots=True)
class CostMapping:
    composition_code: str
    ifc_class: str
    quantity_kind: str
    type_contains: str | None = None
    quantity_name_contains: str | None = None
    material_contains: str | None = None
    allow_geometry_fallback: bool = False


@dataclass(frozen=True, slots=True)
class PriceBook:
    currency: str
    bdi_percent: float
    source: str | None
    reference_date: str | None
    compositions: tuple[Composition, ...]
    mappings: tuple[CostMapping, ...]
    provenance: dict[str, Any] | None = None


@dataclass(frozen=True, slots=True)
class BudgetLine:
    line_id: str
    composition_code: str
    description: str
    discipline: str
    storey: str | None
    ifc_class: str
    type_name: str | None
    quantity_name: str
    quantity: float
    unit: str
    element_count: int
    base_unit_cost: float
    waste_percent: float
    bdi_percent: float
    final_unit_cost: float
    total_cost: float
    abc_class: str


class PriceBookStore:
    SCHEMA_VERSION = 1

    def __init__(self, path: Path) -> None:
        self.path = Path(path)

    def load(self) -> PriceBook:
        if not self.path.exists():
            return PriceBook("BRL", 0.0, None, None, (), ())
        payload = json.loads(self.path.read_text(encoding="utf-8"))
        if payload.get("schema_version") != self.SCHEMA_VERSION:
            raise ValueError("Versão de catálogo de custos não suportada")
        return pricebook_from_json(payload)

    def save(self, book: PriceBook) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        payload = pricebook_to_json(book)
        tmp = self.path.with_name(f".{self.path.name}.tmp")
        tmp.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        tmp.replace(self.path)


class BudgetEngine:
    def calculate(self, quantity_report: dict[str, Any], pricebook: PriceBook) -> dict[str, Any]:
        groups = quantity_report.get("groups")
        if not isinstance(groups, list):
            raise ValueError("Relatório de quantitativos inválido")
        compositions = {item.code: item for item in pricebook.compositions}
        lines: list[BudgetLine] = []
        unmatched: list[dict[str, Any]] = []

        ambiguous_buckets: dict[tuple, set[str]] = {}
        for raw in groups:
            if isinstance(raw, dict):
                bucket = (raw.get("discipline"), raw.get("storey"), raw.get("ifc_class"), raw.get("type_name"), raw.get("kind"), raw.get("source"))
                ambiguous_buckets.setdefault(bucket, set()).add(str(raw.get("quantity_name") or ""))

        for index, row in enumerate(groups, 1):
            if not isinstance(row, dict):
                continue
            mapping = _best_mapping(row, pricebook.mappings)
            if mapping is None:
                unmatched.append(dict(row)); continue
            bucket = (row.get("discipline"), row.get("storey"), row.get("ifc_class"), row.get("type_name"), row.get("kind"), row.get("source"))
            if not mapping.quantity_name_contains and len(ambiguous_buckets.get(bucket, ())) > 1:
                unmatched.append({**row, "reason": "quantidade ambígua; especifique quantity_name_contains"}); continue
            composition = compositions.get(mapping.composition_code)
            if composition is None:
                raise ValueError(f"Composição não encontrada: {mapping.composition_code}")
            if str(row.get("unit") or "") != composition.unit:
                unmatched.append({**row, "reason": f"unidade {row.get('unit')} ≠ {composition.unit}"}); continue
            quantity = float(row.get("value") or 0.0)
            base = composition.base_unit_cost
            after_waste = composition.unit_cost_with_waste
            final_unit = after_waste * (1.0 + pricebook.bdi_percent / 100.0)
            total = quantity * final_unit
            lines.append(BudgetLine(
                line_id=f"BUD-{index:05d}", composition_code=composition.code,
                description=composition.description, discipline=str(row.get("discipline") or "Unknown"),
                storey=_text(row.get("storey")), ifc_class=str(row.get("ifc_class") or ""),
                type_name=_text(row.get("type_name")), quantity_name=str(row.get("quantity_name") or row.get("kind") or ""),
                quantity=quantity, unit=composition.unit, element_count=int(row.get("element_count") or 0),
                base_unit_cost=base, waste_percent=composition.waste_percent, bdi_percent=pricebook.bdi_percent,
                final_unit_cost=final_unit, total_cost=total, abc_class="",
            ))
        lines = _assign_abc(lines)
        total_cost = sum(line.total_cost for line in lines)
        summary: dict[str, dict[str, Any]] = {}
        for line in lines:
            item = summary.setdefault(line.composition_code, {"composition_code": line.composition_code, "description": line.description, "unit": line.unit, "quantity": 0.0, "total_cost": 0.0})
            item["quantity"] += line.quantity
            item["total_cost"] += line.total_cost
        return {
            "schema_version": 1,
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "currency": pricebook.currency,
            "source": pricebook.source,
            "reference_date": pricebook.reference_date,
            "cost_provenance": dict(pricebook.provenance or {}),
            "bdi_percent": pricebook.bdi_percent,
            "total_cost": total_cost,
            "matched_group_count": len(lines),
            "unmatched_group_count": len(unmatched),
            "lines": [asdict(line) for line in lines],
            "summary_by_composition": list(summary.values()),
            "unmatched": unmatched,
            "compositions": [composition_to_json(c) for c in pricebook.compositions],
        }


def pricebook_from_json(payload: dict[str, Any]) -> PriceBook:
    compositions = []
    for row in payload.get("compositions", []) or []:
        components = tuple(CostComponent(
            code=str(c.get("code") or ""), description=str(c.get("description") or ""),
            category=str(c.get("category") or "other"), unit=str(c.get("unit") or "un"),
            coefficient=float(c.get("coefficient") or 0.0), unit_cost=float(c.get("unit_cost") or 0.0),
        ) for c in row.get("components", []) or [])
        compositions.append(Composition(
            code=str(row.get("code") or ""), description=str(row.get("description") or ""),
            unit=str(row.get("unit") or "un"), components=components,
            waste_percent=float(row.get("waste_percent") or 0.0),
        ))
    mappings = tuple(CostMapping(
        composition_code=str(row.get("composition_code") or ""), ifc_class=str(row.get("ifc_class") or "*"),
        quantity_kind=str(row.get("quantity_kind") or ""), type_contains=_text(row.get("type_contains")),
        quantity_name_contains=_text(row.get("quantity_name_contains")), material_contains=_text(row.get("material_contains")),
        allow_geometry_fallback=bool(row.get("allow_geometry_fallback", False)),
    ) for row in payload.get("mappings", []) or [])
    return PriceBook(
        currency=str(payload.get("currency") or "BRL"), bdi_percent=float(payload.get("bdi_percent") or 0.0),
        source=_text(payload.get("source")), reference_date=_text(payload.get("reference_date")),
        compositions=tuple(compositions), mappings=mappings,
        provenance=dict(payload.get("provenance") or {}) or None,
    )


def pricebook_to_json(book: PriceBook) -> dict[str, Any]:
    return {
        "schema_version": 1, "currency": book.currency, "bdi_percent": book.bdi_percent,
        "source": book.source, "reference_date": book.reference_date,
        "provenance": dict(book.provenance or {}),
        "compositions": [composition_to_json(c) for c in book.compositions],
        "mappings": [asdict(m) for m in book.mappings],
    }


def composition_to_json(comp: Composition) -> dict[str, Any]:
    return {
        "code": comp.code, "description": comp.description, "unit": comp.unit,
        "waste_percent": comp.waste_percent, "base_unit_cost": comp.base_unit_cost,
        "components": [asdict(c) | {"contribution": c.contribution} for c in comp.components],
    }


def write_budget_json(path: Path, report: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(f".{path.name}.tmp")
    tmp.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    tmp.replace(path)


def write_budget_csv(path: Path, report: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fields = ["abc_class", "composition_code", "description", "discipline", "storey", "ifc_class", "type_name", "quantity_name", "quantity", "unit", "element_count", "base_unit_cost", "waste_percent", "bdi_percent", "final_unit_cost", "total_cost"]
    with path.open("w", newline="", encoding="utf-8-sig") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields); writer.writeheader()
        for row in report.get("lines", []): writer.writerow({f: row.get(f) for f in fields})



def write_budget_pdf(path: Path, report: dict[str, Any]) -> None:
    try:
        from reportlab.lib import colors
        from reportlab.lib.pagesizes import A4, landscape
        from reportlab.lib.styles import getSampleStyleSheet
        from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
    except ImportError as exc:
        raise RuntimeError("reportlab é necessário para gerar o PDF do orçamento") from exc
    path.parent.mkdir(parents=True, exist_ok=True)
    styles = getSampleStyleSheet()
    doc = SimpleDocTemplate(str(path), pagesize=landscape(A4), leftMargin=24, rightMargin=24, topMargin=24, bottomMargin=24)
    currency = str(report.get("currency") or "BRL")
    total = float(report.get("total_cost") or 0.0)
    story = [Paragraph("CompatibilizaBIM — Orçamento 5D", styles["Title"]),
             Paragraph(f"Total: {currency} {total:,.2f} · BDI: {float(report.get('bdi_percent') or 0):.2f}%", styles["Heading2"]),
             Paragraph(f"Fonte: {report.get('source') or 'catálogo local'} · Referência: {report.get('reference_date') or 'não informada'}", styles["BodyText"])]
    provenance = report.get("cost_provenance") or {}
    if provenance:
        story.append(Paragraph(
            f"Procedência: {provenance.get('source_provider') or '-'} · competência {provenance.get('competence') or '-'} · UF {provenance.get('uf') or '-'} · SHA-256 {str(provenance.get('source_sha256') or '-')[:20]}…",
            styles["BodyText"],
        ))
    story.append(Spacer(1, 10))
    data = [["ABC","Código","Descrição","Pavimento","Classe IFC","Qtd.","Un.","Custo unit.","Total"]]
    for row in report.get("lines", [])[:250]:
        data.append([row.get("abc_class"), row.get("composition_code"), row.get("description"), row.get("storey") or "-", row.get("ifc_class"), f"{float(row.get('quantity') or 0):.3f}", row.get("unit"), f"{float(row.get('final_unit_cost') or 0):,.2f}", f"{float(row.get('total_cost') or 0):,.2f}"])
    table = Table(data, repeatRows=1, colWidths=[30,60,150,75,90,55,30,70,80])
    table.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),colors.HexColor('#E8EDF3')),('FONTNAME',(0,0),(-1,0),'Helvetica-Bold'),('FONTSIZE',(0,0),(-1,-1),7),('GRID',(0,0),(-1,-1),0.25,colors.HexColor('#B8C1CC')),('VALIGN',(0,0),(-1,-1),'MIDDLE'),('ALIGN',(5,1),(-1,-1),'RIGHT'),('ROWBACKGROUNDS',(0,1),(-1,-1),[colors.white,colors.HexColor('#F8FAFC')])]))
    story.append(table)
    if report.get("unmatched"):
        story += [Spacer(1, 12), Paragraph(f"Grupos não precificados: {len(report['unmatched'])}. Revise mapeamentos, unidades ou ambiguidades antes de usar o orçamento como referência.", styles["BodyText"])]
    doc.build(story)

def assess_phase2_readiness(
    quantity_report: dict[str, Any],
    budget_report: dict[str, Any],
    *,
    provenance: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Assess whether a 5D budget is complete enough to be used as a reference.

    Coverage is deliberately based on groups/elements rather than summing heterogeneous
    physical units. Provenance is considered complete only for a traceable CAIXA source.
    """
    groups = [row for row in (quantity_report.get("groups") or []) if isinstance(row, dict)]
    total_groups = len(groups)
    matched_groups = int(budget_report.get("matched_group_count") or 0)
    unmatched = [row for row in (budget_report.get("unmatched") or []) if isinstance(row, dict)]
    total_elements = sum(max(0, int(row.get("element_count") or 0)) for row in groups)
    matched_elements = sum(max(0, int(row.get("element_count") or 0)) for row in (budget_report.get("lines") or []) if isinstance(row, dict))
    fallback_count = sum(1 for row in groups if str(row.get("source") or "") == "geometry_fallback")
    ambiguous_count = sum(1 for row in unmatched if "ambígua" in str(row.get("reason") or "").casefold())
    unit_mismatch_count = sum(1 for row in unmatched if str(row.get("reason") or "").startswith("unidade "))
    coverage = round((matched_groups / total_groups * 100.0), 2) if total_groups else 0.0
    element_coverage = round((matched_elements / total_elements * 100.0), 2) if total_elements else (100.0 if total_groups and not unmatched else 0.0)
    provenance = dict(provenance or {})
    source_provider = str(provenance.get("source_provider") or "").upper()
    source_url = str(provenance.get("source_url") or "")
    provenance_complete = bool(
        source_provider == "CAIXA"
        and provenance.get("source_sha256")
        and provenance.get("competence")
        and provenance.get("uf")
        and source_url.startswith("https://www.caixa.gov.br/")
    )
    warnings: list[str] = []
    if not groups:
        warnings.append("Nenhum grupo de quantitativos disponível.")
    if unmatched:
        warnings.append(f"{len(unmatched)} grupo(s) de quantitativos ainda não foram precificados.")
    if ambiguous_count:
        warnings.append(f"{ambiguous_count} grupo(s) possuem quantidade ambígua (ex.: Net/Gross).")
    if unit_mismatch_count:
        warnings.append(f"{unit_mismatch_count} grupo(s) possuem unidade incompatível com a composição.")
    if fallback_count:
        warnings.append(f"{fallback_count} grupo(s) usam fallback geométrico e exigem revisão técnica.")
    if not provenance_complete:
        warnings.append("A procedência da base de custos oficial não está completa/verificada.")
    ready = bool(groups) and not unmatched and provenance_complete
    return {
        "schema_version": 1,
        "ready_for_reference_budget": ready,
        "coverage_percent": coverage,
        "element_coverage_percent": element_coverage,
        "total_group_count": total_groups,
        "matched_group_count": matched_groups,
        "unmatched_group_count": len(unmatched),
        "geometry_fallback_group_count": fallback_count,
        "ambiguous_group_count": ambiguous_count,
        "unit_mismatch_group_count": unit_mismatch_count,
        "provenance_complete": provenance_complete,
        "provenance": provenance,
        "warnings": warnings,
    }


def _best_mapping(row: dict[str, Any], mappings: Sequence[CostMapping]) -> CostMapping | None:
    candidates: list[tuple[int, int, CostMapping]] = []
    for pos, mapping in enumerate(mappings):
        if mapping.ifc_class not in {"*", str(row.get("ifc_class") or "")}:
            continue
        if mapping.quantity_kind != str(row.get("kind") or ""):
            continue
        if str(row.get("source") or "ifc_qto") == "geometry_fallback" and not mapping.allow_geometry_fallback:
            continue
        score = 1 if mapping.ifc_class == "*" else 8
        checks = (
            (mapping.type_contains, _text(row.get("type_name")), 4),
            (mapping.quantity_name_contains, _text(row.get("quantity_name")), 2),
            (mapping.material_contains, _text(row.get("material")), 2),
        )
        valid = True
        for needle, haystack, weight in checks:
            if needle:
                if not haystack or needle.casefold() not in haystack.casefold(): valid = False; break
                score += weight
        if valid: candidates.append((score, -pos, mapping))
    return max(candidates, default=(0, 0, None), key=lambda x: (x[0], x[1]))[2]


def _assign_abc(lines: Sequence[BudgetLine]) -> list[BudgetLine]:
    total = sum(max(0.0, line.total_cost) for line in lines)
    if total <= 0: return [replace(line, abc_class="C") for line in lines]
    ordered = sorted(enumerate(lines), key=lambda item: item[1].total_cost, reverse=True)
    result = list(lines); cumulative = 0.0
    for idx, line in ordered:
        cumulative += line.total_cost
        pct = cumulative / total * 100.0
        cls = "A" if pct <= 80.0 else "B" if pct <= 95.0 else "C"
        # Keep the first item that crosses 80% in A to avoid an empty/undersized A class.
        before = (cumulative - line.total_cost) / total * 100.0
        if before < 80.0 <= pct: cls = "A"
        elif before < 95.0 <= pct and before >= 80.0: cls = "B"
        result[idx] = replace(line, abc_class=cls)
    return result


def _text(value: Any) -> str | None:
    if value is None: return None
    text = str(value).strip(); return text or None
