# BIM Engine PoC Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local CLI that compares two IFC files and exports normalized clash results to JSON/CSV.

**Architecture:** Keep domain logic independent of IfcOpenShell behind a backend protocol. A production IfcOpenShell backend owns model loading, geometry-tree construction and clash calls; serializers and CLI depend only on normalized records.

**Tech Stack:** Python 3.10+, IfcOpenShell 0.8.5, pytest, standard-library argparse/csv/json.

## Global Constraints
- Keep this PoC standalone from FluxoDRE.
- No GUI, database, authentication, cloud sync or BCF in this version.
- Support `intersection`, `collision` and `clearance` modes.
- Default IFC class on each side is `IfcElement`.
- Produce JSON and CSV reports.

---

### Task 1: Domain model and clash orchestration
**Files:** create `src/compatibilizabim/models.py`, `src/compatibilizabim/engine.py`; test `tests/test_engine.py`.
**Interfaces:** `ClashEngine.run(request: ClashRequest) -> list[ClashResult]`; backend protocol provides `open_model`, `select_elements`, `build_tree`, `find_clashes`.
- [ ] Write failing tests for dispatch and normalized result output.
- [ ] Run tests and verify failure because package is absent.
- [ ] Implement minimum domain classes and engine.
- [ ] Run tests and verify pass.

### Task 2: IfcOpenShell backend
**Files:** create `src/compatibilizabim/ifc_backend.py`; test `tests/test_ifc_backend_contract.py`.
**Interfaces:** `IfcOpenShellBackend` implements the engine backend protocol and maps native clashes to dictionaries.
- [ ] Write contract tests using fake native clash objects.
- [ ] Verify failure.
- [ ] Implement lazy IfcOpenShell import, tree setup and mode dispatch.
- [ ] Verify tests pass.

### Task 3: Report writers
**Files:** create `src/compatibilizabim/reporting.py`; test `tests/test_reporting.py`.
**Interfaces:** `write_json(path, summary, results)`, `write_csv(path, results)`.
- [ ] Write failing serialization tests.
- [ ] Verify failure.
- [ ] Implement JSON/CSV writers.
- [ ] Verify tests pass.

### Task 4: CLI and validation
**Files:** create `src/compatibilizabim/cli.py`, `src/compatibilizabim/__main__.py`; test `tests/test_cli.py`.
**Interfaces:** `main(argv: list[str] | None = None) -> int`.
- [ ] Write failing parser/validation tests.
- [ ] Verify failure.
- [ ] Implement CLI, summary and report output.
- [ ] Verify tests pass.

### Task 5: Packaging and user documentation
**Files:** create `pyproject.toml`, `requirements.txt`, `README.md`, `run_windows.bat`, `run_linux_macos.sh`, `tests/test_integration_optional.py`.
- [ ] Add package metadata and optional integration smoke test.
- [ ] Run full test suite.
- [ ] Run compile check.
- [ ] Create ZIP distribution.
