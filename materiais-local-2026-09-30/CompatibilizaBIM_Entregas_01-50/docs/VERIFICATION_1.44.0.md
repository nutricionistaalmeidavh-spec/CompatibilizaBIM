# Verification — Core 1.44.0

## Fresh executable evidence
- Core suite: **129/129 PASS**.
- CBIM SDK Python suite: **6/6 PASS**.
- `compileall` on Core source: **PASS**.
- Wheel `compatibilizabim_core-1.44.0-py3-none-any.whl`: **built successfully** with offline/no-build-isolation pip wheel.
- Isolated wheel install + import as version `1.44.0`: **PASS**.
- Installed-wheel Z smoke: storey-relative `height_hint_m=0.8` reconstructs Pipe Z to **0.8 m**: **PASS**.
- Z propagation benchmark: **10,000 connected pipes in 0.940 s**, with 9,999 elements propagated from one consistent anchor in this environment.

## Behavioral checks
- Height hints are storey-relative.
- Large absolute elevations are left unresolved without an explicit project datum.
- An explicit project datum converts large absolute elevations to local Z.
- Single-anchor same-system connected networks propagate Z.
- Conflicting anchors do not get averaged or over-propagated.
- `SOBE` to a known adjacent storey creates a vertical endpoint leg at the vertical-text anchor.
- Fittings connected to a single-anchor network inherit the reconstructed Z.
- Validation reports expose direct/propagated/vertical/unresolved/conflicting/nonzero-Z counts.
- CLI accepts `--project-datum-elevation-m`.

## Real-project boundary
The real DWGs require rerun on the user's Windows ACadSharp bridge. No claim is made that QUA-HID is now correctly reconstructed in Z until that visual Revit comparison is executed.
