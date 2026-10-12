from __future__ import annotations

import hashlib
import json
import os
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from pydantic import BaseModel, ConfigDict, Field
from cbim_sdk import CBIMProject
from .workspace import WorkspaceStore


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _atomic(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(prefix='autosave-', suffix='.tmp', dir=path.parent)
    try:
        with os.fdopen(fd, 'w', encoding='utf-8') as f:
            f.write(text); f.flush(); os.fsync(f.fileno())
        os.replace(tmp, path)
    finally:
        if os.path.exists(tmp): os.unlink(tmp)


class RecoveryModel(BaseModel):
    model_config=ConfigDict(extra='forbid')


class SessionState(RecoveryModel):
    session_id: str = Field(default_factory=lambda: uuid4().hex)
    started_at: datetime = Field(default_factory=_now)
    clean_shutdown: bool = False
    last_autosave: str | None = None
    last_autosave_sha256: str | None = None
    recovery_autosaves: list[str] = Field(default_factory=list)


class RecoveryCandidate(RecoveryModel):
    path: str
    created_at: datetime
    sha256: str
    project_id: str
    project_name: str


class AutosaveManager:
    def __init__(self, workspace: WorkspaceStore, *, retain: int = 8):
        if retain < 1: raise ValueError('retain must be >= 1')
        self.workspace=workspace; self.retain=retain
        self.session_path=workspace.root/'autosave'/'session.json'
        self.autosave_dir=workspace.root/'autosave'/'snapshots'
        self.autosave_dir.mkdir(parents=True,exist_ok=True)

    def begin_session(self) -> SessionState:
        previous=self.session()
        recoverable=[]
        if previous and not previous.clean_shutdown and previous.last_autosave:
            recoverable=[previous.last_autosave]
        state=SessionState(recovery_autosaves=recoverable)
        _atomic(self.session_path,state.model_dump_json(indent=2))
        return state

    def session(self) -> SessionState | None:
        if not self.session_path.exists(): return None
        return SessionState.model_validate_json(self.session_path.read_text(encoding='utf-8'))

    def autosave(self, project: CBIMProject) -> Path | None:
        payload=project.model_dump_json(by_alias=True,exclude_computed_fields=True,indent=2)
        digest=hashlib.sha256(payload.encode()).hexdigest()
        state=self.session() or self.begin_session()
        if state.last_autosave_sha256==digest:
            return None
        stamp=_now().strftime('%Y%m%dT%H%M%S%fZ')
        path=self.autosave_dir/f'{stamp}-{digest[:12]}.cbim.json'
        _atomic(path,payload)
        state=state.model_copy(update={'last_autosave':str(path.relative_to(self.workspace.root)),'last_autosave_sha256':digest})
        _atomic(self.session_path,state.model_dump_json(indent=2))
        files=sorted(self.autosave_dir.glob('*.cbim.json'))
        for old in files[:-self.retain]: old.unlink(missing_ok=True)
        return path

    def mark_clean_shutdown(self) -> None:
        state=self.session() or self.begin_session()
        _atomic(self.session_path,state.model_copy(update={'clean_shutdown':True}).model_dump_json(indent=2))

    def recovery_candidates(self) -> list[RecoveryCandidate]:
        state=self.session()
        if state is None or state.clean_shutdown: return []
        out=[]
        allowed={str((self.workspace.root/path).resolve()) for path in state.recovery_autosaves}
        for path in sorted(self.autosave_dir.glob('*.cbim.json'),reverse=True):
            if str(path.resolve()) not in allowed: continue
            raw=path.read_bytes(); project=CBIMProject.model_validate_json(raw)
            out.append(RecoveryCandidate(path=str(path),created_at=datetime.fromtimestamp(path.stat().st_mtime,tz=timezone.utc),sha256=hashlib.sha256(raw).hexdigest(),project_id=project.id,project_name=project.name))
        return out

    def clear_recovery_candidates(self) -> None:
        state=self.session()
        if state is None: return
        _atomic(self.session_path,state.model_copy(update={'recovery_autosaves':[]}).model_dump_json(indent=2))

    def recover_latest(self, *, commit: bool = False) -> CBIMProject:
        candidates=self.recovery_candidates()
        if not candidates: raise FileNotFoundError('No crash recovery candidate available')
        project=CBIMProject.model_validate_json(Path(candidates[0].path).read_text(encoding='utf-8'))
        if commit: self.workspace.save_project(project)
        return project
