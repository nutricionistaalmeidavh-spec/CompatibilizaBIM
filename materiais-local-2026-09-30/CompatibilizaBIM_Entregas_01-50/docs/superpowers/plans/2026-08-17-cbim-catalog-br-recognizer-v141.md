# CBIM Catalog Brasil + MEP Evidence v1.41 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a conservative evidence-based MEP recognizer and Brazilian catalog advisory layer while integrating safe seams for open-source BIM/CAD resources.

**Architecture:** Add layer/context classification and document-level evidence extraction before element creation. Extend the catalog from simple preferred-manufacturer enrichment to neutral advisory matching, and add an explicit open-source capability registry/prediction seam without bundling restricted datasets or model weights.

**Tech Stack:** Python 3.11+, Pydantic 2, Shapely 2 STRtree, CBIM SDK 0.3, optional IfcOpenShell 0.8.x.

## Global Constraints
- Preserve CBIM schema 0.2.0 and existing public API compatibility.
- Manufacturer identity is never inferred without explicit project/user evidence.
- Catalog match can only confirm/rerank an already plausible MEP candidate.
- Do not redistribute manufacturer RFA/DWG libraries or NC/research-only datasets.
- Geometry alone never creates a MEP element.

---

### Task 1: MEP evidence gate
**Files:** Modify `mep/semantics.py`, create `mep/evidence.py`, modify `mep/hydraulic.py` and `mep/fire.py`; tests in `tests/test_mep_evidence_v141.py`.

- [ ] Write failing tests for blocked architecture/stair/context layers, explicit H-AF-TB+DN text, and fitting block recognition.
- [ ] Run focused tests and confirm expected failures.
- [ ] Implement layer-role classification, nearby-text extraction, endpoint-connectivity evidence and scored candidates.
- [ ] Integrate candidates into Hydraulic/Fire recognizers while preserving current known-convention behavior.
- [ ] Run focused tests green.

### Task 2: CBIM Catalog Brasil advisory layer
**Files:** Modify `catalog/model.py`, `catalog/seed.py`, `catalog/__init__.py`; tests in `tests/test_catalog_v141.py`.

- [ ] Write failing tests for multi-manufacturer family coverage, neutral catalog advisory, and no forced manufacturer.
- [ ] Expand family-level seed data for Amanco Wavin, Tigre, Krona, Astra, Fortlev plus fire/electrical adapter families.
- [ ] Add neutral `advise_element()` and project advisory enrichment stored as scalar diagnostic properties.
- [ ] Keep `CatalogEnricher` manufacturer assignment restricted to explicit manufacturer evidence.
- [ ] Run focused tests green.

### Task 3: Open-source capability registry and external prediction seam
**Files:** Create `opensource/registry.py`, `opensource/__init__.py`, `mep/external_predictions.py`; tests in `tests/test_opensource_registry_v141.py`.

- [ ] Write failing tests for licenses/roles and external prediction metadata parsing.
- [ ] Register ACadSharp, IfcOpenShell, bSDD, CADTransformer, VecFormer, Sample-Test-Files and LibreDWG.
- [ ] Implement metadata seam (`ml_target`, `ml_system`, `ml_confidence`, `ml_source`) consumed only as evidence, never as unconditional truth.
- [ ] Run focused tests green.

### Task 4: Validation diagnostics and pipeline integration
**Files:** Modify `validation/models.py`, `validation/engine.py`, `pipeline.py`; tests in `tests/test_validation_v141.py`.

- [ ] Write failing tests for architecture/context/annotation/unknown breakdown and catalog advisory counts.
- [ ] Add backward-compatible report fields with defaults.
- [ ] Apply advisory catalog enrichment after recognizers and before intelligence.
- [ ] Run focused tests green.

### Task 5: Version/package/docs/verification
**Files:** Modify `pyproject.toml`, `README.md`, `CHANGELOG.md`, desktop portable package and verification docs.

- [ ] Set version to 1.41.0 and add v1.41 documentation.
- [ ] Run complete Core tests and CBIM SDK tests.
- [ ] Build wheel and install into an isolated target; smoke import/version.
- [ ] Rebuild Desktop Portable 1.41.0 and manifests.
- [ ] Zip cumulative 01–50 package; compute SHA-256; extract final ZIP and verify contents/checksums.
