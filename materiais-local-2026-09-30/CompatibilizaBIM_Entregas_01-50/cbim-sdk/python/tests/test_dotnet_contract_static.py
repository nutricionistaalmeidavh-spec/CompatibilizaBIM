from pathlib import Path


def test_dotnet_contract_declares_same_schema_and_all_polymorphic_types():
    root = Path(__file__).parents[2] / "dotnet" / "CBIM.Sdk"
    text = (root / "Models.cs").read_text(encoding="utf-8")
    assert 'SchemaVersion = "0.2.0"' in text
    for kind in ["wall","column","beam","slab","door","window","space","pipe","fitting","equipment","stair","sanitary_terminal","furniture","opening"]:
        assert f'"{kind}"' in text
    assert '[JsonPropertyName("schema_version")]' in text
    assert '[property: JsonPropertyName("x")]' in text
    assert '[property: JsonPropertyName("y")]' in text
    assert '[property: JsonPropertyName("z")]' in text
