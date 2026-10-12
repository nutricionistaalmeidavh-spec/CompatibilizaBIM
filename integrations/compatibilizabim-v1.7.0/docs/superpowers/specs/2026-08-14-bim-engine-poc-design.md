# BIM Engine PoC — Design

## Goal
Prove that two IFC models can be loaded, filtered, clashed and exported as structured issue candidates before integrating BIM features into FluxoDRE.

## Scope
- Local CLI application.
- Inputs: IFC file A and IFC file B.
- Clash modes: intersection, collision and clearance.
- Optional IFC class filters per side.
- Outputs: JSON and CSV.
- No GUI, database, authentication, cloud sync, BCF or FluxoDRE integration in this PoC.

## Architecture
The domain layer is independent from IfcOpenShell. `ClashEngine` receives a backend protocol; the production backend wraps IfcOpenShell 0.8.5 and tests use an in-memory fake. This keeps business rules testable even when native geometry dependencies are unavailable.

## Data flow
1. Validate input files and numeric parameters.
2. Open both IFC models with IfcOpenShell.
3. Build one geometry tree containing both files.
4. Select `IfcElement` by default or user-specified IFC classes.
5. Run the selected geometry-tree clash method.
6. Normalize each native clash into a `ClashResult` record.
7. Write JSON and/or CSV reports.

## Error handling
- Missing files: clear CLI validation error.
- Unsupported mode or invalid tolerance/clearance: argument validation error.
- Missing IfcOpenShell: actionable install message.
- Empty element groups: successful run with zero clashes and summary.

## Testing
- Unit tests cover result normalization, clash-mode dispatch, filtering and report serialization using a fake backend.
- CLI tests cover argument parsing and validation without IfcOpenShell.
- Integration smoke test is skipped automatically unless IfcOpenShell is installed and real IFC paths are supplied.
