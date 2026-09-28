from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Literal, Sequence

from .engine import ClashBackend, normalize_clash_results
from .models import ClashMode, ClashResult

Severity = Literal["low", "medium", "high", "critical"]


@dataclass(frozen=True, slots=True)
class ClashRule:
    rule_id: str
    name: str
    class_a: str
    class_b: str
    mode: ClashMode = "intersection"
    tolerance: float = 0.002
    clearance: float = 0.05
    severity: Severity = "high"

    def __post_init__(self) -> None:
        if self.tolerance < 0:
            raise ValueError("tolerance deve ser maior ou igual a zero")
        if self.clearance < 0:
            raise ValueError("clearance deve ser maior ou igual a zero")


@dataclass(frozen=True, slots=True)
class RuleClash:
    rule_id: str
    rule_name: str
    severity: Severity
    clash: ClashResult


@dataclass(frozen=True, slots=True)
class RuleRunReport:
    file_a: Path
    file_b: Path
    rules: tuple[ClashRule, ...]
    raw_clash_count: int
    unique_clash_count: int
    clashes: tuple[RuleClash, ...]


class RuleEngine:
    def __init__(self, backend: ClashBackend) -> None:
        self.backend = backend

    def run(
        self,
        file_a: Path,
        file_b: Path,
        rules: Sequence[ClashRule],
        *,
        check_all: bool = True,
    ) -> RuleRunReport:
        if not rules:
            raise ValueError("Informe pelo menos uma regra de compatibilização")

        model_a = self.backend.open_model(file_a)
        model_b = self.backend.open_model(file_b)
        tree = self.backend.build_tree([model_a, model_b])

        all_clashes: list[RuleClash] = []
        for rule in rules:
            group_a = self.backend.select_elements(model_a, rule.class_a)
            group_b = self.backend.select_elements(model_b, rule.class_b)
            if not group_a or not group_b:
                continue
            raw = self.backend.find_clashes(
                tree,
                group_a,
                group_b,
                rule.mode,
                rule.tolerance,
                rule.clearance,
                check_all,
            )
            for clash in normalize_clash_results(raw, rule.mode):
                all_clashes.append(
                    RuleClash(
                        rule_id=rule.rule_id,
                        rule_name=rule.name,
                        severity=rule.severity,
                        clash=clash,
                    )
                )

        unique = _deduplicate(all_clashes)
        return RuleRunReport(
            file_a=file_a,
            file_b=file_b,
            rules=tuple(rules),
            raw_clash_count=len(all_clashes),
            unique_clash_count=len(unique),
            clashes=tuple(unique),
        )


_SEVERITY_RANK: dict[Severity, int] = {
    "low": 1,
    "medium": 2,
    "high": 3,
    "critical": 4,
}


def _deduplicate(clashes: Sequence[RuleClash]) -> list[RuleClash]:
    selected: dict[tuple[object, ...], RuleClash] = {}
    order: list[tuple[object, ...]] = []
    for item in clashes:
        key = _clash_key(item.clash)
        current = selected.get(key)
        if current is None:
            selected[key] = item
            order.append(key)
            continue
        if _SEVERITY_RANK[item.severity] > _SEVERITY_RANK[current.severity]:
            selected[key] = item
    return [selected[key] for key in order]


def _clash_key(clash: ClashResult) -> tuple[object, ...]:
    if clash.a_global_id and clash.b_global_id:
        return (clash.a_global_id, clash.b_global_id)
    return (
        clash.a_ifc_class,
        clash.b_ifc_class,
        clash.a_name,
        clash.b_name,
        *(round(value, 3) for value in clash.point),
    )


def get_preset(name: str) -> tuple[ClashRule, ...]:
    try:
        return _PRESETS[name]
    except KeyError as exc:
        raise ValueError(
            f"Preset desconhecido: {name}. Disponíveis: {', '.join(sorted(_PRESETS))}"
        ) from exc


def preset_names() -> tuple[str, ...]:
    return tuple(sorted(_PRESETS))


def _intersection_rule(rule_id: str, name: str, class_a: str, class_b: str, severity: Severity) -> ClashRule:
    return ClashRule(rule_id, name, class_a, class_b, severity=severity)


_MEP_STRUCTURE = tuple(
    _intersection_rule(
        f"mep-{mep.lower().replace('ifc', '')}-{structure.lower().replace('ifc', '')}",
        f"{mep} x {structure}",
        mep,
        structure,
        "critical" if structure in {"IfcBeam", "IfcColumn"} else "high",
    )
    for mep in ("IfcPipeSegment", "IfcDuctSegment", "IfcCableCarrierSegment")
    for structure in ("IfcBeam", "IfcColumn", "IfcSlab")
)

_HYDRAULICS_STRUCTURE = tuple(
    _intersection_rule(
        f"hyd-{mep.lower().replace('ifc', '')}-{structure.lower().replace('ifc', '')}",
        f"{mep} x {structure}",
        mep,
        structure,
        "critical" if structure in {"IfcBeam", "IfcColumn"} else "high",
    )
    for mep in ("IfcPipeSegment", "IfcPipeFitting")
    for structure in ("IfcBeam", "IfcColumn", "IfcSlab")
)

_PRESETS: dict[str, tuple[ClashRule, ...]] = {
    "mep-structure": _MEP_STRUCTURE,
    "hydraulics-structure": _HYDRAULICS_STRUCTURE,
}
