# Verification — CBIM/Revit phases 14–16 — 2.1.0

## Executed in packaging environment

- CompatibilizaBIM Core: **172/172 tests PASS**.
- CBIM Python SDK: **7/7 tests PASS**.
- Python `compileall`: **PASS**.
- Core wheel `compatibilizabim_core-2.1.0-py3-none-any.whl`: built successfully.
- CBIM SDK wheel `cbim_sdk-0.4.0-py3-none-any.whl`: built successfully.
- Revit build-plan/compiler, Library resolver, hydraulic topology/refinement and static Revit bundle tests are included in the Core suite.

## Windows/Revit-specific gate

The C# hosts intentionally reference `RevitAPI.dll` and `RevitAPIUI.dll` from `C:\Program Files\Autodesk\Revit 2027`. Those Autodesk binaries are not redistributed and are unavailable in this packaging environment. Therefore the final C# compile/runtime gate remains to be executed on a Windows machine with Revit 2027 using `revit-plugins\build_revit_2027.ps1`.

The package must not be labelled Revit-runtime-validated until that gate is executed.
