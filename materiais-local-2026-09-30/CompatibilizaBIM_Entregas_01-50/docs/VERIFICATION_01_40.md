# Verification — Deliveries 01–40

## Executable scope

- Core regression suite including validation/federation/MEP IFC additions.
- CBIM SDK regression suite.
- Python compileall.
- Core and CBIM wheels.
- Clean wheel installation smoke test.
- Fixture evidence batch for all four disciplines.
- IFC MEP entity visibility and lossless CBIM round-trip.
- ZIP extraction and post-package regression suite.

## External boundary

The environment has no `.NET SDK`, no restored NuGet cache and no outbound DNS. Therefore the ACadSharp bridge source cannot be compiled or executed here. This is represented as an external validation blocker, never as a pass.

A real-project pass requires four actual discipline DWGs (`architecture`, `structure`, `hydraulic`, `fire`) tagged `real_project` and processed by provider `acadsharp`. Fixtures/public samples cannot set `production_evidence_eligible=true`.
