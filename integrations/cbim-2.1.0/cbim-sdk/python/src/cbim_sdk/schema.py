from __future__ import annotations

import json
from pathlib import Path

from .models import CBIMProject


def generate_schema(path: str | Path | None = None) -> dict:
    schema = CBIMProject.model_json_schema(by_alias=True)
    if path is not None:
        Path(path).write_text(json.dumps(schema, ensure_ascii=False, indent=2), encoding="utf-8")
    return schema
