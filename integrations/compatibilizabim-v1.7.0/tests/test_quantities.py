from __future__ import annotations

from types import SimpleNamespace

from compatibilizabim.quantities import extract_element_quantities, geometry_fallback_records, summarize_quantities


class Entity(SimpleNamespace):
    def __init__(self, ifc_class, **kwargs):
        super().__init__(**kwargs); self._ifc_class = ifc_class
    def is_a(self): return self._ifc_class


def test_extracts_and_scales_ifc_qto_values():
    length = Entity("IfcQuantityLength", Name="Length", LengthValue=2000.0)
    area = Entity("IfcQuantityArea", Name="NetArea", AreaValue=2_000_000.0)
    qset = Entity("IfcElementQuantity", Quantities=[length, area])
    rel = SimpleNamespace(RelatingPropertyDefinition=qset)
    storey = Entity("IfcBuildingStorey", Name="Térreo")
    contained = SimpleNamespace(RelatingStructure=storey)
    typ = SimpleNamespace(Name="Parede 14cm", HasPropertySets=[])
    typed = SimpleNamespace(RelatingType=typ)
    element = Entity("IfcWall", GlobalId="W1", Name="Parede 1", IsDefinedBy=[rel], IsTypedBy=[typed], ContainedInStructure=[contained], HasAssociations=[])

    rows = extract_element_quantities(element, source_file="arc.ifc", discipline="Architecture", unit_scale_m=0.001)

    assert [(r.kind, round(r.value, 4), r.unit) for r in rows] == [("length", 2.0, "m"), ("area", 2.0, "m2")]
    assert rows[0].storey == "Térreo" and rows[0].type_name == "Parede 14cm"


def test_geometry_fallback_computes_area_and_closed_volume():
    # tetrahedron with volume 1/6
    mesh = {
        "source_file":"x.ifc","discipline":"Structure","global_id":"T1","ifc_class":"IfcSlab","name":"Tetra",
        "vertices":[0,0,0, 1,0,0, 0,1,0, 0,0,1],
        "triangles":[0,2,1, 0,1,3, 0,3,2, 1,2,3],
    }
    rows = geometry_fallback_records(mesh)
    values = {r.kind:r.value for r in rows}
    assert round(values["volume"], 6) == round(1/6, 6)
    assert values["area"] > 2.0


def test_summary_groups_matching_quantities_and_counts_elements():
    mesh1={"source_file":"x","discipline":"MEP","global_id":"A","ifc_class":"IfcPipeSegment","vertices":[0,0,0,1,0,0,0,1,0],"triangles":[0,1,2]}
    mesh2=dict(mesh1, global_id="B")
    rows=geometry_fallback_records(mesh1)+geometry_fallback_records(mesh2)
    groups=summarize_quantities(rows)
    area=next(g for g in groups if g.kind=="area")
    assert area.element_count==2
    assert round(area.value,3)==1.0


def test_quantity_engine_uses_qto_and_only_missing_geometry_kinds(tmp_path):
    from compatibilizabim.quantities import QuantityEngine
    q = Entity("IfcQuantityArea", Name="NetArea", AreaValue=4.0)
    element = Entity("IfcWall", GlobalId="W1", Name="W", IsDefinedBy=[SimpleNamespace(RelatingPropertyDefinition=Entity("IfcElementQuantity", Quantities=[q]))], IsTypedBy=[], ContainedInStructure=[], HasAssociations=[])
    class Backend:
        def open_model(self, path): return object()
        def iter_elements(self, model): return [element]
        def quantity_unit_scale(self, model): return 1.0
        def extract_meshes(self, model, path, discipline, max_elements=None):
            return [{"source_file":path.name,"discipline":discipline,"global_id":"W1","ifc_class":"IfcWall","vertices":[0,0,0,1,0,0,0,1,0,0,0,1],"triangles":[0,2,1,0,1,3,0,3,2,1,2,3]}]
    rows=QuantityEngine(Backend()).extract([tmp_path/"arc.ifc"])
    assert len([r for r in rows if r.kind=="area"]) == 1
    assert len([r for r in rows if r.kind=="volume"]) == 1
