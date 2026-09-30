
## 1.47.0
- Composite architecture recognition: stairs, slabs/floors, sanitary terminals and counters before wall fallback.
- Collinear compatible wall continuity merge.
- Explicit MEP elbow/tee/cross/reducer inference and conservative coupling candidates.
- Sanitary terminals participate in MEP connectivity/Z propagation when system-bound.
- Legacy IFC circular pipes/fittings via swept-disk geometry, distribution-system assignments, richer Psets/Qtos.
- IfcOpenShell backend mappings/quantities extended for Stair, SanitaryTerminal, Furniture and Valve.
- CBIM Python/.NET vocabulary extended; Python SDK 0.4.0.
# 1.43.0
- Added spatial CAD Text Intelligence for diameter, material, system, height, elevation and vertical-direction annotations.
- Added STRtree-based nearest text association to MEP evidence.
- Preserved height/elevation as CBIM hints without prematurely changing Z.
- Added v1.43 text-intelligence regression suite.

# Changelog

## 1.27.0 / Deliveries 36–40
- Discipline-aware real-DWG validation engine for architecture, structure, hydraulic and fire.
- Explicit evidence classification (`fixture`, `public_sample`, `real_project`) preventing synthetic data from satisfying production gates.
- Per-discipline metrics for import coverage, unsupported entities, recognition, confidence, review backlog, MEP networks and IFC sanity.
- Multi-discipline federation snapshot with ID collision detection and cross-discipline AABB clash candidates.
- `cbim-validate-dwg` CLI for four-DWG validation batches through ACadSharp.
- IFC Bridge extended with visible IFCPIPESEGMENT / IFCPIPEFITTING / equipment proxy geometry for MEP.
- Fixture validation batch artifacts demonstrating the complete 36–40 workflow without misrepresenting it as real-project evidence.

## 1.22.0 / Deliveries 31–35
- ACadSharp direct DWG provider process bridge.
- Import diagnostics and coverage.
- DWG compatibility matrix.
- Native XREF resolver.
- DWG → CBIM → IFC pipeline.
- Preserves legacy DXF-converter providers.

# Changelog

## v1.7.0 — entregas 16–20

- Brazilian Catalog engine + seed 2026.08 por famílias oficiais.
- MEP Connectivity graph com divisão de pipe em fitting/equipment intermediário.
- Persistência de relações CBIM `connects`.
- Recognition Intelligence determinística e auditável.
- QuantityCalculator para arquitetura, estrutura e MEP.
- CoreIntegrationGateway para viewer, clash candidates, issues, 5D e work packages 4D.
- Pipeline cumulativo atualizado para Profile → MEP → Connectivity → Catalog → Intelligence.
- Core atualizado para 1.7.0.

## v1.2.0 — entregas 11–15

- CAD Profiles.
- IFC Bridge.
- DWG Provider Boundary.
- Hydraulic Recognition.
- Fire Recognition.

## v0.7.0 — entregas 06–10

- Topology, Architecture, Levels/3D, Structure e Reviewer.

## v0.2.0 — entregas 01–05

- CBIM Foundation/Schema/Python/.NET e Geometry Engine.

## v1.12.0 — entregas 21–25

- CBIM Revision Diff com correspondência por proveniência/handle e categorias geometry/properties/system/storey/materials/name.
- Performance: SHA-256 estável de entidade, planning incremental conservador, tiles espaciais e benchmark harness.
- Complex Buildings: múltiplas torres/buildings, pavimentos, zonas e detecção de pavimentos-tipo repetidos.
- XREF/Multi-file: composição aninhada, transformações, namespaces, detecção de ciclos e preservação correta de blocos.
- Georeferencing: CRS projetado, survey origin/rotation, frames local/global e metadados CBIM.
- Core atualizado para 1.12.0.

## 1.17.0 — entregas 26–30

- Advanced Geometry com tesselação adaptativa e proveniência de curvas.
- Fingerprint geométrico e inteligência de repetição/alinhamento vertical.
- Propagação de pavimento-tipo preservando hosts e relações internas.
- Incremental Reprocessor com fingerprint de blocks/settings, recorte espacial e fallback global seguro.
- Otimização do planejamento incremental para evitar hashing duplicado.
- Benchmark XXL reproduzível com 51.200 entidades CAD, 4 torres e 160 pavimentos.
- Production/Scalability Gate de dois níveis, impedindo que fixtures sintéticos sejam tratados como validação de produção real.

## Cumulative 01–45 / Core 1.32.0
- Added Import Wizard and import-plan contract.
- Added editable project/storey configuration workflow.
- Added standalone CompatibilizaBIM Studio for recognition review and CBIM export.
- Added conservative CAD profile learning based only on explicit human review evidence.
- Added conversion readiness/quantities report in JSON and HTML.
- Added `cbim-product` CLI and product workflow regression tests.


## Cumulative 01–50 / Core 1.37.0
- Added atomic, versioned project workspaces with backup/revision support.
- Added hash-deduplicated autosave, crash-session marker and schema-validated recovery.
- Added local desktop server/API and `cbim-desktop` CLI; Studio can persist reviewed CBIM into a workspace.
- Added portable Windows/Linux bootstrap bundle around the wheels.
- Added offline Ed25519 customer licensing with installation binding and feature flags.
- Added strict First Commercial Pilot Gate that cannot be unlocked by fixtures/public samples.

## Cumulative 01–50 / Core 1.38.0 — Real-DWG hardening
- Replaced quadratic collinear-line merging with bucketed/sorted interval merging for real-project scale.
- Added conservative `Observed Brazil MEP v1` profile from the first real hydraulic/fire DWG evidence.
- Correctly separates `H-AF-TB` pipes from `H-AF-CX` fittings and hydraulic from fire/sprinkler layers.
- Parses block evidence such as `COR0900_20` into fitting type/angle and nominal diameter evidence.
- Reworked MEP recognition-rate denominator to count only discipline-eligible entities.
- Added ignored/unmapped/unclassified layer diagnostics.
- Removed automatic manufacturer/material claims unless the project/user explicitly selects or specifies a manufacturer.
- Added coherent auto-confirmation rules and explicit review flags for default/inferred properties.
- Added per-stage progress/timing output and timings JSON artifacts.
- Added Windows helper scripts to compile the ACadSharp bridge and rerun real hydraulic validation.

## Cumulative 01–50 / Core 1.39.0 — Topology scalability hardening
- Replaced quadratic topology intersection enumeration with Shapely STRtree spatial indexing.
- Added robust intersection cut handling for points, multipoints, collinear overlaps, multilines and geometry collections.
- Indexed endpoint gap repair instead of all-pairs endpoint comparisons.
- Indexed face-edge attribution instead of testing every edge against every face.
- Excludes profile-marked ignored annotation/helper linework from topology.
- Added topology substage progress, candidate counts and timing diagnostics.
- Added regression coverage and a reproducible 50,000-segment topology benchmark.


## Cumulative 01–50 / Core 1.40.0 — Recognizer scale + IfcOpenShell boundary
- Architecture wall-pair recognition moved from global pairwise enumeration to STRtree candidate lookup and cached Shapely geometries.
- Door/window host lookup and room-label polygon lookup are spatially indexed.
- Structural beam pairing uses STRtree candidates and cached geometries.
- MEP connectivity uses STRtree for component-on-pipe queries and a 3D spatial hash for node clustering/nearest lookup.
- Runtime progress adds resident-memory diagnostics where the platform exposes them.
- Added optional IfcOpenShell IFC4 authoring adapter with explicit CBIM→IFC class mapping, spatial containment, distribution-system assignment, custom CBIM property sets and visible mesh geometry.
- Added IfcOpenShell schema validation hook while preserving the verified legacy IFC bridge as the default compatibility path.
- Added stress regression tests for 20k architecture lines, 20k structural lines and 5k-pipe connectivity.


## Cumulative 01–50 / Core 1.40.1 — Architecture progress hotfix
- `architecture_wall_candidates` passa a emitir `elapsed` numérico real.
- CLI de validação não falha caso alguma subetapa futura emita `elapsed=None`.
- Adicionados testes de regressão para os dois comportamentos.

## Cumulative 01–50 / Core 1.41.0 — CBIM Catalog Brasil + evidence-based MEP
- Added conservative CAD layer roles: MEP, architecture, annotation, context and unknown.
- Added document-level MEP evidence engine using layer/profile, block semantics, nearby DN/material/system text, MEP component connectivity and seeded network propagation.
- Added a negative detector for local repetitive parallel short-line patterns to suppress stair/tread false positives when no MEP corroboration exists.
- Expanded CBIM Catalog Brasil family knowledge for Amanco Wavin, Tigre, Krona, Astra, Fortlev, Docol, Victaulic, Viking, Reliable, Schneider Electric and Siemens.
- Added neutral `CatalogAdvisor`: catalog correspondences increase confidence only after MEP plausibility; they never force a manufacturer.
- Added catalog correspondence as a small auditable Recognition Intelligence signal.
- Added open-source capability registry for ACadSharp, IfcOpenShell, bSDD, CADTransformer, VecFormer, buildingSMART Sample-Test-Files and LibreDWG.
- Added external ML prediction seam via bounded `ml_target`, `ml_system`, `ml_confidence` and `ml_source` metadata.
- Validation now separates architecture/context/annotation/unknown CAD and reports catalog advisory/assignment counts; warnings focus on truly unknown non-annotation content.


## Cumulative 01–50 / Core 1.42.0 — MEP Semantic Gate
- Known MEP layers no longer auto-create Pipe/Fitting without corroborating evidence.
- Added explicit evidence decisions: `auto_create`, `candidate`, and `reject`.
- Added strong-evidence accounting and negative evidence reasons.
- Unknown `H-*-CX` blocks remain review candidates; recognized fitting/equipment blocks continue to auto-create.
- Same-system network propagation is limited to approximately collinear line continuation unless a recognized component provides the junction evidence.
- Repetitive stair/tread-like patterns are rejected when no independent MEP evidence exists.
- Hydraulic/fire recognizers persist semantic-gate summaries in CBIM project metadata.
- Validation reports expose auto-created/candidate/rejected evidence counts while keeping recognition-rate denominator restricted to auto-eligible entities.
- Preserves ACadSharp, Shapely/STRtree, IfcOpenShell, bSDD and external CADTransformer/VecFormer evidence seams from prior releases.


## 2.1.0 — Revit phases 14–16
- Added deterministic CBIM → Revit Build Plan compiler.
- Added `cbim-revit` CLI for compile, library resolution, hydraulic refinement and direct DWG analysis through ACadSharp without requiring IFC.
- Added Revit 2027 generic CBIM add-in source with Import/Analyze/Reconstruct/Review ribbon.
- Added safe local Library manifest contract shared with the separate Library/Templates plugin.
- Added Revit 2027 Hydraulic add-in source with native Pipe and connector-driven elbows/tees/crosses/reducers.
- Existing CBIM fittings are enriched with incident pipe-operation dependencies for native connector creation.
- Generic Revit reconstruction deliberately skips Pipe/Fitting creation; Hydraulic owns native MEP to prevent duplication.
- Added Windows Core/ACadSharp bootstrap and Revit 2027 build/install/uninstall scripts.
- No proprietary Autodesk binaries or manufacturer RFA files are redistributed.
