from cbim_sdk import CBIMProject, generate_schema


def test_schema_exposes_all_required_element_types():
    schema = generate_schema()
    defs = schema["$defs"]
    required = {"Wall", "Column", "Beam", "Slab", "Door", "Window", "Space", "Pipe", "Fitting", "Equipment", "Opening", "Stair", "SanitaryTerminal", "Furniture", "Material", "System", "Site", "Building", "Storey", "Relation"}
    assert required <= set(defs)


def test_schema_version_default_is_current():
    assert CBIMProject(name="x").schema_version == "0.2.0"
