from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Literal

ClashMode = Literal["intersection", "collision", "clearance"]


@dataclass(frozen=True, slots=True)
class ClashRequest:
    file_a: Path
    file_b: Path
    class_a: str = "IfcElement"
    class_b: str = "IfcElement"
    mode: ClashMode = "intersection"
    tolerance: float = 0.002
    clearance: float = 0.05
    check_all: bool = True


@dataclass(frozen=True, slots=True)
class ClashResult:
    index: int
    mode: ClashMode
    a_global_id: str
    b_global_id: str
    a_ifc_class: str
    b_ifc_class: str
    a_name: str | None
    b_name: str | None
    clash_type: str
    p1: tuple[float, float, float]
    p2: tuple[float, float, float]
    point: tuple[float, float, float]
    depth_m: float
