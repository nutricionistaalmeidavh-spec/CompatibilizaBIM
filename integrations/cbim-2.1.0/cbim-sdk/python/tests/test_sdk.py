import json

import pytest
from pydantic import ValidationError

from cbim_sdk import (
    Building, CBIMDocument, CBIMProject, Door, Material, Pipe, Point3D, Relation,
    Site, Storey, System, Wall,
)


def test_complete_building_can_be_represented_and_roundtripped(tmp_path):
    doc = CBIMDocument.create("Edificio teste", origin="unit-test")
    site = doc.add_site(Site(name="Terreno"))
    building = doc.add_building(Building(name="Bloco A", site_id=site.id))
    storey = doc.add_storey(Storey(name="Terreo", building_id=building.id, elevation=0, height=2.8))
    material = doc.add_material(Material(name="Alvenaria", category="masonry"))
    system = doc.add_system(System(name="Agua fria", discipline="plumbing"))
    wall = doc.add_element(Wall(start=Point3D(x=0,y=0), end=Point3D(x=5,y=0), thickness=.14, height=2.8, storey_id=storey.id, material_ids=[material.id]))
    door = doc.add_element(Door(position=Point3D(x=2,y=0), width=.8, height=2.1, host_id=wall.id, storey_id=storey.id))
    pipe = doc.add_element(Pipe(path=[Point3D(x=0,y=1), Point3D(x=3,y=1)], diameter=.025, system_id=system.id, storey_id=storey.id))
    doc.host(wall.id, door.id)
    doc.contains(storey.id, wall.id)
    path = doc.save(tmp_path / "project.cbim.json")

    loaded = CBIMDocument.load(path)
    assert loaded.project.schema_version == "0.2.0"
    assert loaded.project.element_counts() == {"wall": 1, "door": 1, "pipe": 1}
    assert loaded.get(wall.id).length == pytest.approx(5.0)
    assert loaded.query_elements(type="pipe")[0].system_id == system.id
    assert "length" not in json.loads(path.read_text())["elements"][0]


def test_unknown_relation_reference_is_rejected():
    with pytest.raises(ValidationError):
        CBIMProject(name="bad", relations=[Relation(type="connects", from_id="missing", to_id="also-missing")])


def test_duplicate_ids_are_rejected():
    wall_a = Wall(id="wall_same", start=Point3D(x=0,y=0), end=Point3D(x=1,y=0), thickness=.1, height=2.8)
    wall_b = Wall(id="wall_same", start=Point3D(x=0,y=1), end=Point3D(x=1,y=1), thickness=.1, height=2.8)
    with pytest.raises(ValidationError):
        CBIMProject(name="bad", elements=[wall_a, wall_b])
