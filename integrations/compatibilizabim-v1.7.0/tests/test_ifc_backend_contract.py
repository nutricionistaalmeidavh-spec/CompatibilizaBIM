from compatibilizabim.ifc_backend import IfcOpenShellBackend


class FakeEntity:
    def __init__(self, gid, ifc_class, name):
        self.values = [gid, None, name]
        self.ifc_class = ifc_class

    def get_argument(self, index):
        return self.values[index]

    def is_a(self):
        return self.ifc_class


class FakeClash:
    def __init__(self):
        self.a = FakeEntity("GA", "IfcPipeSegment", "Pipe A")
        self.b = FakeEntity("GB", "IfcBeam", "Beam B")
        self.clash_type = 1
        self.p1 = (1.0, 2.0, 3.0)
        self.p2 = (1.0, 2.0, 3.1)
        self.distance = 0.1


def test_normalize_native_clash_extracts_ifc_metadata():
    result = IfcOpenShellBackend.normalize_native_clash(FakeClash())

    assert result == {
        "a_global_id": "GA",
        "b_global_id": "GB",
        "a_ifc_class": "IfcPipeSegment",
        "b_ifc_class": "IfcBeam",
        "a_name": "Pipe A",
        "b_name": "Beam B",
        "clash_type": "pierce",
        "p1": [1.0, 2.0, 3.0],
        "p2": [1.0, 2.0, 3.1],
        "distance": 0.1,
    }


class FakeTree:
    def __init__(self):
        self.calls = []

    def clash_intersection_many(self, a, b, tolerance, check_all):
        self.calls.append(("intersection", tolerance, check_all))
        return [FakeClash()]

    def clash_collision_many(self, a, b, allow_touching=False):
        self.calls.append(("collision", allow_touching))
        return [FakeClash()]

    def clash_clearance_many(self, a, b, clearance, check_all):
        self.calls.append(("clearance", clearance, check_all))
        return [FakeClash()]


def test_find_clashes_dispatches_intersection_with_tolerance():
    backend = IfcOpenShellBackend()
    tree = FakeTree()

    results = backend.find_clashes(
        tree, ["a"], ["b"], "intersection", 0.003, 0.05, False
    )

    assert tree.calls == [("intersection", 0.003, False)]
    assert results[0]["a_global_id"] == "GA"


def test_find_clashes_dispatches_clearance_with_distance():
    backend = IfcOpenShellBackend()
    tree = FakeTree()

    backend.find_clashes(tree, ["a"], ["b"], "clearance", 0.002, 0.12, True)

    assert tree.calls == [("clearance", 0.12, True)]

class FakeStorey:
    def __init__(self, name):
        self.Name = name


class FakeModel:
    schema = "IFC4"

    def by_type(self, name):
        mapping = {
            "IfcElement": [object(), object(), object()],
            "IfcBuildingStorey": [FakeStorey("Térreo"), FakeStorey("Pavimento 1")],
            "IfcWall": [object(), object()],
            "IfcDoor": [object()],
            "IfcWindow": [],
            "IfcRoof": [],
            "IfcStair": [],
            "IfcBeam": [],
            "IfcColumn": [],
            "IfcFooting": [],
            "IfcMember": [],
            "IfcPipeSegment": [],
            "IfcPipeFitting": [],
            "IfcDuctSegment": [],
            "IfcDuctFitting": [],
            "IfcCableCarrierSegment": [],
            "IfcCableSegment": [],
        }
        return mapping.get(name, [])


class FakeSettings:
    def __init__(self):
        self.values = {}

    def set(self, key, value):
        self.values[key] = value


class FakeGeometry:
    def __init__(self, verts):
        self.verts = verts


class FakeShape:
    def __init__(self, verts):
        self.geometry = FakeGeometry(verts)


class FakeIterator:
    def __init__(self):
        self.shapes = [
            FakeShape((0.0, 0.0, 0.0, 2.0, 4.0, 6.0)),
            FakeShape((-1.0, 1.0, 2.0, 5.0, 3.0, 8.0)),
        ]
        self.index = 0

    def initialize(self):
        return True

    def get(self):
        return self.shapes[self.index]

    def next(self):
        self.index += 1
        return self.index < len(self.shapes)


class FakeGeomModule:
    def __init__(self):
        self.last_settings = None

    def settings(self):
        self.last_settings = FakeSettings()
        return self.last_settings

    def iterator(self, settings, model, num_threads=1):
        return FakeIterator()


class FakeUnitModule:
    @staticmethod
    def calculate_unit_scale(model):
        return 0.001


def test_inspect_model_extracts_metadata_and_world_bbox(tmp_path):
    backend = IfcOpenShellBackend()
    fake_geom = FakeGeomModule()
    backend._ifcopenshell = object()
    backend._geom = fake_geom
    backend._unit = FakeUnitModule()

    metadata = backend.inspect_model(FakeModel(), tmp_path / "model.ifc")

    assert metadata["schema"] == "IFC4"
    assert metadata["unit_scale_m"] == 0.001
    assert metadata["element_count"] == 3
    assert metadata["geometry_count"] == 2
    assert metadata["storeys"] == ("Térreo", "Pavimento 1")
    assert metadata["class_counts"]["IfcWall"] == 2
    assert metadata["bbox"].minimum == (-1.0, 0.0, 0.0)
    assert metadata["bbox"].maximum == (5.0, 4.0, 8.0)
    assert fake_geom.last_settings.values["use-world-coords"] is True


class FakeProduct:
    def __init__(self, gid, ifc_class, name):
        self.GlobalId = gid
        self.Name = name
        self._ifc_class = ifc_class

    def is_a(self):
        return self._ifc_class


class FakeViewerModel:
    def __init__(self):
        self.products = {
            "GUID-1": FakeProduct("GUID-1", "IfcWall", "Parede 1"),
            "GUID-2": FakeProduct("GUID-2", "IfcPipeSegment", "Tubo 1"),
        }

    def by_guid(self, guid):
        return self.products[guid]


class FakeViewerGeometry:
    def __init__(self, verts, faces):
        self.verts = verts
        self.faces = faces


class FakeViewerShape:
    def __init__(self, guid, verts, faces):
        self.guid = guid
        self.geometry = FakeViewerGeometry(verts, faces)


class FakeViewerIterator:
    def __init__(self):
        self.shapes = [
            FakeViewerShape("GUID-1", (0, 0, 0, 1, 0, 0, 0, 1, 0), (0, 1, 2)),
            FakeViewerShape("GUID-2", (1, 1, 0, 2, 1, 0, 1, 2, 0), (0, 1, 2)),
        ]
        self.index = 0

    def initialize(self):
        return True

    def get(self):
        return self.shapes[self.index]

    def next(self):
        self.index += 1
        return self.index < len(self.shapes)


class FakeViewerGeomModule(FakeGeomModule):
    def iterator(self, settings, model, num_threads=1):
        return FakeViewerIterator()


def test_extract_meshes_preserves_guid_class_name_and_world_coordinates(tmp_path):
    backend = IfcOpenShellBackend()
    fake_geom = FakeViewerGeomModule()
    backend._ifcopenshell = object()
    backend._geom = fake_geom

    meshes = backend.extract_meshes(
        FakeViewerModel(), tmp_path / "arc.ifc", "Architecture", max_elements=1
    )

    assert len(meshes) == 1
    assert meshes[0] == {
        "global_id": "GUID-1",
        "ifc_class": "IfcWall",
        "name": "Parede 1",
        "discipline": "Architecture",
        "source_file": "arc.ifc",
        "vertices": (0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0, 0.0),
        "triangles": (0, 1, 2),
    }
    assert fake_geom.last_settings.values["use-world-coords"] is True
