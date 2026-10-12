from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any, Mapping


def cache_key(namespace: str, source_hash: str, options: Mapping[str, Any] | None = None) -> str:
    payload = {
        "namespace": namespace,
        "source_hash": source_hash,
        "options": dict(options or {}),
    }
    raw = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


class ContentCache:
    def __init__(self, root: Path) -> None:
        self.root = Path(root)
        self.root.mkdir(parents=True, exist_ok=True)

    def _path(self, key: str, suffix: str = ".json") -> Path:
        if not key or any(char not in "0123456789abcdefABCDEF-_" for char in key):
            raise ValueError("Chave de cache inválida")
        return self.root / key[:2] / f"{key}{suffix}"

    def has(self, key: str) -> bool:
        return self._path(key).is_file()

    def put_json(self, key: str, payload: Any) -> Path:
        path = self._path(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp = path.with_name(f".{path.name}.tmp")
        tmp.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        tmp.replace(path)
        return path

    def get_json(self, key: str) -> Any | None:
        path = self._path(key)
        if not path.is_file():
            return None
        return json.loads(path.read_text(encoding="utf-8"))
