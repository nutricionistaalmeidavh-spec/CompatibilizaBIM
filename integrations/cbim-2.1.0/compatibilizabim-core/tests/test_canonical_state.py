from __future__ import annotations

from cbim_sdk import CBIMProject, Pipe, Point3D, SourceRef
from compatibilizabim_core.product.canonical import (
    CanonicalProjectState,
    CanonicalReviewState,
    build_canonical_project_state,
)


def _project() -> CBIMProject:
    return CBIMProject(
        id="project_demo",
        name="Demo",
        elements=[
            Pipe(
                id="pipe_001",
                path=[Point3D(x=0,y=0,z=0), Point3D(x=1,y=0,z=0)],
                diameter=0.05,
                confidence=0.72,
                review_state="edited",
                source_refs=[SourceRef(source_id="src_1", entity_id="42", layer="HID")],
            )
        ],
    )


def test_canonical_state_preserves_project_and_element_ids():
    state=build_canonical_project_state(_project(), revision=7)
    assert state.project.id=="project_demo"
    assert state.revision==7
    assert [element.id for element in state.elements]==["pipe_001"]


def test_canonical_review_state_is_derived_from_cbim_project():
    state=build_canonical_project_state(_project(), revision=3)
    element=state.elements[0]
    assert element.review_state is CanonicalReviewState.EDITED
    assert element.source_refs[0].source_id=="src_1"
    assert element.source_refs[0].entity_id=="42"


def test_canonical_state_rejects_duplicate_element_ids():
    project=_project()
    project.elements.append(project.elements[0].model_copy())
    try:
        build_canonical_project_state(project, revision=0)
    except ValueError as exc:
        assert "duplicate canonical id" in str(exc)
    else:
        raise AssertionError("duplicate canonical ids must be rejected")


def test_canonical_snapshot_round_trips_without_ui_specific_state():
    state=build_canonical_project_state(_project(), revision=2)
    payload=state.model_dump(mode="json")
    restored=CanonicalProjectState.model_validate(payload)
    assert restored==state
    assert "selected" not in payload
    assert "filters" not in payload
