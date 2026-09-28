from __future__ import annotations

from pathlib import Path
from typing import Any, Protocol, Sequence

from .models import ClashRequest, ClashResult


class ClashBackend(Protocol):
    def open_model(self, path: Path) -> Any: ...

    def select_elements(self, model: Any, ifc_class: str) -> Sequence[Any]: ...

    def build_tree(self, models: Sequence[Any]) -> Any: ...

    def find_clashes(
        self,
        tree: Any,
        group_a: Sequence[Any],
        group_b: Sequence[Any],
        mode: str,
        tolerance: float,
        clearance: float,
        check_all: bool,
    ) -> Sequence[dict[str, Any]]: ...


class ClashEngine:
    def __init__(self, backend: ClashBackend) -> None:
        self.backend = backend

    def run(self, request: ClashRequest) -> list[ClashResult]:
        model_a = self.backend.open_model(request.file_a)
        model_b = self.backend.open_model(request.file_b)
        group_a = self.backend.select_elements(model_a, request.class_a)
        group_b = self.backend.select_elements(model_b, request.class_b)
        tree = self.backend.build_tree([model_a, model_b])
        raw = self.backend.find_clashes(
            tree,
            group_a,
            group_b,
            request.mode,
            request.tolerance,
            request.clearance,
            request.check_all,
        )

        return normalize_clash_results(raw, request.mode)


def normalize_clash_results(
    raw: Sequence[dict[str, Any]], mode: str
) -> list[ClashResult]:
    results: list[ClashResult] = []
    for index, item in enumerate(raw, start=1):
        p1 = _point3(item.get("p1"))
        p2 = _point3(item.get("p2"))
        point = tuple((a + b) / 2 for a, b in zip(p1, p2, strict=True))
        results.append(
            ClashResult(
                index=index,
                mode=mode,  # type: ignore[arg-type]
                a_global_id=str(item.get("a_global_id") or ""),
                b_global_id=str(item.get("b_global_id") or ""),
                a_ifc_class=str(item.get("a_ifc_class") or ""),
                b_ifc_class=str(item.get("b_ifc_class") or ""),
                a_name=item.get("a_name"),
                b_name=item.get("b_name"),
                clash_type=str(item.get("clash_type") or mode),
                p1=p1,
                p2=p2,
                point=point,
                depth_m=float(item.get("distance") or 0.0),
            )
        )
    return results


def _point3(value: Any) -> tuple[float, float, float]:
    if value is None:
        return (0.0, 0.0, 0.0)
    points = tuple(float(v) for v in value)
    if len(points) != 3:
        raise ValueError(f"Expected XYZ point with 3 coordinates, got {len(points)}")
    return points  # type: ignore[return-value]
