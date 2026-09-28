from __future__ import annotations

import hashlib
import math
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Mapping, Protocol, Sequence


@dataclass(frozen=True, slots=True)
class BoundingBox:
    minimum: tuple[float, float, float]
    maximum: tuple[float, float, float]

    def __post_init__(self) -> None:
        if len(self.minimum) != 3 or len(self.maximum) != 3:
            raise ValueError("BoundingBox exige coordenadas XYZ")
        if any(lo > hi for lo, hi in zip(self.minimum, self.maximum, strict=True)):
            raise ValueError("BoundingBox inválida: mínimo maior que máximo")

    @property
    def center(self) -> tuple[float, float, float]:
        return tuple((lo + hi) / 2.0 for lo, hi in zip(self.minimum, self.maximum, strict=True))  # type: ignore[return-value]

    @property
    def diagonal_m(self) -> float:
        return math.dist(self.minimum, self.maximum)

    def separation_from(self, other: "BoundingBox") -> float:
        gaps = []
        for a_min, a_max, b_min, b_max in zip(
            self.minimum, self.maximum, other.minimum, other.maximum, strict=True
        ):
            if a_max < b_min:
                gaps.append(b_min - a_max)
            elif b_max < a_min:
                gaps.append(a_min - b_max)
            else:
                gaps.append(0.0)
        return math.sqrt(sum(gap * gap for gap in gaps))


@dataclass(frozen=True, slots=True)
class ModelPreflight:
    path: Path
    sha256: str
    schema: str
    unit_scale_m: float
    element_count: int
    geometry_count: int
    storeys: tuple[str, ...]
    discipline: str
    bbox: BoundingBox | None


@dataclass(frozen=True, slots=True)
class FederationWarning:
    code: str
    message: str
    files: tuple[str, ...] = ()


@dataclass(frozen=True, slots=True)
class FederationReport:
    models: tuple[ModelPreflight, ...]
    warnings: tuple[FederationWarning, ...]
    aligned: bool
    alignment_tolerance_m: float


class PreflightBackend(Protocol):
    def open_model(self, path: Path) -> Any: ...

    def inspect_model(self, model: Any, path: Path) -> Mapping[str, Any]: ...


class PreflightEngine:
    def __init__(self, backend: PreflightBackend) -> None:
        self.backend = backend

    def run(
        self,
        paths: Sequence[Path],
        *,
        alignment_tolerance_m: float = 5.0,
    ) -> FederationReport:
        if not paths:
            raise ValueError("Informe pelo menos um arquivo IFC")
        if alignment_tolerance_m < 0:
            raise ValueError("alignment_tolerance_m deve ser maior ou igual a zero")

        reports: list[ModelPreflight] = []
        for path in paths:
            _validate_ifc_path(path)
            model = self.backend.open_model(path)
            metadata = self.backend.inspect_model(model, path)
            class_counts = dict(metadata.get("class_counts") or {})
            reports.append(
                ModelPreflight(
                    path=path,
                    sha256=_sha256(path),
                    schema=str(metadata.get("schema") or "Unknown"),
                    unit_scale_m=float(metadata.get("unit_scale_m") or 1.0),
                    element_count=int(metadata.get("element_count") or 0),
                    geometry_count=int(metadata.get("geometry_count") or 0),
                    storeys=tuple(str(item) for item in (metadata.get("storeys") or ())),
                    discipline=infer_discipline(path, class_counts),
                    bbox=metadata.get("bbox"),
                )
            )
        return analyze_federation(tuple(reports), alignment_tolerance_m=alignment_tolerance_m)


def analyze_federation(
    models: Sequence[ModelPreflight],
    *,
    alignment_tolerance_m: float = 5.0,
) -> FederationReport:
    if alignment_tolerance_m < 0:
        raise ValueError("alignment_tolerance_m deve ser maior ou igual a zero")

    warnings: list[FederationWarning] = []

    hashes: dict[str, list[ModelPreflight]] = {}
    for model in models:
        hashes.setdefault(model.sha256, []).append(model)
    for duplicates in hashes.values():
        if len(duplicates) > 1:
            files = tuple(item.path.name for item in duplicates)
            warnings.append(
                FederationWarning(
                    "duplicate_file",
                    f"Arquivos com conteúdo idêntico detectados: {', '.join(files)}",
                    files,
                )
            )

    schemas = {model.schema for model in models if model.schema}
    if len(schemas) > 1:
        warnings.append(
            FederationWarning(
                "schema_mismatch",
                f"Schemas IFC diferentes no conjunto: {', '.join(sorted(schemas))}",
                tuple(model.path.name for model in models),
            )
        )

    rounded_scales = {round(model.unit_scale_m, 12) for model in models}
    if len(rounded_scales) > 1:
        warnings.append(
            FederationWarning(
                "unit_mismatch",
                "Os modelos usam escalas de unidade diferentes.",
                tuple(model.path.name for model in models),
            )
        )

    for model in models:
        if model.bbox is None:
            warnings.append(
                FederationWarning(
                    "missing_geometry_bounds",
                    f"Não foi possível calcular limites geométricos de {model.path.name}.",
                    (model.path.name,),
                )
            )

    for index, left in enumerate(models):
        if left.bbox is None:
            continue
        for right in models[index + 1 :]:
            if right.bbox is None:
                continue
            separation = left.bbox.separation_from(right.bbox)
            if separation > alignment_tolerance_m:
                warnings.append(
                    FederationWarning(
                        "possible_misalignment",
                        (
                            f"{left.path.name} e {right.path.name} estão separados por "
                            f"aprox. {separation:.3f} m entre seus limites geométricos."
                        ),
                        (left.path.name, right.path.name),
                    )
                )

    aligned = not any(warning.code == "possible_misalignment" for warning in warnings)
    return FederationReport(
        models=tuple(models),
        warnings=tuple(warnings),
        aligned=aligned,
        alignment_tolerance_m=alignment_tolerance_m,
    )


def infer_discipline(path: Path, class_counts: Mapping[str, int]) -> str:
    name = path.stem.lower()
    if any(token in name for token in ("mep", "hyd", "plumb", "pipe", "duct", "elec", "hvac")):
        return "MEP"
    if any(token in name for token in ("str", "struct", "estrutura")):
        return "Structure"
    if any(token in name for token in ("arc", "arch", "arquitet")):
        return "Architecture"

    mep_classes = (
        "IfcPipeSegment",
        "IfcPipeFitting",
        "IfcDuctSegment",
        "IfcDuctFitting",
        "IfcCableCarrierSegment",
        "IfcCableSegment",
    )
    structure_classes = ("IfcBeam", "IfcColumn", "IfcFooting", "IfcMember")
    architecture_classes = ("IfcWall", "IfcDoor", "IfcWindow", "IfcRoof", "IfcStair")

    scores = {
        "MEP": sum(int(class_counts.get(name, 0)) for name in mep_classes),
        "Structure": sum(int(class_counts.get(name, 0)) for name in structure_classes),
        "Architecture": sum(int(class_counts.get(name, 0)) for name in architecture_classes),
    }
    best = max(scores, key=scores.get)
    return best if scores[best] > 0 else "Unknown"


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _validate_ifc_path(path: Path) -> None:
    if not path.exists():
        raise ValueError(f"Arquivo não encontrado: {path}")
    if not path.is_file():
        raise ValueError(f"Caminho não é um arquivo: {path}")
    if path.suffix.lower() != ".ifc":
        raise ValueError(f"Arquivo deve ter extensão .ifc: {path}")
