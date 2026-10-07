from pathlib import Path

import ezdxf
from cbim_sdk import CBIMProject
from cbim_sdk.models import Pipe, Point3D, System

from compatibilizabim_core.dwg import DWGImporter
from compatibilizabim_core.revit.cli import analyze_dwg_with_importer, main
from compatibilizabim_core.revit.models import RevitBuildPlan


class FakeProvider:
    name = "fake"
    def available(self): return True
    def to_dxf(self, source: Path, target: Path):
        doc = ezdxf.new("R2018")
        doc.units = 6  # metres
        doc.layers.add("H-AF-TB")
        doc.modelspace().add_line((0, 0), (2, 0), dxfattribs={"layer": "H-AF-TB"})
        doc.saveas(target)


def test_cbim_revit_compile_cli_writes_plan(tmp_path):
    project = CBIMProject(
        name="P",
        systems=[System(id="af", name="AF", discipline="plumbing", classification="cold_water")],
        elements=[Pipe(id="p", path=[Point3D(x=0,y=0,z=.8), Point3D(x=1,y=0,z=.8)], diameter=.025, system_id="af")],
    )
    src = tmp_path / "p.cbim.json"
    dst = tmp_path / "p.revit-plan.json"
    src.write_text(project.model_dump_json(indent=2, exclude_none=True), encoding="utf-8")
    assert main(["compile", "--cbim", str(src), "--output", str(dst)]) == 0
    plan = RevitBuildPlan.model_validate_json(dst.read_text(encoding="utf-8"))
    assert any(op.action == "create_pipe" for op in plan.operations)


def test_analyze_dwg_helper_emits_cbim_and_revit_plan_without_ifc(tmp_path):
    source = tmp_path / "sample.dwg"
    source.write_bytes(b"fixture")
    out = tmp_path / "out"
    result = analyze_dwg_with_importer(
        source,
        output_dir=out,
        importer=DWGImporter(FakeProvider()),
        discipline="hydraulic",
        project_name="Demo",
    )
    assert Path(result["cbim_path"]).exists()
    assert Path(result["revit_plan_path"]).exists()
    assert result["ifc_path"] is None
    plan = RevitBuildPlan.model_validate_json(Path(result["revit_plan_path"]).read_text(encoding="utf-8"))
    assert plan.project_name == "Demo"
