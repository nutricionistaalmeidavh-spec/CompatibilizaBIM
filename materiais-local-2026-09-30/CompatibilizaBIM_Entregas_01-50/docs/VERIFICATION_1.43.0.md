# Verification — Core 1.43.0

## Fresh executable evidence
- Core suite: **116/116 PASS**.
- CBIM SDK Python suite: **6/6 PASS**.
- `compileall` on Core source: **PASS**.
- Wheel `compatibilizabim_core-1.43.0-py3-none-any.whl`: **built successfully** offline/no build isolation.
- Isolated wheel install + import as version `1.43.0`: **PASS**.
- Installed-wheel text smoke: `AF 3/4" PPR h=813mm SOBE NÍVEL +3,15` parsed to 19.05 mm, PPR, 0.813 m, up, elevation 3.15: **PASS**.
- Installed-wheel MEP smoke: nearby `AF DN40 CPVC h=0,80m SOBE` produces one Pipe DN40 with height/vertical hints while Z remains unchanged: **PASS**.
- Text spatial-index benchmark: 10,000 lines + 1,000 semantic text entities; index build **0.038 s**, 10,000 entity queries **0.370 s** in this container.

## Behavior boundary
v1.43 parses and attaches height/elevation/vertical information but intentionally does **not** reconstruct Z. `z_reconstruction_pending=true` records that evidence for the next dedicated 3D stage. Height text alone remains insufficient to turn an ambiguous MEP-layer line into Pipe.

## Real-project boundary
The real `QUA-HID-LO-0100-TERR-R02.dwg` must be rerun on the user's Windows ACadSharp bridge before claiming changes to real-project DN/material/height coverage. No proprietary DWG is redistributed inside the package.
