from __future__ import annotations

from typing import Annotated, Literal, Union

from pydantic import BaseModel, ConfigDict, Field


class CadModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class CadPoint(CadModel):
    x: float
    y: float
    z: float = 0.0


class CadEntityBase(CadModel):
    id: str
    kind: str
    layer: str = "0"
    metadata: dict[str, str | int | float | bool | None] = Field(default_factory=dict)


class CadLine(CadEntityBase):
    kind: Literal["line"] = "line"
    start: CadPoint
    end: CadPoint


class CadPolyline(CadEntityBase):
    kind: Literal["polyline"] = "polyline"
    points: list[CadPoint] = Field(min_length=2)
    closed: bool = False


class CadArc(CadEntityBase):
    kind: Literal["arc"] = "arc"
    center: CadPoint
    radius: float = Field(gt=0)
    start_angle_deg: float
    end_angle_deg: float


class CadCircle(CadEntityBase):
    kind: Literal["circle"] = "circle"
    center: CadPoint
    radius: float = Field(gt=0)


class CadSpline(CadEntityBase):
    kind: Literal["spline"] = "spline"
    points: list[CadPoint] = Field(min_length=2)
    closed: bool = False


class CadInsert(CadEntityBase):
    kind: Literal["insert"] = "insert"
    block_name: str
    position: CadPoint
    rotation_deg: float = 0.0
    xscale: float = 1.0
    yscale: float = 1.0
    zscale: float = 1.0


class CadText(CadEntityBase):
    kind: Literal["text"] = "text"
    text: str
    position: CadPoint
    height: float | None = None
    rotation_deg: float = 0.0


CadEntity = Annotated[
    Union[CadLine, CadPolyline, CadArc, CadCircle, CadSpline, CadInsert, CadText],
    Field(discriminator="kind"),
]


class CadBlock(CadModel):
    name: str
    base_point: CadPoint = Field(default_factory=lambda: CadPoint(x=0, y=0, z=0))
    entities: list[CadEntity] = Field(default_factory=list)


class CadDocument(CadModel):
    source_id: str
    source_format: Literal["dxf", "dwg", "canonical"] = "canonical"
    source_path: str | None = None
    units: Literal["m"] = "m"
    entities: list[CadEntity] = Field(default_factory=list)
    blocks: dict[str, CadBlock] = Field(default_factory=dict)
    layers: list[str] = Field(default_factory=list)
    metadata: dict[str, str | int | float | bool | None] = Field(default_factory=dict)
