from __future__ import annotations

import hashlib
import json
import re
import shutil
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _atomic_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(f".{path.name}.tmp")
    tmp.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    tmp.replace(path)


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _slug(value: str) -> str:
    cleaned = re.sub(r"[^a-z0-9]+", "-", value.strip().lower()).strip("-")
    return cleaned or "project"


@dataclass(frozen=True, slots=True)
class ProjectModel:
    model_id: str
    original_name: str
    stored_path: str
    sha256: str
    size_bytes: int
    discipline: str | None
    imported_at: str


@dataclass(frozen=True, slots=True)
class Project:
    project_id: str
    name: str
    obra_id: str | None
    created_at: str
    updated_at: str
    path: Path
    models: tuple[ProjectModel, ...]


class ProjectStore:
    SCHEMA_VERSION = 1

    def __init__(self, root: Path) -> None:
        self.root = Path(root).expanduser().resolve()
        self.root.mkdir(parents=True, exist_ok=True)

    def create_project(self, name: str, *, obra_id: str | None = None) -> Project:
        name = name.strip()
        if not name:
            raise ValueError("Nome do projeto não pode ser vazio")
        created = _now()
        seed = f"{name}|{created}".encode("utf-8")
        suffix = hashlib.sha256(seed).hexdigest()[:8]
        project_id = f"{_slug(name)}-{suffix}"
        project_dir = self.root / project_id
        if project_dir.exists():
            raise ValueError(f"Projeto já existe: {project_id}")
        for folder in ("models", "cache", "reports", "logs", "costs"):
            (project_dir / folder).mkdir(parents=True, exist_ok=True)
        payload = {
            "schema_version": self.SCHEMA_VERSION,
            "project_id": project_id,
            "name": name,
            "obra_id": obra_id.strip() if isinstance(obra_id, str) and obra_id.strip() else None,
            "created_at": created,
            "updated_at": created,
            "models": [],
        }
        _atomic_json(project_dir / "project.json", payload)
        for filename, default in (
            ("issues.json", {"schema_version": 1, "issues": []}),
            ("revisions.json", {"schema_version": 1, "revisions": []}),
            ("jobs.json", {"schema_version": 1, "jobs": []}),
            ("schedule.json", {"schema_version": 1, "updated_at": None, "activities": []}),
            ("measurements.json", {"schema_version": 1, "updated_at": None, "batches": []}),
        ):
            _atomic_json(project_dir / filename, default)
        return self.get_project(project_id)

    def list_projects(self) -> tuple[Project, ...]:
        projects: list[Project] = []
        for path in sorted(self.root.iterdir()):
            if path.is_dir() and (path / "project.json").is_file():
                projects.append(self._load_project(path))
        return tuple(projects)

    def get_project(self, project_id: str) -> Project:
        project_id = _validate_project_id(project_id)
        path = (self.root / project_id).resolve()
        if path.parent != self.root:
            raise ValueError("project_id inválido")
        if not path.is_dir() or not (path / "project.json").is_file():
            raise KeyError(f"Projeto não encontrado: {project_id}")
        return self._load_project(path)

    def add_model(
        self,
        project_id: str,
        source: Path,
        *,
        discipline: str | None = None,
    ) -> ProjectModel:
        source = Path(source)
        if not source.is_file():
            raise ValueError(f"Arquivo não encontrado: {source}")
        if source.suffix.lower() != ".ifc":
            raise ValueError("Somente arquivos .ifc podem ser importados")

        project = self.get_project(project_id)
        digest = _sha256(source)
        for model in project.models:
            if model.sha256 == digest:
                return model

        model_id = f"MODEL-{digest[:12].upper()}"
        safe_name = re.sub(r"[^A-Za-z0-9._-]+", "_", source.name)
        destination = project.path / "models" / f"{model_id}_{safe_name}"
        shutil.copy2(source, destination)
        imported_at = _now()
        record = ProjectModel(
            model_id=model_id,
            original_name=source.name,
            stored_path=str(destination),
            sha256=digest,
            size_bytes=destination.stat().st_size,
            discipline=discipline.strip() if isinstance(discipline, str) and discipline.strip() else None,
            imported_at=imported_at,
        )
        payload = self._read_payload(project.path)
        payload.setdefault("models", []).append(_model_to_json(record))
        payload["updated_at"] = imported_at
        _atomic_json(project.path / "project.json", payload)
        return record

    def _read_payload(self, project_dir: Path) -> dict[str, Any]:
        payload = json.loads((project_dir / "project.json").read_text(encoding="utf-8"))
        if payload.get("schema_version") != self.SCHEMA_VERSION:
            raise ValueError("Versão de projeto não suportada")
        return payload

    def _load_project(self, project_dir: Path) -> Project:
        payload = self._read_payload(project_dir)
        rows = payload.get("models")
        if not isinstance(rows, list):
            raise ValueError(f"project.json inválido: {project_dir}")
        return Project(
            project_id=str(payload["project_id"]),
            name=str(payload["name"]),
            obra_id=payload.get("obra_id") or None,
            created_at=str(payload["created_at"]),
            updated_at=str(payload["updated_at"]),
            path=project_dir,
            models=tuple(_model_from_json(row) for row in rows),
        )


def _model_to_json(model: ProjectModel) -> dict[str, Any]:
    return {
        "model_id": model.model_id,
        "original_name": model.original_name,
        "stored_path": model.stored_path,
        "sha256": model.sha256,
        "size_bytes": model.size_bytes,
        "discipline": model.discipline,
        "imported_at": model.imported_at,
    }


def _model_from_json(row: dict[str, Any]) -> ProjectModel:
    return ProjectModel(
        model_id=str(row["model_id"]),
        original_name=str(row["original_name"]),
        stored_path=str(row["stored_path"]),
        sha256=str(row["sha256"]),
        size_bytes=int(row["size_bytes"]),
        discipline=row.get("discipline") or None,
        imported_at=str(row["imported_at"]),
    )


def _validate_project_id(project_id: str) -> str:
    value = str(project_id).strip()
    if not value or value in {".", ".."} or "/" in value or "\\" in value:
        raise ValueError("project_id inválido")
    if not re.fullmatch(r"[A-Za-z0-9._-]+", value):
        raise ValueError("project_id inválido")
    return value
