# MEP Z Reconstruction v1.44 Implementation Plan

**Goal:** Convert Text Intelligence height/elevation/vertical hints into conservative 3D MEP geometry, propagate resolved Z through connected same-system networks, and expose diagnostics without inventing project datums.

**Architecture:** Add a dedicated `MEPZReconstructor` between MEP recognition and connectivity. It consumes CBIM properties already emitted by Text Intelligence (`height_hint_m`, `elevation_hint_m`, `vertical_direction`), resolves direct Z anchors relative to storeys or an optional project datum, creates vertical endpoint legs only when a target elevation is defensible, and propagates a single consistent Z anchor through connected XY network components. Ambiguous/conflicting or large absolute elevations without a datum remain pending instead of being guessed.

**Tech Stack:** Python 3.11+, Pydantic, CBIM SDK, existing spatial/grid utilities; no new runtime dependency.

## Global Constraints
- Preserve v1.43 semantic-gate behavior: geometry/height alone must not create MEP elements.
- Never convert a large absolute elevation such as 595.52 m to local Z without an explicit project datum.
- Only propagate Z within the same MEP system and XY-connected component.
- Conflicting anchors must remain reviewable; no silent averaging.
- Existing 2D behavior remains unchanged when no defensible Z evidence exists.
- Vertical directives without a resolvable target remain pending.

### Task 1: Direct Z anchor resolution
- Add tests for storey-relative height, explicit local elevation, project-datum conversion, and unresolved large absolute elevation.
- Implement immutable/rebuild helpers for Pipe/Fitting/Equipment geometry and properties.

### Task 2: Safe network Z propagation
- Add tests for one-anchor component propagation and conflicting anchors.
- Build same-system XY endpoint graph and propagate only when a connected component has one consistent resolved Z anchor.

### Task 3: Vertical directives
- Extend text association evidence with the chosen text anchor XY.
- Preserve anchor coordinates in CBIM properties.
- Add tests that `SOBE`/`DESCE` to a known adjacent storey inserts a vertical endpoint leg at the text-nearest endpoint.

### Task 4: Pipeline and reporting integration
- Insert `mep_z_reconstruction` after hydraulic/fire recognition and before connectivity.
- Emit timing/report metrics and project metadata counts for direct, propagated, vertical, unresolved and conflicting elements.
- Update v1.43 regression expectations to reflect intentional Z application.

### Task 5: Package/version/verification
- Update package and desktop version to 1.44.0.
- Run focused tests, full Core tests, CBIM SDK tests, build wheel, isolated wheel smoke, compileall and archive checksum verification.
- Generate cumulative ZIP and SHA-256.
