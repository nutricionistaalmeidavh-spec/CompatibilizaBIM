from cbim_sdk import CBIMProject
from cbim_sdk.models import Fitting, Pipe, Point3D, SanitaryTerminal, Slab, Storey, System, Wall

from compatibilizabim_core.revit.compiler import RevitBuildPlanCompiler


def pt(x, y, z=0.0):
    return Point3D(x=x, y=y, z=z)


def test_compile_cbim_to_native_revit_operations_preserves_semantics_and_dimensions():
    level = Storey(id="l0", name="Térreo", elevation=0.0, height=2.8)
    system = System(id="af", name="Água Fria", discipline="plumbing", classification="cold_water")
    project = CBIMProject(
        id="p",
        name="Demo",
        storeys=[level],
        systems=[system],
        elements=[
            Wall(id="w", storey_id="l0", start=pt(0, 0), end=pt(4, 0), thickness=0.15, height=2.8),
            Slab(id="s", storey_id="l0", boundary=[pt(0, 0), pt(4, 0), pt(4, 3), pt(0, 3)], thickness=0.12),
            Pipe(id="p1", storey_id="l0", path=[pt(0, 1, 0.8), pt(2, 1, 0.8), pt(2, 2, 0.8)], diameter=0.025, system_id="af", slope=0.01),
            Fitting(id="f1", storey_id="l0", position=pt(2, 1, 0.8), fitting_type="elbow", nominal_diameter=0.025, system_id="af"),
            SanitaryTerminal(id="sink", storey_id="l0", position=pt(3, 2, 0.85), terminal_type="sink", width=0.6, depth=0.5, height=0.85, system_id="af"),
        ],
    )

    plan = RevitBuildPlanCompiler(revit_version=2027).compile(project)

    assert plan.schema == "CBIM.RevitBuildPlan"
    assert plan.revit_version == 2027
    assert plan.project_id == "p"
    assert [op.action for op in plan.operations[:2]] == ["ensure_level", "create_wall"]

    wall = next(op for op in plan.operations if op.cbim_id == "w")
    assert wall.action == "create_wall"
    assert wall.parameters["height_m"] == 2.8
    assert wall.parameters["thickness_m"] == 0.15

    slab = next(op for op in plan.operations if op.cbim_id == "s")
    assert slab.action == "create_floor"
    assert slab.parameters["thickness_m"] == 0.12
    assert len(slab.geometry["boundary"]) == 4

    pipe_ops = [op for op in plan.operations if op.cbim_id == "p1"]
    assert len(pipe_ops) == 2
    assert all(op.action == "create_pipe" for op in pipe_ops)
    assert [op.parameters["segment_index"] for op in pipe_ops] == [0, 1]
    assert all(op.parameters["diameter_m"] == 0.025 for op in pipe_ops)
    assert all(op.parameters["slope"] == 0.01 for op in pipe_ops)
    assert pipe_ops[0].geometry["start"]["z"] == 0.8

    fitting = next(op for op in plan.operations if op.cbim_id == "f1")
    assert fitting.action == "create_fitting"
    assert fitting.parameters["fitting_type"] == "elbow"
    assert fitting.family_query["semantic_class"] == "pipe_fitting"
    assert fitting.family_query["nominal_diameter_m"] == 0.025

    sink = next(op for op in plan.operations if op.cbim_id == "sink")
    assert sink.action == "place_family_instance"
    assert sink.family_query["semantic_class"] == "sanitary_terminal"
    assert sink.family_query["subtype"] == "sink"

from pathlib import Path
from compatibilizabim_core.revit.library import LibraryFamilyRecord, LibraryManifest, RevitLibraryResolver


def test_library_resolver_matches_semantics_and_rejects_paths_outside_local_roots(tmp_path):
    root = tmp_path / "library"
    root.mkdir()
    family = root / "Tigre" / "joelho.rfa"
    family.parent.mkdir()
    family.write_bytes(b"RFA-placeholder")
    outside = tmp_path / "outside.rfa"
    outside.write_bytes(b"no")

    manifest = LibraryManifest(
        roots=[str(root)],
        families=[
            LibraryFamilyRecord(
                id="elbow-tigre",
                family_path=str(family),
                family_name="Joelho 90",
                type_name="DN25",
                semantic_class="pipe_fitting",
                subtype="elbow",
                manufacturer="Tigre",
                systems=["cold_water"],
                materials=["PVC"],
                nominal_diameters_m=[0.025],
                angles_deg=[90.0],
                connector_count=2,
                revit_versions=[2027],
                redistribution="local-only",
            ),
            LibraryFamilyRecord(
                id="bad",
                family_path=str(outside),
                family_name="Bad",
                type_name="X",
                semantic_class="pipe_fitting",
                subtype="elbow",
                nominal_diameters_m=[0.025],
                revit_versions=[2027],
            ),
        ],
    )
    resolver = RevitLibraryResolver(manifest)
    query = {
        "semantic_class": "pipe_fitting",
        "subtype": "elbow",
        "system": "cold_water",
        "material": "PVC",
        "nominal_diameter_m": 0.025,
        "angle_deg": 90.0,
        "connector_count": 2,
        "revit_version": 2027,
        "manufacturer": "Tigre",
    }

    match = resolver.resolve(query)
    assert match is not None
    assert match.record.id == "elbow-tigre"
    assert Path(match.record.family_path).resolve().is_relative_to(root.resolve())
    assert match.score >= 0.9


def test_resolve_plan_attaches_family_without_mutating_unrelated_operations(tmp_path):
    root = tmp_path / "library"
    root.mkdir()
    family = root / "sink.rfa"
    family.write_bytes(b"x")
    manifest = LibraryManifest(roots=[str(root)], families=[LibraryFamilyRecord(
        id="sink", family_path=str(family), family_name="Cuba", type_name="600x500",
        semantic_class="sanitary_terminal", subtype="sink", revit_versions=[2027]
    )])
    project = CBIMProject(name="P", elements=[SanitaryTerminal(id="sink1", position=pt(1,2), terminal_type="sink")])
    plan = RevitBuildPlanCompiler().compile(project)
    resolved = RevitLibraryResolver(manifest).resolve_plan(plan)
    op = next(o for o in resolved.operations if o.cbim_id == "sink1")
    assert op.resolved_family["family_id"] == "sink"
    assert op.resolved_family["type_name"] == "600x500"
