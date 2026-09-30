# Revit Phases 14–16 Design

## Goal
Deliver a Revit 2027 integration layer that reuses CBIM Core instead of duplicating recognition logic, connects to the separate Revit Library plugin through a stable local contract, and exposes a specialized hydraulic refinement/build workflow.

## Boundaries
- CBIM Core stays Revit-independent.
- Plugin CBIM is a Revit host/bridge and native-build orchestrator.
- Plugin Biblioteca remains a separate plugin/product; integration is via manifest/query/response contracts and a local cache, not shared proprietary family binaries.
- Plugin Hidráulica remains a separate plugin/product and consumes the same CBIM plan plus library resolution.
- IFC remains an optional output, not an internal requirement for native Revit authoring.

## Architecture
1. `compatibilizabim_core.revit` compiles a `CBIMProject` into a deterministic Revit Build Plan JSON.
2. The Build Plan contains native authoring operations for levels, walls, floors, pipes, fittings, fixtures and furniture, with CBIM IDs preserved for traceability.
3. A Library Resolver converts semantic family requirements into local-library queries and resolves only local indexed `.rfa`/type metadata; manufacturer content is never embedded in the Core package.
4. A Hydraulic Refiner validates pipe/fitting topology and emits hydraulic-specific diagnostics/actions before native build.
5. The C# Revit 2027 host reads the Build Plan and performs native Revit API transactions. The host source references local RevitAPI/RevitAPIUI assemblies and is built on the user's Revit 2027 Windows machine.
6. The C# shared contract project is Revit-API-free so it can be built/tested independently wherever .NET 8 exists.

## Native authoring mapping
- CBIM Storey -> Revit Level
- Wall -> Wall.Create with level + height + width/type preference
- Slab -> Floor.Create boundary profile
- Pipe -> Autodesk.Revit.DB.Plumbing.Pipe.Create; one operation per straight CBIM segment
- Fitting -> connector-driven elbow/tee/cross/reducer/coupling requests
- SanitaryTerminal/Equipment/Furniture -> library family request; fallback placeholder only when explicitly enabled
- Stair -> review/native-stair candidate operation unless enough geometry exists for safe native generation

## Library contract
Request fields: semantic class, subtype, system, material, nominal diameter, angle, connector count, Revit version and optional manufacturer preference.
Response fields: family path, family name, type name, connector metadata, score, source and license/redistribution policy. Resolver accepts only paths under configured local library roots.

## Hydraulic refinement
- Rigid pipe direction changes require fitting operations.
- Branch degree 3 -> tee request; degree 4 -> cross request.
- Diameter transition -> reducer request.
- Inline same-DN coupling is not invented without direct/block/library evidence; remains candidate.
- Disconnected endpoints, incompatible system/DN and unresolved family requirements are surfaced as diagnostics.
- Z and slope are preserved from CBIM; plugin must not flatten native MEP.

## CLI/IPC
`cbim-revit` commands:
- `compile --cbim ... --output ...`
- `resolve-library --plan ... --manifest ... --output ...`
- `refine-hydraulic --plan ... --output ...`
- `analyze-dwg --dwg ... --discipline ... --bridge-exe/--bridge-project ... --output ...`

`analyze-dwg` produces `.cbim.json` + `.revit-plan.json` directly, so the Revit plugin can call the same Core pipeline without IFC.

## Revit package
Three separate add-in roots are shipped:
- `CBIM.Revit.Plugin` — generic CBIM import/analyze/reconstruct/review.
- `CBIM.Library.Contract` — adapter contract used by the separate Library plugin.
- `CBIM.Hydraulic.Plugin` — hydraulic validation/refinement and native MEP build commands.

They share `CBIM.Revit.Contracts` and the same CBIM IDs.

## Safety and licensing
No proprietary manufacturer `.rfa` files are redistributed. The package contains only source code, manifests, generic metadata/contracts and local resolver logic. Native family loading is restricted to user/local library paths.

## Success criteria
- Python compile/refine/resolve flows are covered by deterministic tests.
- Existing CBIM Core regressions stay green.
- C# shared contract source is self-contained and syntactically coherent.
- Revit 2027 host includes `.addin` manifests and Windows build/install scripts that reference the locally installed Revit 2027 API.
- A demo CBIM project compiles into native Revit operations with pipes, elbows/tees/reducers, walls, slabs and fixture family requests.
