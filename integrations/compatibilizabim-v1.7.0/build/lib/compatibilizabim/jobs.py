from __future__ import annotations

import json
import threading
import uuid
from dataclasses import dataclass, replace
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Literal

JobStatus = Literal["queued", "running", "completed", "failed", "cancelled", "interrupted"]
JobHandler = Callable[["JobContext", dict[str, Any]], dict[str, Any] | None]


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class JobCancelled(RuntimeError):
    pass


@dataclass(frozen=True, slots=True)
class JobRecord:
    job_id: str
    job_type: str
    payload: dict[str, Any]
    status: JobStatus
    progress: int
    message: str
    result: dict[str, Any] | None
    error: str | None
    created_at: str
    updated_at: str


class JobStore:
    SCHEMA_VERSION = 1

    def __init__(self, path: Path) -> None:
        self.path = Path(path)
        self._lock = threading.RLock()
        if not self.path.exists():
            self._write([])

    def list(self) -> tuple[JobRecord, ...]:
        with self._lock:
            payload = json.loads(self.path.read_text(encoding="utf-8"))
            if payload.get("schema_version") != self.SCHEMA_VERSION:
                raise ValueError("Versão de job store não suportada")
            rows = payload.get("jobs")
            if not isinstance(rows, list):
                raise ValueError("Job store inválido")
            return tuple(_from_json(row) for row in rows)

    def get(self, job_id: str) -> JobRecord:
        for job in self.list():
            if job.job_id == job_id:
                return job
        raise KeyError(f"Job não encontrado: {job_id}")

    def upsert(self, record: JobRecord) -> None:
        with self._lock:
            rows = list(self.list())
            for index, current in enumerate(rows):
                if current.job_id == record.job_id:
                    rows[index] = record
                    break
            else:
                rows.append(record)
            self._write(rows)

    def recover_inflight(self) -> int:
        with self._lock:
            rows = list(self.list())
            recovered = 0
            now = _now()
            for index, record in enumerate(rows):
                if record.status in {"queued", "running"}:
                    rows[index] = replace(
                        record,
                        status="interrupted",
                        message="interrompido na reinicialização",
                        updated_at=now,
                    )
                    recovered += 1
            if recovered:
                self._write(rows)
            return recovered

    def _write(self, rows: list[JobRecord]) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        payload = {"schema_version": self.SCHEMA_VERSION, "jobs": [_to_json(row) for row in rows]}
        tmp = self.path.with_name(f".{self.path.name}.tmp")
        tmp.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        tmp.replace(self.path)


class JobContext:
    def __init__(self, manager: "JobManager", job_id: str, cancel_event: threading.Event) -> None:
        self.manager = manager
        self.job_id = job_id
        self.cancel_event = cancel_event

    def progress(self, percent: int, message: str = "") -> None:
        self.check_cancelled()
        value = max(0, min(99, int(percent)))
        self.manager._update(self.job_id, progress=value, message=message or "processando")

    def check_cancelled(self) -> None:
        if self.cancel_event.is_set():
            raise JobCancelled("cancelado")


class JobManager:
    def __init__(self, store: JobStore) -> None:
        self.store = store
        self.store.recover_inflight()
        self._events: dict[str, threading.Event] = {}
        self._threads: dict[str, threading.Thread] = {}
        self._lock = threading.RLock()

    def submit(self, job_type: str, payload: dict[str, Any], handler: JobHandler) -> JobRecord:
        now = _now()
        job_id = f"JOB-{uuid.uuid4().hex[:12].upper()}"
        record = JobRecord(job_id, job_type, dict(payload), "queued", 0, "na fila", None, None, now, now)
        self.store.upsert(record)
        event = threading.Event()
        thread = threading.Thread(
            target=self._run,
            args=(job_id, handler, dict(payload), event),
            name=f"compatibilizabim-{job_id}",
            daemon=True,
        )
        with self._lock:
            self._events[job_id] = event
            self._threads[job_id] = thread
        thread.start()
        return record

    def get(self, job_id: str) -> JobRecord:
        return self.store.get(job_id)

    def list(self) -> tuple[JobRecord, ...]:
        return self.store.list()

    def cancel(self, job_id: str) -> JobRecord:
        current = self.store.get(job_id)
        if current.status in {"completed", "failed", "cancelled", "interrupted"}:
            return current
        with self._lock:
            event = self._events.get(job_id)
        if event is not None:
            event.set()
        return self._update(job_id, message="cancelamento solicitado")

    def _run(self, job_id: str, handler: JobHandler, payload: dict[str, Any], event: threading.Event) -> None:
        self._update(job_id, status="running", progress=1, message="iniciado")
        context = JobContext(self, job_id, event)
        try:
            context.check_cancelled()
            result = handler(context, payload) or {}
            context.check_cancelled()
        except JobCancelled:
            self._update(job_id, status="cancelled", message="cancelado")
        except Exception as exc:
            self._update(job_id, status="failed", message="falhou", error=f"{type(exc).__name__}: {exc}")
        else:
            self._update(job_id, status="completed", progress=100, message="concluído", result=result)
        finally:
            with self._lock:
                self._events.pop(job_id, None)
                self._threads.pop(job_id, None)

    def _update(self, job_id: str, **changes: Any) -> JobRecord:
        current = self.store.get(job_id)
        updated = replace(current, updated_at=_now(), **changes)
        self.store.upsert(updated)
        return updated


def _to_json(record: JobRecord) -> dict[str, Any]:
    return {
        "job_id": record.job_id,
        "job_type": record.job_type,
        "payload": record.payload,
        "status": record.status,
        "progress": record.progress,
        "message": record.message,
        "result": record.result,
        "error": record.error,
        "created_at": record.created_at,
        "updated_at": record.updated_at,
    }


def _from_json(row: dict[str, Any]) -> JobRecord:
    return JobRecord(
        job_id=str(row["job_id"]),
        job_type=str(row["job_type"]),
        payload=dict(row.get("payload") or {}),
        status=str(row["status"]),  # type: ignore[arg-type]
        progress=int(row.get("progress") or 0),
        message=str(row.get("message") or ""),
        result=dict(row["result"]) if isinstance(row.get("result"), dict) else None,
        error=str(row["error"]) if row.get("error") is not None else None,
        created_at=str(row["created_at"]),
        updated_at=str(row["updated_at"]),
    )
