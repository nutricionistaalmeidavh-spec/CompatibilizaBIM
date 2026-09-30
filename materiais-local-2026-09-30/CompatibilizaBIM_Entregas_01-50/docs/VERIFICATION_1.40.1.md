# Verification — Core 1.40.1

- Core test suite: **91/91 PASS**.
- Regression: `architecture_wall_candidates` emits numeric elapsed: **PASS**.
- Defensive CLI formatter with `elapsed=None`: **PASS**.
- `compileall` on `src`: **PASS**.
- Wheel `compatibilizabim_core-1.40.1-py3-none-any.whl`: built successfully.
- Wheel installed into isolated target directory and imported as version 1.40.1: **PASS**.
- Architecture callback executed from the installed wheel with numeric elapsed: **PASS**.
- Desktop Portable package-manifest wheel hashes: **PASS**.

## Runtime boundary
The real Windows ACadSharp rerun of QUA-HID is still required. This environment cannot execute the user's Windows/.NET bridge. v1.40.1 specifically fixes the `elapsed=None` telemetry failure observed after Topology completed.
