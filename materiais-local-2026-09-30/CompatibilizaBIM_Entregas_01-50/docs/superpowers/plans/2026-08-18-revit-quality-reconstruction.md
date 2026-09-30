# Revit Quality Reconstruction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver cumulative CompatibilizaBIM Core v1.47.0 combining architectural reconstruction, explicit MEP fittings, circular IFC pipes, and IFC data improvements.

**Architecture:** Extend CBIM with focused object types, recognize composite CAD objects before walls, normalize MEP networks after Z reconstruction, and export semantically correct IFC classes/geometry/properties. Maintain conservative evidence gates and legacy IFC fallback.

**Tech Stack:** Python 3.11+, Pydantic 2, Shapely 2/STRtree, ACadSharp bridge, optional IfcOpenShell 0.8.x.

**Spec:** `docs/superpowers/specs/2026-08-18-revit-quality-reconstruction-design.md`

## Global Constraints
- Preserve cumulative compatibility with v1.44.0 behavior unless intentionally improved by this spec.
- Do not infer manufacturer or Z without evidence.
- Do not redistribute user DWGs or proprietary BIM families.
- Keep IfcOpenShell optional; legacy IFC export must remain functional.

---

### Task 1: Extend CBIM object vocabulary
**Files:** `cbim-sdk/python/src/cbim_sdk/models.py`, `cbim-sdk/python/pyproject.toml`, `cbim-sdk/python/tests/test_models_v040.py`
- [ ] Add failing tests for Stair, SanitaryTerminal, Furniture and project serialization.
- [ ] Add the models and union membership.
- [ ] Bump CBIM SDK to 0.4.0 and run tests.

### Task 2: Architectural composite recognition
**Files:** `compatibilizabim-core/src/compatibilizabim_core/architecture/recognizer.py`, `compatibilizabim-core/tests/test_architecture_v147.py`
- [ ] Add failing tests for stair-vs-wall, floor/slab, sink, counter, and wall merge.
- [ ] Implement stair grouping/reservation, slab recognition, block/polyline fixtures, and collinear wall merge.
- [ ] Run focused architecture tests.

### Task 3: Explicit MEP network reconstruction
**Files:** `compatibilizabim-core/src/compatibilizabim_core/mep/network_reconstruction.py`, `compatibilizabim-core/src/compatibilizabim_core/pipeline.py`, `compatibilizabim-core/tests/test_mep_network_reconstruction_v147.py`
- [ ] Add failing tests for bend->elbow, 3-way->tee, diameter change->reducer, and straight pipe preservation.
- [ ] Implement conservative network normalization using pipe endpoints/path vertices and system/diameter checks.
- [ ] Insert stage after Z reconstruction and before connectivity.

### Task 4: IFC/Revit semantics and quantities
**Files:** `compatibilizabim-core/src/compatibilizabim_core/ifc/bridge.py`, `compatibilizabim-core/src/compatibilizabim_core/ifc/ifcopenshell_backend.py`, `compatibilizabim-core/tests/test_ifc_revit_v147.py`
- [ ] Add failing tests proving circular swept-disk pipe geometry and new IFC classes.
- [ ] Implement legacy `IfcSweptDiskSolid` pipe representation.
- [ ] Map Stair, SanitaryTerminal and Furniture in both exporters.
- [ ] Add CompatibilizaBIM property sets and base quantities in legacy exporter; add equivalent psets/qtos in IfcOpenShell backend when available.

### Task 5: Packaging, reports, and verification
**Files:** `compatibilizabim-core/pyproject.toml`, desktop portable package, `docs/DELIVERY_1.47.0.md`, verification files.
- [ ] Bump Core to 1.47.0 and dependency on cbim-sdk 0.4.x.
- [ ] Run full Core + CBIM SDK tests and compileall.
- [ ] Build wheels, update Desktop Portable, verify clean wheel install.
- [ ] Produce cumulative ZIP and SHA-256.
