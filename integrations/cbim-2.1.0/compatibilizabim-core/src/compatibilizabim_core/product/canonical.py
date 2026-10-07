from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, ConfigDict, Field
from cbim_sdk import CBIMProject


class CanonicalModel(BaseModel):
    model_config=ConfigDict(extra="forbid", frozen=True)


class CanonicalReviewState(str, Enum):
    AUTO="auto"
    CONFIRMED="confirmed"
    EDITED="edited"
    REJECTED="rejected"


class CanonicalProject(CanonicalModel):
    id:str
    name:str
    schema_version:str
    units:str
    coordinate_reference:str


class CanonicalSourceRef(CanonicalModel):
    source_id:str
    entity_id:str
    source_type:str
    layer:str|None=None


class CanonicalElement(CanonicalModel):
    id:str
    type:str
    name:str|None=None
    storey_id:str|None=None
    system_id:str|None=None
    confidence:float=Field(ge=0,le=1)
    review_state:CanonicalReviewState
    source_refs:tuple[CanonicalSourceRef,...]=()


class CanonicalProjectState(CanonicalModel):
    contract_version:str="1.0.0"
    project:CanonicalProject
    revision:int=Field(ge=0)
    elements:tuple[CanonicalElement,...]=()


def build_canonical_project_state(project:CBIMProject, *, revision:int=0)->CanonicalProjectState:
    """Build the UI/application projection from the authoritative CBIM project.

    The projection deliberately contains no transient renderer state. Selection,
    filters, open panels and similar concerns belong to the UI layer.
    """
    if revision < 0:
        raise ValueError("revision must be >= 0")
    ids=[element.id for element in project.elements]
    if len(ids)!=len(set(ids)):
        raise ValueError("duplicate canonical id in project elements")
    elements=[]
    for element in project.elements:
        elements.append(CanonicalElement(
            id=element.id,
            type=element.type,
            name=element.name,
            storey_id=element.storey_id,
            system_id=getattr(element,"system_id",None),
            confidence=element.confidence,
            review_state=CanonicalReviewState(element.review_state),
            source_refs=tuple(CanonicalSourceRef(
                source_id=ref.source_id,
                entity_id=ref.entity_id,
                source_type=ref.source_type,
                layer=ref.layer,
            ) for ref in element.source_refs),
        ))
    return CanonicalProjectState(
        project=CanonicalProject(
            id=project.id,
            name=project.name,
            schema_version=project.schema_version,
            units=project.units,
            coordinate_reference=project.coordinate_reference,
        ),
        revision=revision,
        elements=tuple(elements),
    )
