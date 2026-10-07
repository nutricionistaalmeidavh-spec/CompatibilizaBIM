from cbim_sdk import CBIMProject
from cbim_sdk.models import Fitting, Pipe, Point3D, System

from compatibilizabim_core.revit.compiler import RevitBuildPlanCompiler
from compatibilizabim_core.revit.hydraulic import RevitHydraulicRefiner


def p(x, y, z=0.8):
    return Point3D(x=x, y=y, z=z)


def project(pipes):
    return CBIMProject(
        name="H",
        systems=[System(id="af", name="Água Fria", discipline="plumbing", classification="cold_water")],
        elements=pipes,
    )


def pipe(id, pts, d=0.025, slope=None):
    return Pipe(id=id, path=pts, diameter=d, system_id="af", slope=slope)


def test_hydraulic_refiner_inserts_elbow_for_native_pipe_bend_and_preserves_z_slope():
    plan = RevitBuildPlanCompiler().compile(project([pipe("a", [p(0,0), p(2,0), p(2,2)], slope=0.01)]))
    refined, report = RevitHydraulicRefiner().refine(plan)

    pipes = [op for op in refined.operations if op.action == "create_pipe"]
    fittings = [op for op in refined.operations if op.action == "create_fitting"]
    assert len(pipes) == 2
    assert all(op.geometry["start"]["z"] == 0.8 and op.geometry["end"]["z"] == 0.8 for op in pipes)
    assert all(op.parameters["slope"] == 0.01 for op in pipes)
    assert len(fittings) == 1
    assert fittings[0].parameters["fitting_type"] == "elbow"
    assert fittings[0].family_query["connector_count"] == 2
    assert report.inserted_elbows == 1


def test_hydraulic_refiner_inserts_tee_for_three_way_branch():
    pipes = [
        pipe("a", [p(0,0), p(2,0)]),
        pipe("b", [p(2,0), p(4,0)]),
        pipe("c", [p(2,0), p(2,2)]),
    ]
    refined, report = RevitHydraulicRefiner().refine(RevitBuildPlanCompiler().compile(project(pipes)))
    fittings = [op for op in refined.operations if op.action == "create_fitting"]
    assert any(op.parameters["fitting_type"] == "tee" for op in fittings)
    assert report.inserted_tees == 1


def test_hydraulic_refiner_inserts_reducer_for_collinear_diameter_change():
    pipes = [pipe("a", [p(0,0), p(2,0)], 0.025), pipe("b", [p(2,0), p(4,0)], 0.032)]
    refined, report = RevitHydraulicRefiner().refine(RevitBuildPlanCompiler().compile(project(pipes)))
    fittings = [op for op in refined.operations if op.action == "create_fitting"]
    reducer = next(op for op in fittings if op.parameters["fitting_type"] == "reducer")
    assert sorted(reducer.parameters["connected_diameters_m"]) == [0.025, 0.032]
    assert report.inserted_reducers == 1


def test_hydraulic_refiner_reports_near_miss_without_silently_snapping():
    pipes = [pipe("a", [p(0,0), p(2,0)]), pipe("b", [p(2.006,0), p(4,0)])]
    refined, report = RevitHydraulicRefiner(near_miss_tolerance_m=0.01).refine(RevitBuildPlanCompiler().compile(project(pipes)))
    assert report.near_miss_connections == 1
    assert any(d.code == "hydraulic_near_miss_connection" for d in refined.diagnostics)
    assert not [op for op in refined.operations if op.action == "create_fitting"]


def test_hydraulic_refiner_attaches_incident_pipe_dependencies_to_existing_cbim_fitting():
    pipes = [
        pipe("a", [p(0,0), p(2,0)]),
        pipe("b", [p(2,0), p(2,2)]),
    ]
    proj = project(pipes)
    proj.elements.append(Fitting(
        id="elbow-existing",
        position=p(2,0),
        fitting_type="elbow",
        nominal_diameter=0.025,
        system_id="af",
    ))
    refined, report = RevitHydraulicRefiner().refine(RevitBuildPlanCompiler().compile(proj))
    fitting = next(op for op in refined.operations if op.cbim_id == "elbow-existing")
    assert fitting.dependencies == ["pipe:a:0", "pipe:b:0"]
    assert fitting.parameters["topology_dependencies_enriched"] is True
    assert report.inserted_elbows == 0


def test_hydraulic_refiner_blocks_a_plan_dominated_by_microsegments():
    pipes = [
        pipe(f"fragment-{index}", [p(index * 0.003, 0), p(index * 0.003 + 0.002, 0)], d=0.110)
        for index in range(40)
    ]
    refined, _ = RevitHydraulicRefiner().refine(RevitBuildPlanCompiler().compile(project(pipes)))

    diagnostic = next(d for d in refined.diagnostics if d.code == "hydraulic_microsegment_plan_blocked")
    assert diagnostic.severity == "error"
    assert diagnostic.data["microsegment_count"] == 40
