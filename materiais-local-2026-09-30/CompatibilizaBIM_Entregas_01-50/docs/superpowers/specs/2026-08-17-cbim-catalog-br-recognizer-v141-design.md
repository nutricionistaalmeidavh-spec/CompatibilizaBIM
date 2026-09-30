# CompatibilizaBIM v1.41 — CBIM Catalog Brasil + MEP Evidence Design

## Goal
Reduce false-positive MEP reconstruction (notably architectural/stair linework becoming pipes), add a neutral Brazilian product-knowledge layer, and integrate selected open-source BIM/CAD resources without redistributing restricted manufacturer or non-commercial datasets.

## Architecture
1. **MEP semantic gate** classifies each CAD entity/layer as MEP, architecture, annotation, context, or unknown before Pipe/Fitting creation. Geometry alone is never sufficient evidence for MEP.
2. **Evidence engine** combines layer/block tokens, nearby CAD text, connectivity among independently plausible MEP entities, profile metadata, and optional external ML hints. It returns a semantic candidate, score, reasons, and extracted parameters such as DN/material.
3. **CBIM Catalog Brasil** stores neutral product-family signatures plus manufacturer-family metadata. Catalog matches rerank/confirm an already plausible MEP candidate; they never create MEP by themselves and never assign a manufacturer unless the project/user explicitly specifies one.
4. **Open-source registry/adapters** records ACadSharp, IfcOpenShell, buildingSMART bSDD, CADTransformer, VecFormer, buildingSMART Sample-Test-Files, and LibreDWG with role/license/integration status. CADTransformer/VecFormer are consumed through a generic external-prediction metadata seam rather than bundled model weights.
5. **Validation diagnostics** split non-MEP CAD into architecture/context/annotation/unknown and expose catalog-advisory counts.

## Catalog scope
Seed official public family-level metadata only; do not redistribute RFA/DWG/proprietary manufacturer libraries. Initial canonical families cover Amanco Wavin, Tigre, Krona, Astra, Fortlev and neutral adapters for fire/electrical manufacturers. Public product names/line descriptions are reference metadata, not product endorsement.

## Open-source policy
- Bundled/declared integration: ACadSharp (existing), IfcOpenShell optional backend, bSDD adapter metadata, CADTransformer/VecFormer prediction adapter, buildingSMART Sample-Test-Files test-source registry, LibreDWG fallback registry.
- Do **not** bundle FloorPlanCAD, CubiCasa5K, ArchCAD-400K or other NC/research-only datasets in a commercial distribution.

## MEP acceptance rules
- Known architectural/context layers (e.g. ALVENARIA, ESCADA, PROJECAO, EIXO, PISO, VAGAS, FOLHA, FORRO, LAYOUT, AR) are blocked from automatic MEP classification unless an explicit profile or high-confidence external semantic override marks them MEP.
- A line/polyline needs a recognized MEP layer/profile plus at least one corroborating signal (explicit DN/material/system text, explicit semantic profile metadata, or connectivity to independently plausible MEP components) to auto-create a Pipe. Observed exact H-*-TB conventions count as strong profile/layer evidence but default-diameter-only elements remain review candidates.
- Inserts require MEP layer/profile or recognized MEP block semantics; fitting/equipment type comes from block/text evidence.
- Catalog correspondence may raise confidence and attach advisory candidate text; absence of a catalog match may prevent auto-confirmation but does not reject a geometrically/semantically valid generic component.

## Compatibility
CBIM schema stays 0.2.0. Existing legacy IFC and IfcOpenShell backends remain unchanged. Existing public APIs stay backward compatible; new evidence functions are additive.

## Verification
TDD regressions cover: architectural/stair linework never becoming pipe, MEP line + DN text becoming pipe, fitting block classification, catalog not forcing manufacturer, family matching across multiple Brazilian manufacturers, open-source registry license metadata, validation breakdown, and existing full Core/CBIM suites.
