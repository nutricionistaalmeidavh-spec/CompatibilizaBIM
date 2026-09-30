# MEP Semantic Gate v1.42 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make automatic MEP creation evidence-gated so ambiguous CAD linework stays a candidate instead of polluting the IFC.

**Architecture:** Extend `MepEvidence` with an explicit decision and strong-evidence count, tighten network propagation and component seeding, surface summaries through recognizers/validation, and preserve existing catalog/IFC architecture.

**Tech Stack:** Python 3.11+, Pydantic 2, Shapely 2, CBIM SDK 0.3, optional IfcOpenShell 0.8.x.

## Global Constraints
- Preserve CBIM schema 0.2.0.
- Geometry/layer alone may not auto-create MEP.
- External ML and catalog signals are advisory evidence, never unconditional truth.
- Manufacturer identity is never inferred without explicit evidence.
- Existing DWG/IFC APIs remain backward compatible.

---

### Task 1: Evidence decision model
**Files:** `mep/evidence.py`, `tests/test_mep_semantic_gate_v142.py`
- [ ] Write failing tests for bare H-AF-TB candidate, unknown H-AF-CX insert candidate, recognized fitting creation, and network propagation.
- [ ] Run focused tests and confirm RED.
- [ ] Add explicit `auto_create/candidate/reject` decision and strong evidence accounting.
- [ ] Restrict component seeds to independently recognized blocks/profile hints.
- [ ] Restrict line-line evidence propagation to approximately collinear continuations.
- [ ] Run focused tests GREEN.

### Task 2: Recognizer summaries
**Files:** `mep/hydraulic.py`, `mep/fire.py`, `tests/test_mep_semantic_gate_v142.py`
- [ ] Add failing tests for project metadata evidence summary.
- [ ] Store scalar auto/candidate/reject counts and candidate-layer JSON in project metadata.
- [ ] Ensure only auto-create evidence becomes CBIM elements under strict mode.
- [ ] Run focused tests GREEN.

### Task 3: Validation diagnostics
**Files:** `validation/models.py`, `validation/engine.py`, `tests/test_validation_v142.py`
- [ ] Add failing test for evidence auto/candidate/reject report fields.
- [ ] Add backward-compatible fields and populate from evidence assessment.
- [ ] Keep recognition rate based on auto-eligible entities, not candidates.
- [ ] Run focused tests GREEN.

### Task 4: Version/docs/package
**Files:** `pyproject.toml`, `README.md`, `CHANGELOG.md`, Desktop Portable package.
- [ ] Set 1.42.0 and document stricter semantic gate.
- [ ] Run complete Core and CBIM SDK suites.
- [ ] Build wheel and isolated install smoke test.
- [ ] Rebuild Desktop Portable 1.42.0 and manifests.
- [ ] Create cumulative ZIP and SHA-256, extract and verify final package.
