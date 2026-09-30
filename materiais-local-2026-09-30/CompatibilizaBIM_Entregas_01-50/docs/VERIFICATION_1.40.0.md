# Verification — Core 1.40.0

Fresh verification performed before packaging.

- Core tests: **89/89 PASS** (`pytest -q`).
- CBIM Python SDK tests: **6/6 PASS**.
- `compileall`: **PASS**.
- Clean wheel install: **PASS**.
- Installed `compatibilizabim_core.__version__`: **1.40.0**.
- Installed default IFC backend: **legacy** (compatibility default).
- IfcOpenShell runtime in build environment: **unavailable** (no outbound DNS; optional backend could not be installed/executed here).
- Architecture synthetic scale check: **20,000 wall-tagged lines ~0.88 s** in this environment.
- Structure synthetic scale check: **20,000 beam-tagged lines ~0.61 s** in this environment.
- Connectivity stress regression: **5,000-pipe network PASS** under the test gate.

## Real DWG evidence carried forward

Windows v1.39 run of `QUA-HID-LO-0100-TERR-R02.dwg` demonstrated:

- DWG import: 4.721 s / 46,921 entities.
- Geometry: 0.914 s / 45,690 entities.
- Topology: 17.907 s / 57,305 nodes / 63,870 edges.
- Architecture then exposed the all-pairs `wall_pair` bottleneck addressed in v1.40.

The v1.40 real-DWG rerun remains required on Windows because this build environment has no .NET/ACadSharp runtime.

## IfcOpenShell integration evidence boundary

The optional adapter and class-contract tests pass without importing IfcOpenShell. Actual IfcOpenShell authoring/validation execution is explicitly **unverified in this environment** and must be exercised on Windows after installing the optional dependency.
