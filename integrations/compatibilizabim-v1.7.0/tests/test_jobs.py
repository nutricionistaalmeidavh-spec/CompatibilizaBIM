from __future__ import annotations

import time
from pathlib import Path

from compatibilizabim.jobs import JobCancelled, JobManager, JobStore


def _wait_for(manager: JobManager, job_id: str, statuses: set[str], timeout: float = 2.0):
    deadline = time.time() + timeout
    while time.time() < deadline:
        job = manager.get(job_id)
        if job.status in statuses:
            return job
        time.sleep(0.01)
    raise AssertionError(f"job {job_id} did not reach {statuses}")


def test_job_manager_persists_progress_and_completion(tmp_path: Path) -> None:
    store = JobStore(tmp_path / "jobs.json")
    manager = JobManager(store)

    def handler(ctx, payload):
        ctx.progress(25, "abrindo")
        ctx.progress(75, "processando")
        return {"count": payload["count"]}

    job = manager.submit("demo", {"count": 3}, handler)
    completed = _wait_for(manager, job.job_id, {"completed"})

    assert completed.progress == 100
    assert completed.result == {"count": 3}
    assert completed.message == "concluído"
    assert JobStore(tmp_path / "jobs.json").get(job.job_id).status == "completed"


def test_job_manager_cancels_cooperatively(tmp_path: Path) -> None:
    manager = JobManager(JobStore(tmp_path / "jobs.json"))

    def handler(ctx, payload):
        for i in range(100):
            ctx.check_cancelled()
            ctx.progress(i, "working")
            time.sleep(0.005)
        return {}

    job = manager.submit("slow", {}, handler)
    _wait_for(manager, job.job_id, {"running"})
    manager.cancel(job.job_id)
    cancelled = _wait_for(manager, job.job_id, {"cancelled"})
    assert cancelled.status == "cancelled"


def test_job_store_recovers_inflight_jobs_as_interrupted(tmp_path: Path) -> None:
    path = tmp_path / "jobs.json"
    path.write_text(
        '{"schema_version":1,"jobs":[{"job_id":"J1","job_type":"x","payload":{},'
        '"status":"running","progress":50,"message":"x","result":null,"error":null,'
        '"created_at":"2026-01-01T00:00:00+00:00","updated_at":"2026-01-01T00:00:01+00:00"}]}',
        encoding="utf-8",
    )

    store = JobStore(path)
    recovered = store.recover_inflight()

    assert recovered == 1
    assert store.get("J1").status == "interrupted"
