from __future__ import annotations

from pathlib import Path

from compatibilizabim.workspace import ProjectStore


def test_project_store_creates_reopens_and_deduplicates_models(tmp_path: Path) -> None:
    source = tmp_path / "structure.ifc"
    source.write_text("ISO-10303-21;\nEND-ISO-10303-21;\n", encoding="utf-8")

    store = ProjectStore(tmp_path / "data")
    project = store.create_project("Residencial Alameda", obra_id="OBRA-001")

    assert project.name == "Residencial Alameda"
    assert project.obra_id == "OBRA-001"
    assert project.path.joinpath("models").is_dir()
    assert project.path.joinpath("cache").is_dir()
    assert project.path.joinpath("reports").is_dir()
    assert project.path.joinpath("logs").is_dir()

    first = store.add_model(project.project_id, source, discipline="Structure")
    second = store.add_model(project.project_id, source, discipline="Structure")

    assert first.model_id == second.model_id
    assert first.sha256 == second.sha256
    assert len(store.get_project(project.project_id).models) == 1
    assert Path(first.stored_path).exists()

    reopened = ProjectStore(tmp_path / "data").get_project(project.project_id)
    assert reopened.name == "Residencial Alameda"
    assert reopened.models[0].original_name == "structure.ifc"


def test_project_store_rejects_non_ifc_model(tmp_path: Path) -> None:
    source = tmp_path / "notes.txt"
    source.write_text("x", encoding="utf-8")
    store = ProjectStore(tmp_path / "data")
    project = store.create_project("P")

    try:
        store.add_model(project.project_id, source)
    except ValueError as exc:
        assert ".ifc" in str(exc)
    else:
        raise AssertionError("expected ValueError")


def test_project_store_rejects_path_traversal_project_id(tmp_path: Path) -> None:
    outside = tmp_path / "outside"
    outside.mkdir()
    outside.joinpath("project.json").write_text(
        '{"schema_version":1,"project_id":"outside","name":"Outside","obra_id":null,'
        '"created_at":"x","updated_at":"x","models":[]}',
        encoding="utf-8",
    )
    store = ProjectStore(tmp_path / "data")
    try:
        store.get_project("../outside")
    except (KeyError, ValueError):
        pass
    else:
        raise AssertionError("path traversal project id must be rejected")
