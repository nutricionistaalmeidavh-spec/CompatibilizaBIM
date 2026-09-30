# MEP Z Reconstruction — Core 1.44.0

v1.44 turns the height/elevation/vertical evidence introduced in v1.43 into conservative 3D MEP geometry.

## Rules
- `h=` / `ALTURA` is storey-relative: `Z = storey elevation + height`.
- Small explicit `NÍVEL/COTA/N.A.` values are treated as local elevations.
- Large absolute elevations (e.g. 595.52 m) are never shifted into local model Z unless `project_datum_elevation_m` is explicitly supplied.
- `SOBE/DESCE` can create a vertical endpoint leg only when a target is resolvable from an adjacent storey or a numeric elevation/height hint.
- Z propagates only through XY-connected elements of the same MEP system and only when the connected component has one consistent anchor elevation.
- Conflicting anchors remain pending for review; values are not averaged.
- If no defensible Z evidence exists, existing 2D geometry is preserved.

## Diagnostics
Project metadata and validation reports expose direct, propagated, vertical, unresolved, conflicting and non-zero-Z element counts.
