# Text Intelligence — Core 1.43.0

## Purpose
v1.43 turns CAD text into structured MEP evidence without pretending that 2D annotations already define a correct 3D model.

## Implemented
- Metric diameter parsing: `DN40`, `Ø32`, `DIAM 50`, with mm/cm/m normalization.
- Imperial diameter parsing: fractional and decimal inch labels such as `3/4"`.
- Material hints: PVC, CPVC, PPR, PEX, PEAD, PBA, copper, steel, cast iron and galvanized iron.
- System hints: cold water, hot water, sanitary, rainwater, fire protection and condensate terminology.
- Height hints: `h=500mm`, `h=0,813m`, `ALT=...`.
- Elevation/level hints: `NÍVEL`, `COTA`, `N.A.`.
- Vertical directives: `SOBE`, `DESCE`, `PRUMADA`, `UP`, `DOWN`, `RISER`.
- Spatial association through Shapely STRtree: only nearby semantic text is associated with an MEP candidate; nearest evidence wins by fact type.
- Evidence is preserved on CBIM elements as `height_hint_m`, `elevation_hint_m`, `vertical_direction`, `associated_text_ids`, and bounded raw text evidence.
- Height/elevation hints do **not** modify Z in this release. They set `z_reconstruction_pending=true` for the later 3D reconstruction stage.
- Height text alone is intentionally too weak to convert an otherwise ambiguous line into Pipe.

## Open-source boundary
This stage uses the already commercial-compatible deterministic stack: ACadSharp for DWG ingestion and Shapely/STRtree for spatial association. Optional IfcOpenShell remains downstream for IFC authoring/validation; bSDD and CADTransformer/VecFormer adapters remain semantic/external-evidence seams rather than unverified ground truth.
