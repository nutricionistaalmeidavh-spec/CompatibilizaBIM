from __future__ import annotations

import hashlib
import json
import os
import shutil
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from pydantic import BaseModel, ConfigDict, Field
from cbim_sdk import CBIMProject
from compatibilizabim_core.product.models import ImportPlan, ProjectConfiguration
from compatibilizabim_core.product.canonical import CanonicalProjectState, build_canonical_project_state


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _atomic_write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp_name = tempfile.mkstemp(prefix=f'.{path.name}.', suffix='.tmp', dir=path.parent)
    try:
        with os.fdopen(fd, 'w', encoding='utf-8') as f:
            f.write(text)
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp_name, path)
    finally:
        if os.path.exists(tmp_name):
            os.unlink(tmp_name)


def _persistent_json(model: BaseModel) -> str:
    return model.model_dump_json(by_alias=True, exclude_computed_fields=True, indent=2)


class WorkspaceModel(BaseModel):
    model_config = ConfigDict(extra='forbid')


class WorkspaceManifest(WorkspaceModel):
    workspace_version: str = '1.0.0'
    project_id: str
    project_name: str
    created_at: datetime = Field(default_factory=_utcnow)
    updated_at: datetime = Field(default_factory=_utcnow)
    revision: int = 0
    project_file: str = 'project/project.cbim.json'
    import_plan_file: str = 'project/import-plan.json'
    config_file: str = 'project/config.json'
    profile_file: str | None = None
    latest_report_file: str | None = None


class WorkspaceStatus(WorkspaceModel):
    root: str
    project_id: str
    project_name: str
    revision: int
    project_sha256: str
    source_count: int
    has_profile: bool
    has_report: bool


class WorkspaceStore:
    """Crash-safe on-disk workspace for a CompatibilizaBIM project.

    The workspace is a directory, not a database. Files remain inspectable and can be
    backed up with ordinary filesystem tooling. All authoritative writes are atomic.
    """

    def __init__(self, root: str | Path):
        self.root = Path(root)
        self.manifest_path = self.root / 'workspace.json'

    @classmethod
    def create(
        cls,
        root: str | Path,
        project: CBIMProject,
        import_plan: ImportPlan,
        config: ProjectConfiguration | None = None,
        *,
        overwrite: bool = False,
    ) -> 'WorkspaceStore':
        store = cls(root)
        if store.root.exists() and any(store.root.iterdir()) and not overwrite:
            raise FileExistsError(f'Workspace is not empty: {store.root}')
        store.root.mkdir(parents=True, exist_ok=True)
        for folder in ('project', 'revisions', 'autosave', 'reports', 'profiles', 'logs'):
            (store.root / folder).mkdir(exist_ok=True)
        manifest = WorkspaceManifest(project_id=project.id, project_name=project.name)
        _atomic_write_text(store.manifest_path, manifest.model_dump_json(indent=2))
        store.save_project(project, bump_revision=False)
        store.save_import_plan(import_plan)
        store.save_config(config or import_plan.config)
        return store

    def manifest(self) -> WorkspaceManifest:
        return WorkspaceManifest.model_validate_json(self.manifest_path.read_text(encoding='utf-8'))

    def _save_manifest(self, manifest: WorkspaceManifest) -> None:
        _atomic_write_text(self.manifest_path, manifest.model_dump_json(indent=2))

    def project_path(self) -> Path:
        return self.root / self.manifest().project_file

    def save_project(self, project: CBIMProject, *, bump_revision: bool = True) -> Path:
        manifest = self.manifest()
        if manifest.project_id != project.id:
            raise ValueError('Project id does not match workspace')
        path = self.root / manifest.project_file
        _atomic_write_text(path, _persistent_json(project))
        update = {'project_name': project.name, 'updated_at': _utcnow()}
        if bump_revision:
            update['revision'] = manifest.revision + 1
        self._save_manifest(manifest.model_copy(update=update))
        return path

    def load_project(self) -> CBIMProject:
        return CBIMProject.model_validate_json(self.project_path().read_text(encoding='utf-8'))

    def canonical_state(self) -> CanonicalProjectState:
        manifest = self.manifest()
        return build_canonical_project_state(self.load_project(), revision=manifest.revision)

    def save_import_plan(self, plan: ImportPlan) -> Path:
        manifest = self.manifest()
        path = self.root / manifest.import_plan_file
        _atomic_write_text(path, plan.model_dump_json(indent=2))
        self._save_manifest(manifest.model_copy(update={'updated_at': _utcnow()}))
        return path

    def load_import_plan(self) -> ImportPlan:
        manifest = self.manifest()
        return ImportPlan.model_validate_json((self.root / manifest.import_plan_file).read_text(encoding='utf-8'))

    def save_config(self, config: ProjectConfiguration) -> Path:
        manifest = self.manifest()
        path = self.root / manifest.config_file
        _atomic_write_text(path, config.model_dump_json(indent=2))
        self._save_manifest(manifest.model_copy(update={'updated_at': _utcnow()}))
        return path

    def load_config(self) -> ProjectConfiguration:
        manifest = self.manifest()
        return ProjectConfiguration.model_validate_json((self.root / manifest.config_file).read_text(encoding='utf-8'))

    def save_profile(self, profile: dict[str, Any], name: str = 'cad-profile.json') -> Path:
        path = self.root / 'profiles' / name
        _atomic_write_text(path, json.dumps(profile, ensure_ascii=False, indent=2, sort_keys=True))
        manifest = self.manifest().model_copy(update={'profile_file': str(path.relative_to(self.root)), 'updated_at': _utcnow()})
        self._save_manifest(manifest)
        return path

    def save_report(self, report: BaseModel | dict[str, Any], name: str = 'latest.json') -> Path:
        path = self.root / 'reports' / name
        if isinstance(report, BaseModel):
            text = report.model_dump_json(indent=2)
        else:
            text = json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True)
        _atomic_write_text(path, text)
        manifest = self.manifest().model_copy(update={'latest_report_file': str(path.relative_to(self.root)), 'updated_at': _utcnow()})
        self._save_manifest(manifest)
        return path

    def create_revision_snapshot(self, label: str | None = None) -> Path:
        manifest = self.manifest()
        project = self.load_project()
        safe = ''.join(ch if ch.isalnum() or ch in '-_' else '-' for ch in (label or 'snapshot')).strip('-') or 'snapshot'
        path = self.root / 'revisions' / f'r{manifest.revision:05d}-{safe}.cbim.json'
        _atomic_write_text(path, _persistent_json(project))
        return path

    def export_backup(self, output: str | Path) -> Path:
        output = Path(output)
        output.parent.mkdir(parents=True, exist_ok=True)
        base = output.with_suffix('')
        archive = shutil.make_archive(str(base), 'zip', root_dir=self.root)
        final = Path(archive)
        if final != output:
            if output.exists():
                output.unlink()
            final.replace(output)
        return output

    def status(self) -> WorkspaceStatus:
        manifest = self.manifest()
        project_bytes = self.project_path().read_bytes()
        plan = self.load_import_plan()
        return WorkspaceStatus(
            root=str(self.root),
            project_id=manifest.project_id,
            project_name=manifest.project_name,
            revision=manifest.revision,
            project_sha256=hashlib.sha256(project_bytes).hexdigest(),
            source_count=len(plan.enabled_sources()),
            has_profile=bool(manifest.profile_file),
            has_report=bool(manifest.latest_report_file),
        )
