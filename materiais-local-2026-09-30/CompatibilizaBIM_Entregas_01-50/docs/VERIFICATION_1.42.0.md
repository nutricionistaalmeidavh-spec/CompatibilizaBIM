# Verification — Core 1.42.0

## Fresh executable evidence
- Core test suite: **110/110 PASS**.
- CBIM SDK Python suite: **6/6 PASS**.
- `compileall` on Core source: **PASS**.
- Wheel `compatibilizabim_core-1.42.0-py3-none-any.whl`: built offline/no build isolation: **PASS**.
- Isolated wheel install + import as version `1.42.0`: **PASS**.
- Installed-wheel bare known layer regression: one `H-AF-TB` line without independent evidence produces **0 Pipe** and **1 candidate**: **PASS**.
- Installed-wheel labeled MEP regression: `H-AF-TB` + nearby `AF Ø32 PVC` produces **1 Pipe DN32**: **PASS**.
- Installed-wheel unknown CX regression: generic block on `H-AF-CX` produces **0 Fitting** and **1 candidate**: **PASS**.
- Stair/tread synthetic regression: repetitive short parallel `H-AF-TB` lines without direct evidence produce **0 Pipe** and are rejected: **PASS**.
- 50,000 isolated MEP-candidate lines: **50,000 evidence records in 3.143 s (~15,907 entities/s)** in this container; 49,993 remained candidates and only locally corroborated lines auto-created.

## Open-source implementation boundary
This stage uses the already integrated permissive/dynamic open-source stack rather than adding redundant dependencies: ACadSharp for native DWG, Shapely spatial primitives/indexing for deterministic evidence geometry, optional IfcOpenShell downstream, bSDD semantic adapter, and evidence-only CADTransformer/VecFormer external prediction seam. Rtree was investigated but deliberately not added because Shapely/STRtree + spatial bucketing already provide the required indexing and another native dependency would duplicate functionality.

## Real-project evidence boundary
The user's Windows v1.41 run on `QUA-HID-LO-0100-TERR-R02.dwg` completed end-to-end: 46,921 imported entities; 45,690 canonical entities; 714 pipes; 603 fittings; 237 walls; 17 spaces; IFC sanity PASS. Revit inspection still showed stair/detail linework emitted as piping and a mostly flat MEP Z profile. v1.42 specifically changes the MEP creation gate, but the same DWG must be rerun on Windows before claiming that the visual stair false positive is fixed in the real project.

## Not claimed
- No claim that v1.42 fixes all real-project false positives until the QUA-HID IFC is rerun and visually compared.
- No claim of real 3D/Z reconstruction; that is the next dedicated stage.
- No proprietary manufacturer BIM binaries or non-commercial datasets are redistributed.
