from pathlib import Path

from compatibilizabim.rules import ClashRule, RuleEngine, get_preset


class FakeBackend:
    def __init__(self):
        self.open_calls = []
        self.tree_calls = 0
        self.find_calls = []

    def open_model(self, path: Path):
        self.open_calls.append(path.name)
        return {"path": path.name}

    def select_elements(self, model, ifc_class: str):
        return [f"{model['path']}::{ifc_class}"]

    def build_tree(self, models):
        self.tree_calls += 1
        return "tree"

    def find_clashes(self, tree, group_a, group_b, mode, tolerance, clearance, check_all):
        self.find_calls.append((group_a[0], group_b[0], mode, tolerance, clearance, check_all))
        return [
            {
                "a_global_id": "A1",
                "b_global_id": "B1",
                "a_ifc_class": group_a[0].split("::")[-1],
                "b_ifc_class": group_b[0].split("::")[-1],
                "a_name": "MEP 1",
                "b_name": "Structure 1",
                "clash_type": "pierce",
                "p1": [1.0, 2.0, 3.0],
                "p2": [1.0, 2.0, 3.05],
                "distance": 0.05,
            }
        ]


def test_mep_structure_preset_contains_core_rules():
    rules = get_preset("mep-structure")
    pairs = {(rule.class_a, rule.class_b) for rule in rules}

    assert ("IfcPipeSegment", "IfcBeam") in pairs
    assert ("IfcDuctSegment", "IfcColumn") in pairs
    assert ("IfcCableCarrierSegment", "IfcSlab") in pairs
    assert all(rule.mode == "intersection" for rule in rules)


def test_rule_engine_opens_models_once_and_deduplicates_same_guid_pair(tmp_path):
    a = tmp_path / "mep.ifc"
    b = tmp_path / "structure.ifc"
    a.write_text("a", encoding="utf-8")
    b.write_text("b", encoding="utf-8")
    backend = FakeBackend()
    rules = (
        ClashRule("r1", "Pipe x Beam", "IfcPipeSegment", "IfcBeam", severity="high"),
        ClashRule("r2", "Pipe x Column", "IfcPipeSegment", "IfcColumn", severity="critical"),
    )

    report = RuleEngine(backend).run(a, b, rules)

    assert backend.open_calls == ["mep.ifc", "structure.ifc"]
    assert backend.tree_calls == 1
    assert len(backend.find_calls) == 2
    assert report.raw_clash_count == 2
    assert report.unique_clash_count == 1
    assert len(report.clashes) == 1
    assert report.clashes[0].rule_id == "r2"
    assert report.clashes[0].severity == "critical"
    assert report.clashes[0].clash.a_global_id == "A1"
