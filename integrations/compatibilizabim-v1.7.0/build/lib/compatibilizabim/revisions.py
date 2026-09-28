from __future__ import annotations

import hashlib
import json
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Sequence


@dataclass(frozen=True, slots=True)
class RevisionClash:
    identity: str
    rule_id: str
    rule_name: str
    severity: str
    a_global_id: str
    b_global_id: str
    a_ifc_class: str
    b_ifc_class: str
    a_name: str | None
    b_name: str | None
    point: tuple[float, float, float]
    depth_m: float


@dataclass(frozen=True, slots=True)
class RevisionSnapshot:
    revision_id: str
    label: str | None
    created_at: str
    report_sha256: str
    file_a: str
    file_b: str
    clashes: tuple[RevisionClash, ...]


@dataclass(frozen=True, slots=True)
class RevisionComparison:
    base_revision: str
    current_revision: str
    new: tuple[RevisionClash, ...]
    persistent: tuple[RevisionClash, ...]
    resolved: tuple[RevisionClash, ...]

    @property
    def new_count(self) -> int:
        return len(self.new)

    @property
    def persistent_count(self) -> int:
        return len(self.persistent)

    @property
    def resolved_count(self) -> int:
        return len(self.resolved)


class RevisionStore:
    SCHEMA_VERSION = 1

    def __init__(self, path: Path) -> None:
        self.path = Path(path)

    def load(self) -> tuple[RevisionSnapshot, ...]:
        if not self.path.exists():
            return ()
        payload = json.loads(self.path.read_text(encoding="utf-8"))
        if payload.get("schema_version") != self.SCHEMA_VERSION:
            raise ValueError(
                f"Versão de revision store não suportada: {payload.get('schema_version')}"
            )
        rows = payload.get("revisions")
        if not isinstance(rows, list):
            raise ValueError(f"Revision store inválido: {self.path}")
        return tuple(_snapshot_from_json(row) for row in rows)

    def get(self, revision_id: str) -> RevisionSnapshot:
        for snapshot in self.load():
            if snapshot.revision_id == revision_id:
                return snapshot
        raise KeyError(f"Revisão não encontrada: {revision_id}")

    def save(self, snapshots: Sequence[RevisionSnapshot]) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "schema_version": self.SCHEMA_VERSION,
            "revisions": [_snapshot_to_json(snapshot) for snapshot in snapshots],
        }
        temp = self.path.with_name(f".{self.path.name}.tmp")
        temp.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        temp.replace(self.path)


class RevisionService:
    def __init__(self, clock: Callable[[], datetime] | None = None) -> None:
        self.clock = clock or (lambda: datetime.now(timezone.utc))

    def add_report(
        self,
        report_path: Path,
        store_path: Path,
        *,
        revision_id: str,
        label: str | None = None,
    ) -> RevisionSnapshot:
        revision_clean = revision_id.strip()
        if not revision_clean:
            raise ValueError("revision_id não pode ser vazio")

        store = RevisionStore(store_path)
        snapshots = list(store.load())
        if any(snapshot.revision_id == revision_clean for snapshot in snapshots):
            raise ValueError(f"Revisão já existe: {revision_clean}")

        report_path = Path(report_path)
        raw_bytes = report_path.read_bytes()
        payload = json.loads(raw_bytes.decode("utf-8"))
        rows = payload.get("clashes")
        if not isinstance(rows, list):
            raise ValueError(f"Relatório de regras inválido: {report_path}")

        clashes = _dedupe_clashes(
            tuple(_revision_clash_from_row(row) for row in rows if isinstance(row, dict))
        )
        if len(clashes) != len([row for row in rows if isinstance(row, dict)]):
            # Duplicatas por identidade são válidas, mas o snapshot guarda apenas a melhor ocorrência.
            pass
        snapshot = RevisionSnapshot(
            revision_id=revision_clean,
            label=_optional_text(label),
            created_at=self._now(),
            report_sha256=hashlib.sha256(raw_bytes).hexdigest(),
            file_a=str(payload.get("file_a") or ""),
            file_b=str(payload.get("file_b") or ""),
            clashes=clashes,
        )
        snapshots.append(snapshot)
        store.save(snapshots)
        return snapshot

    def compare(
        self,
        store_path: Path,
        base_revision: str,
        current_revision: str,
    ) -> RevisionComparison:
        store = RevisionStore(store_path)
        base = store.get(base_revision)
        current = store.get(current_revision)
        base_map = {clash.identity: clash for clash in base.clashes}
        current_map = {clash.identity: clash for clash in current.clashes}

        new_ids = current_map.keys() - base_map.keys()
        persistent_ids = current_map.keys() & base_map.keys()
        resolved_ids = base_map.keys() - current_map.keys()

        return RevisionComparison(
            base_revision=base.revision_id,
            current_revision=current.revision_id,
            new=tuple(current_map[key] for key in sorted(new_ids)),
            persistent=tuple(current_map[key] for key in sorted(persistent_ids)),
            resolved=tuple(base_map[key] for key in sorted(resolved_ids)),
        )

    def _now(self) -> str:
        value = self.clock()
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value.isoformat()


def write_comparison_json(path: Path, comparison: RevisionComparison) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "base_revision": comparison.base_revision,
        "current_revision": comparison.current_revision,
        "counts": {
            "new": comparison.new_count,
            "persistent": comparison.persistent_count,
            "resolved": comparison.resolved_count,
        },
        "new": [_clash_to_json(clash) for clash in comparison.new],
        "persistent": [_clash_to_json(clash) for clash in comparison.persistent],
        "resolved": [_clash_to_json(clash) for clash in comparison.resolved],
    }
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def _revision_clash_from_row(row: dict[str, Any]) -> RevisionClash:
    point = _point3(row.get("point"))
    a_gid = str(row.get("a_global_id") or "")
    b_gid = str(row.get("b_global_id") or "")
    a_class = str(row.get("a_ifc_class") or "")
    b_class = str(row.get("b_ifc_class") or "")
    identity = _clash_identity(a_gid, b_gid, a_class, b_class, point)
    return RevisionClash(
        identity=identity,
        rule_id=str(row.get("rule_id") or ""),
        rule_name=str(row.get("rule_name") or "Clash"),
        severity=str(row.get("severity") or "high"),
        a_global_id=a_gid,
        b_global_id=b_gid,
        a_ifc_class=a_class,
        b_ifc_class=b_class,
        a_name=_optional_text(row.get("a_name")),
        b_name=_optional_text(row.get("b_name")),
        point=point,
        depth_m=float(row.get("depth_m") or 0.0),
    )


def _clash_identity(
    a_gid: str,
    b_gid: str,
    a_class: str,
    b_class: str,
    point: tuple[float, float, float],
) -> str:
    if a_gid and b_gid:
        seed = "guid|" + "|".join(sorted((a_gid, b_gid)))
    else:
        classes = "|".join(sorted((a_class, b_class)))
        seed = "fallback|" + classes + "|" + "|".join(f"{value:.4f}" for value in point)
    return hashlib.sha256(seed.encode("utf-8")).hexdigest()


_SEVERITY_RANK = {"low": 1, "medium": 2, "high": 3, "critical": 4}


def _dedupe_clashes(clashes: Sequence[RevisionClash]) -> tuple[RevisionClash, ...]:
    selected: dict[str, RevisionClash] = {}
    order: list[str] = []
    for clash in clashes:
        current = selected.get(clash.identity)
        if current is None:
            selected[clash.identity] = clash
            order.append(clash.identity)
            continue
        if _SEVERITY_RANK.get(clash.severity, 0) > _SEVERITY_RANK.get(current.severity, 0):
            selected[clash.identity] = clash
    return tuple(selected[key] for key in order)


def _snapshot_to_json(snapshot: RevisionSnapshot) -> dict[str, Any]:
    return {
        "revision_id": snapshot.revision_id,
        "label": snapshot.label,
        "created_at": snapshot.created_at,
        "report_sha256": snapshot.report_sha256,
        "file_a": snapshot.file_a,
        "file_b": snapshot.file_b,
        "clashes": [_clash_to_json(clash) for clash in snapshot.clashes],
    }


def _snapshot_from_json(row: dict[str, Any]) -> RevisionSnapshot:
    return RevisionSnapshot(
        revision_id=str(row["revision_id"]),
        label=_optional_text(row.get("label")),
        created_at=str(row.get("created_at") or ""),
        report_sha256=str(row.get("report_sha256") or ""),
        file_a=str(row.get("file_a") or ""),
        file_b=str(row.get("file_b") or ""),
        clashes=tuple(_clash_from_json(clash) for clash in row.get("clashes", [])),
    )


def _clash_to_json(clash: RevisionClash) -> dict[str, Any]:
    data = asdict(clash)
    data["point"] = list(clash.point)
    return data


def _clash_from_json(row: dict[str, Any]) -> RevisionClash:
    return RevisionClash(
        identity=str(row["identity"]),
        rule_id=str(row.get("rule_id") or ""),
        rule_name=str(row.get("rule_name") or "Clash"),
        severity=str(row.get("severity") or "high"),
        a_global_id=str(row.get("a_global_id") or ""),
        b_global_id=str(row.get("b_global_id") or ""),
        a_ifc_class=str(row.get("a_ifc_class") or ""),
        b_ifc_class=str(row.get("b_ifc_class") or ""),
        a_name=_optional_text(row.get("a_name")),
        b_name=_optional_text(row.get("b_name")),
        point=_point3(row.get("point")),
        depth_m=float(row.get("depth_m") or 0.0),
    )


def _point3(value: Any) -> tuple[float, float, float]:
    raw = value or (0.0, 0.0, 0.0)
    point = tuple(float(item) for item in raw)
    if len(point) != 3:
        raise ValueError("Ponto de clash deve conter 3 coordenadas")
    return point  # type: ignore[return-value]


def _optional_text(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None
