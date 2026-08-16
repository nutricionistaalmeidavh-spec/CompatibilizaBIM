from __future__ import annotations

import csv
import json
from dataclasses import asdict, dataclass, replace
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any, Iterable, Sequence


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _date(value: str, field: str) -> date:
    try:
        return date.fromisoformat(str(value))
    except ValueError as exc:
        raise ValueError(f"{field} deve usar YYYY-MM-DD") from exc


def _atomic_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(f".{path.name}.tmp")
    tmp.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    tmp.replace(path)


@dataclass(frozen=True, slots=True)
class ProgressEntry:
    recorded_on: str
    progress: float


@dataclass(frozen=True, slots=True)
class Activity:
    activity_id: str
    name: str
    start_date: str
    end_date: str
    predecessors: tuple[str, ...] = ()
    linked_guids: tuple[str, ...] = ()
    discipline: str | None = None
    storey: str | None = None
    composition_code: str | None = None
    actual_progress: float = 0.0
    actual_start: str | None = None
    actual_finish: str | None = None
    notes: str | None = None
    progress_history: tuple[ProgressEntry, ...] = ()

    @property
    def duration_days(self) -> int:
        return (_date(self.end_date, "end_date") - _date(self.start_date, "start_date")).days + 1


@dataclass(frozen=True, slots=True)
class Schedule:
    activities: tuple[Activity, ...]
    updated_at: str | None = None


class ScheduleStore:
    SCHEMA_VERSION = 1

    def __init__(self, path: Path) -> None:
        self.path = Path(path)

    def load(self) -> Schedule:
        if not self.path.exists():
            return Schedule(())
        payload = json.loads(self.path.read_text(encoding="utf-8"))
        if payload.get("schema_version") != self.SCHEMA_VERSION:
            raise ValueError("Versão de cronograma não suportada")
        rows = payload.get("activities") or []
        return Schedule(tuple(_activity_from_json(row) for row in rows), payload.get("updated_at"))

    def save(self, schedule: Schedule) -> None:
        _atomic_json(self.path, {
            "schema_version": self.SCHEMA_VERSION,
            "updated_at": _utc_now(),
            "activities": [asdict(item) for item in schedule.activities],
        })


class ScheduleService:
    def __init__(self, store: ScheduleStore) -> None:
        self.store = store

    def list_activities(self) -> list[dict[str, Any]]:
        return [_activity_json(a) | {"duration_days": a.duration_days} for a in self.store.load().activities]

    def add_activity(
        self,
        activity_id: str,
        name: str,
        start_date: str,
        end_date: str,
        *,
        predecessors: Sequence[str] = (),
        discipline: str | None = None,
        storey: str | None = None,
        composition_code: str | None = None,
        notes: str | None = None,
    ) -> Activity:
        activity_id = str(activity_id).strip()
        name = str(name).strip()
        if not activity_id or not name:
            raise ValueError("activity_id e nome são obrigatórios")
        start = _date(start_date, "start_date")
        end = _date(end_date, "end_date")
        if end < start:
            raise ValueError("A data final não pode ser anterior à data inicial")
        schedule = self.store.load()
        by_id = {a.activity_id: a for a in schedule.activities}
        if activity_id in by_id:
            raise ValueError(f"Atividade já existe: {activity_id}")
        preds = tuple(dict.fromkeys(str(p).strip() for p in predecessors if str(p).strip()))
        missing = [p for p in preds if p not in by_id]
        if missing:
            raise ValueError(f"Atividade predecessora não encontrada: {', '.join(missing)}")
        activity = Activity(
            activity_id, name, start_date, end_date, preds, (),
            _text(discipline), _text(storey), _text(composition_code), 0.0, None, None, _text(notes), (),
        )
        self.store.save(Schedule(schedule.activities + (activity,)))
        return activity

    def import_csv(self, path: Path) -> dict[str, Any]:
        path = Path(path)
        if not path.is_file():
            raise ValueError(f"Cronograma não encontrado: {path}")
        schedule = self.store.load()
        existing = {a.activity_id: a for a in schedule.activities}
        imported = 0
        with path.open("r", encoding="utf-8-sig", newline="") as handle:
            rows = list(csv.DictReader(handle))
        # CSV may be out of dependency order; validate after all IDs are known.
        staged: list[Activity] = []
        all_ids = set(existing) | {str(r.get("activity_id") or "").strip() for r in rows}
        for row in rows:
            aid = str(row.get("activity_id") or "").strip()
            if not aid:
                raise ValueError("CSV contém activity_id vazio")
            if aid in existing or any(a.activity_id == aid for a in staged):
                continue
            name = str(row.get("name") or "").strip()
            start_s = str(row.get("start_date") or "").strip()
            end_s = str(row.get("end_date") or "").strip()
            if not name:
                raise ValueError(f"Atividade {aid} sem nome")
            if _date(end_s, "end_date") < _date(start_s, "start_date"):
                raise ValueError(f"Atividade {aid}: data final anterior à inicial")
            preds = tuple(dict.fromkeys(_split(row.get("predecessors"))))
            missing = [p for p in preds if p not in all_ids]
            if missing:
                raise ValueError(f"Atividade predecessora não encontrada: {', '.join(missing)}")
            staged.append(Activity(
                aid, name, start_s, end_s, preds, (), _text(row.get("discipline")),
                _text(row.get("storey")), _text(row.get("composition_code")),
                _float(row.get("actual_progress"), 0.0), _text(row.get("actual_start")),
                _text(row.get("actual_finish")), _text(row.get("notes")), (),
            ))
            imported += 1
        self.store.save(Schedule(schedule.activities + tuple(staged)))
        return {"imported": imported, "total": len(schedule.activities) + imported}

    def link_elements(self, activity_id: str, guids: Iterable[str], *, replace_existing: bool = False) -> Activity:
        activity = self._get(activity_id)
        incoming = {str(g).strip() for g in guids if str(g).strip()}
        linked = incoming if replace_existing else set(activity.linked_guids) | incoming
        return self._replace(activity_id, replace(activity, linked_guids=tuple(sorted(linked))))

    def update_progress(
        self,
        activity_id: str,
        progress: float,
        *,
        actual_start: str | None = None,
        actual_finish: str | None = None,
        recorded_on: str | None = None,
    ) -> Activity:
        value = float(progress)
        if value < 0 or value > 100:
            raise ValueError("Progresso deve ficar entre 0 e 100")
        activity = self._get(activity_id)
        if actual_start:
            _date(actual_start, "actual_start")
        if actual_finish:
            _date(actual_finish, "actual_finish")
        if actual_finish and value < 100:
            raise ValueError("actual_finish exige progresso de 100%")
        stamp = recorded_on or date.today().isoformat()
        _date(stamp, "recorded_on")
        history = tuple(item for item in activity.progress_history if item.recorded_on != stamp) + (ProgressEntry(stamp, value),)
        history = tuple(sorted(history, key=lambda item: item.recorded_on))
        return self._replace(activity_id, replace(
            activity, actual_progress=value,
            actual_start=actual_start or activity.actual_start,
            actual_finish=actual_finish or activity.actual_finish,
            progress_history=history,
        ))

    def _get(self, activity_id: str) -> Activity:
        for activity in self.store.load().activities:
            if activity.activity_id == activity_id:
                return activity
        raise KeyError(f"Atividade não encontrada: {activity_id}")

    def _replace(self, activity_id: str, updated: Activity) -> Activity:
        schedule = self.store.load()
        rows = tuple(updated if a.activity_id == activity_id else a for a in schedule.activities)
        self.store.save(Schedule(rows))
        return updated


def _activity_json(activity: Activity) -> dict[str, Any]:
    payload = asdict(activity)
    payload["predecessors"] = list(activity.predecessors)
    payload["linked_guids"] = list(activity.linked_guids)
    payload["progress_history"] = [asdict(item) for item in activity.progress_history]
    return payload


def _activity_from_json(row: dict[str, Any]) -> Activity:
    return Activity(
        activity_id=str(row.get("activity_id") or ""), name=str(row.get("name") or ""),
        start_date=str(row.get("start_date") or ""), end_date=str(row.get("end_date") or ""),
        predecessors=tuple(str(x) for x in row.get("predecessors") or ()),
        linked_guids=tuple(str(x) for x in row.get("linked_guids") or ()),
        discipline=_text(row.get("discipline")), storey=_text(row.get("storey")),
        composition_code=_text(row.get("composition_code")), actual_progress=float(row.get("actual_progress") or 0.0),
        actual_start=_text(row.get("actual_start")), actual_finish=_text(row.get("actual_finish")), notes=_text(row.get("notes")),
        progress_history=tuple(ProgressEntry(str(x.get("recorded_on") or ""), float(x.get("progress") or 0.0)) for x in row.get("progress_history") or [] if isinstance(x, dict)),
    )


def _split(value: Any) -> list[str]:
    if value is None:
        return []
    text = str(value).strip()
    if not text:
        return []
    sep = ";" if ";" in text else ","
    return [part.strip() for part in text.split(sep) if part.strip()]


def _float(value: Any, default: float) -> float:
    if value is None or str(value).strip() == "":
        return default
    result = float(value)
    if not 0 <= result <= 100:
        raise ValueError("actual_progress deve ficar entre 0 e 100")
    return result


def _text(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None
