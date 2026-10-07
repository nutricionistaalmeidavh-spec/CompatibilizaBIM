# CBIM — Revit 2027 integration bundle (phases 14–16)

This bundle keeps the components separate while sharing one semantic contract.

- **CBIM.Revit.Plugin** — generic CBIM bridge inside Revit: select DWG, analyze through `cbim-revit` without IFC, reconstruct native Revit elements, review diagnostics.
- **CBIM.Library.Contract** — integration contract for the separate Library/Templates plugin. It reads `%LOCALAPPDATA%\CBIM\Library\manifest.json` and only resolves `.rfa` files inside declared local roots. No manufacturer family is bundled.
- **CBIM.Hydraulic.Plugin** — specialized native MEP pass: refines topology, creates Revit `Pipe`, and asks the Revit connector factory for elbows, tees, crosses and transitions/reducers.

## Build on the Revit 2027 Windows PC

```powershell
powershell -ExecutionPolicy Bypass -File .\build_revit_2027.ps1
powershell -ExecutionPolicy Bypass -File .\install_revit_2027.ps1 -SkipBuild
```

The source targets `.NET 8 / net8.0-windows` and references `RevitAPI.dll` / `RevitAPIUI.dll` from the locally installed Revit 2027 folder. The bundle intentionally does not redistribute Autodesk binaries.

## Core CLI
The generic plugin expects `cbim-revit` on PATH, or environment variable `CBIM_REVIT_CLI` pointing to the executable/script wrapper. `analyze-dwg` emits `.cbim.json` and `.revit-plan.json` directly; IFC is optional.
