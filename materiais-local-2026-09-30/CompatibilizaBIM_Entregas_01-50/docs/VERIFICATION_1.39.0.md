# Verification — Core 1.39.0

Fresh checks for the cumulative 01–50 package:

- Core test suite: 83/83 passing.
- CBIM Python SDK suite: 6/6 passing.
- Product/commercial artifact verification: passing.
- Python compileall: passing.
- Topology regression tests include T/cross junctions, face-closing gap repair, collinear overlap splitting, profile-ignored linework, and sparse-index candidate control.
- Baseline v1.38 1,000 sparse segments: ~6.844 s.
- v1.39 1,000 sparse segments: ~0.049 s.
- v1.39 50,000 sparse segments with indexed gap repair: ~5.991 s.

Not verified in this Linux packaging environment:

- ACadSharp .NET bridge compilation (no .NET SDK here).
- Post-patch rerun of the real QUA-HID DWG. This must be performed on the user's Windows machine.
