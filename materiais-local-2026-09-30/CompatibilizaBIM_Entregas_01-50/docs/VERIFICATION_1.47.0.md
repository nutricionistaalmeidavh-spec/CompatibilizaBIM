# Verification — CompatibilizaBIM Core 1.47.0

Fresh checks required before packaging:

- Core full suite: 148/148 PASS
- CBIM Python SDK: 7/7 PASS
- `compileall`: PASS
- targeted scale/architecture/network/IFC regressions: PASS
- isolated wheel import/smoke: PASS
- legacy IFC smoke: circular swept-disk pipes, explicit fitting, distribution system, Pset/Qto, IFC4 sanity PASS
- IfcOpenShell runtime: NOT EXECUTED in this Linux sandbox because the optional package is not installed; static adapter tests PASS
- ACadSharp/.NET + QUA-HID + Revit visual validation: PENDING on the user's Windows workstation

The final packaging verification is recorded after the cumulative ZIP is created and re-extracted.
