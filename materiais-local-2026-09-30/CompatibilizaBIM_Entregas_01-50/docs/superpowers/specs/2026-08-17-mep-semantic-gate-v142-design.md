# CompatibilizaBIM v1.42 — MEP Semantic Gate Design

## Goal
Reduce false-positive MEP elements in IFC output, especially architectural/stair linework being emitted as Pipe/Fitting, while preserving real MEP networks through evidence propagation.

## Architecture
1. The MEP evidence engine separates **semantic candidacy** from **automatic creation**. A recognized MEP layer alone creates only a candidate, not an IFC-bound element.
2. Automatic Pipe creation requires a known MEP semantic plus at least one independent corroborating signal: explicit DN/system text, explicit profile mapping, independently recognized MEP component connectivity, or a high-confidence external model hint. Connected same-system segments may inherit evidence only from a strong seed.
3. Fitting/equipment inserts require recognized block semantics, explicit profile mapping, or a bounded high-confidence external hint. An unknown block on `H-*-CX` remains a candidate.
4. Stair/repetitive line patterns are negative evidence. Network propagation is limited to approximately collinear line-line continuation unless a recognized component provides the junction evidence.
5. Recognizers expose evidence summaries in project metadata. Validation reports expose auto-created, candidate and rejected evidence counts without changing CBIM schema 0.2.0.

## Open-source components used in this stage
- ACadSharp remains the native DWG reader.
- Shapely 2 spatial/topological primitives remain the deterministic geometry foundation; no redundant Rtree dependency is added because STRtree/spatial bucketing already cover the required queries.
- CADTransformer/VecFormer external prediction seam remains evidence-only and may contribute only when the underlying CAD entity is already semantically plausible.
- IfcOpenShell and bSDD remain downstream IFC/semantic infrastructure; they do not override CAD evidence in this gate.

## Acceptance rules
- Geometry alone never creates MEP.
- `H-AF-TB` without corroboration is a review candidate, not a Pipe.
- `H-AF-TB` plus `Ø32`/`DN32`, a connected recognized fitting, explicit CAD profile, or strong same-network propagation can create a Pipe.
- Unknown `H-AF-CX` insert does not become Fitting solely from the layer.
- Recognized fitting blocks such as `COR0900_25`, `TEE_DN25`, `REGISTRO...` remain supported.
- Architecture/context/annotation roles stay hard-blocked from MEP.
- Catalog data cannot create MEP or force manufacturer identity.

## Verification
TDD regressions cover bare MEP layer candidate behavior, connected-network evidence propagation, unknown CX insert rejection, recognized fitting creation, staircase-like false positives, project evidence summaries, validation diagnostics and existing full suites.
