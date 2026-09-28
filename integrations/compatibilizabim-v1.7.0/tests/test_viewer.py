import json
from pathlib import Path

from compatibilizabim.models import ClashResult
from compatibilizabim.rules import RuleClash
from compatibilizabim.viewer import MeshElement, ViewerEngine, ViewerSession, viewer_manifest


class FakeViewerBackend:
    def __init__(self, meshes_by_file):
        self.meshes_by_file = meshes_by_file
        self.opened = []

    def open_model(self, path: Path):
        self.opened.append(path.name)
        return {"file": path.name}

    def extract_meshes(self, model, path: Path, discipline: str, *, max_elements=None):
        rows = self.meshes_by_file[path.name]
        return rows if max_elements is None else rows[:max_elements]


def test_viewer_engine_builds_federated_session_with_global_origin(tmp_path):
    arc = tmp_path / "Projeto_ARC.ifc"
    mep = tmp_path / "Projeto_MEP.ifc"
    arc.write_text("arc", encoding="utf-8")
    mep.write_text("mep", encoding="utf-8")

    backend = FakeViewerBackend(
        {
            arc.name: [
                {
                    "global_id": "ARC-1",
                    "ifc_class": "IfcWall",
                    "name": "Parede 01",
                    "vertices": (1000.0, 2000.0, 0.0, 1010.0, 2000.0, 0.0, 1000.0, 2010.0, 10.0),
                    "triangles": (0, 1, 2),
                }
            ],
            mep.name: [
                {
                    "global_id": "MEP-1",
                    "ifc_class": "IfcPipeSegment",
                    "name": "Tubo 01",
                    "vertices": (1004.0, 2004.0, 4.0, 1006.0, 2004.0, 4.0, 1004.0, 2006.0, 6.0),
                    "triangles": (0, 1, 2),
                }
            ],
        }
    )

    session = ViewerEngine(backend).build([arc, mep])

    assert backend.opened == [arc.name, mep.name]
    assert len(session.elements) == 2
    assert session.elements[0].discipline == "Architecture"
    assert session.elements[1].discipline == "MEP"
    assert session.origin == (1005.0, 2005.0, 5.0)
    assert session.bounds.minimum == (1000.0, 2000.0, 0.0)
    assert session.bounds.maximum == (1010.0, 2010.0, 10.0)


def test_viewer_manifest_recenters_vertices_and_preserves_clash_metadata():
    element_a = MeshElement(
        global_id="A",
        ifc_class="IfcPipeSegment",
        name="Tubo",
        discipline="MEP",
        source_file="mep.ifc",
        vertices=(10.0, 20.0, 30.0, 12.0, 20.0, 30.0, 10.0, 22.0, 30.0),
        triangles=(0, 1, 2),
    )
    element_b = MeshElement(
        global_id="B",
        ifc_class="IfcBeam",
        name="Viga",
        discipline="Structure",
        source_file="str.ifc",
        vertices=(8.0, 18.0, 28.0, 14.0, 18.0, 28.0, 8.0, 24.0, 32.0),
        triangles=(0, 1, 2),
    )
    clash = RuleClash(
        rule_id="pipe-beam",
        rule_name="Tubo x Viga",
        severity="critical",
        clash=ClashResult(
            index=1,
            mode="intersection",
            a_global_id="A",
            b_global_id="B",
            a_ifc_class="IfcPipeSegment",
            b_ifc_class="IfcBeam",
            a_name="Tubo",
            b_name="Viga",
            clash_type="pierce",
            p1=(10.0, 20.0, 30.0),
            p2=(10.2, 20.2, 30.2),
            point=(10.1, 20.1, 30.1),
            depth_m=0.08,
        ),
    )
    session = ViewerSession.from_elements((element_a, element_b), clashes=(clash,))

    manifest = viewer_manifest(session)

    assert manifest["origin"] == [11.0, 21.0, 30.0]
    assert manifest["elements"][0]["vertices"][:3] == [-1.0, -1.0, 0.0]
    assert manifest["clashes"][0]["a_global_id"] == "A"
    assert manifest["clashes"][0]["b_global_id"] == "B"
    assert manifest["clashes"][0]["severity"] == "critical"
    assert manifest["clashes"][0]["point"] == [-0.9, -0.9, 0.1]


def test_viewer_manifest_is_json_serializable():
    session = ViewerSession.from_elements(
        (
            MeshElement(
                global_id="A",
                ifc_class="IfcWall",
                name=None,
                discipline="Architecture",
                source_file="arc.ifc",
                vertices=(0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0, 0.0),
                triangles=(0, 1, 2),
            ),
        )
    )

    json.dumps(viewer_manifest(session), ensure_ascii=False)


def test_load_rule_clashes_rehydrates_rules_report(tmp_path):
    from compatibilizabim.viewer import load_rule_clashes

    report = tmp_path / "rules.json"
    report.write_text(
        json.dumps(
            {
                "clashes": [
                    {
                        "rule_id": "pipe-beam",
                        "rule_name": "Tubo x Viga",
                        "severity": "critical",
                        "index": 3,
                        "mode": "intersection",
                        "a_global_id": "A",
                        "b_global_id": "B",
                        "a_ifc_class": "IfcPipeSegment",
                        "b_ifc_class": "IfcBeam",
                        "a_name": "Tubo",
                        "b_name": "Viga",
                        "clash_type": "pierce",
                        "point": [1.0, 2.0, 3.0],
                        "depth_m": 0.05,
                    }
                ]
            }
        ),
        encoding="utf-8",
    )

    clashes = load_rule_clashes(report)

    assert len(clashes) == 1
    assert clashes[0].rule_id == "pipe-beam"
    assert clashes[0].severity == "critical"
    assert clashes[0].clash.point == (1.0, 2.0, 3.0)
    assert clashes[0].clash.depth_m == 0.05
