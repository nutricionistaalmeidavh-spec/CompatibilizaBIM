# Deliveries 41–45 — Product workflow & review studio

41. **Import Wizard** — builds a deterministic import plan for DWG/DXF/IFC/CBIM sources, detects architecture/structure/hydraulic/fire from filenames, supports explicit overrides, rejects unsupported formats and blocks readiness while disciplines remain unknown.
42. **Recognition Review UI** — self-contained local HTML Studio that visualizes CBIM geometry, filters by type/state, confirms/edits/rejects recognition, supports undo/redo and exports the reviewed CBIM without making the UI a second source of truth.
43. **Project Configuration Wizard** — editable project name, units, coordinate reference, preferred manufacturer and multi-storey elevation/height configuration; configuration can be exported as JSON and converted to the Core level definitions.
44. **CAD Profile Learning UI/Engine** — learns only from explicit human `confirmed`/`edited` elements, aggregates layer/block evidence, requires repeated consistent observations before promoting a rule, and exports reusable `CadProfile` JSON.
45. **Conversion Report** — element counts, review states, confidence, pending-review blockers, completion rate, quantities and export-readiness, available as JSON and standalone HTML.

## Product boundary
The Studio edits project configuration and CBIM review state. It does not mutate original DWG/DXF files or treat browser state as authoritative CAD data. Exported reviewed CBIM re-enters the same deterministic Core pipeline used by IFC, quantities, federation and downstream coordination modules.

## Artifacts
- `artifacts/import-plan-01-45.json`
- `artifacts/reviewed-demo-01-45.cbim.json`
- `artifacts/learned-cad-profile-01-45.json`
- `artifacts/profile-learning-01-45.json`
- `artifacts/conversion-report-01-45.json`
- `artifacts/conversion-report-01-45.html`
- `artifacts/compatibilizabim-studio-01-45.html`

The UI demo is fixture/product evidence only. It does not change the real-DWG production evidence rule introduced in deliveries 36–40.
