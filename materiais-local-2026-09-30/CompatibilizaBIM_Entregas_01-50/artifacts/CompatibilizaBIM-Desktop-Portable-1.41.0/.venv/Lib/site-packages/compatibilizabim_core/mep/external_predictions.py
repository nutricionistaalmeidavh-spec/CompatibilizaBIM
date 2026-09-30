from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from ..cad.model import CadEntity

ExternalTarget = Literal['pipe','fitting','equipment','wall','beam','column','slab','unknown']

@dataclass(frozen=True)
class ExternalSemanticHint:
    target: ExternalTarget
    system: str | None
    confidence: float
    source: str


def external_semantic_hint(entity: CadEntity) -> ExternalSemanticHint | None:
    """Read a bounded semantic hint produced by an external ML/CAD model.

    The hint is evidence only. Callers must combine it with CAD/profile/context evidence;
    it must never be treated as an unconditional classification.
    """
    target = entity.metadata.get('ml_target')
    confidence = entity.metadata.get('ml_confidence')
    source = entity.metadata.get('ml_source')
    if not isinstance(target, str) or not isinstance(source, str) or not isinstance(confidence, (int, float)):
        return None
    if target not in {'pipe','fitting','equipment','wall','beam','column','slab','unknown'}:
        return None
    conf = max(0.0, min(1.0, float(confidence)))
    system = entity.metadata.get('ml_system')
    return ExternalSemanticHint(target=target, system=str(system) if isinstance(system, str) else None, confidence=conf, source=source)
