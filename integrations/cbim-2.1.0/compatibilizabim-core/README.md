# CompatibilizaBIM Core 1.47.0

Core cumulativo CAD → CBIM. O CBIM permanece independente do Core e do plugin Revit.

Módulos principais incluem CAD/DXF, Geometry, Advanced Geometry, Topology, Architecture, Levels, Structure, Reviewer, Profiles, IFC, DWG provider boundary, MEP, Catalog BR, Connectivity, Intelligence, Quantities, Integration, Diff, Performance/Incremental Reprocessing, Complex Buildings, Vertical Intelligence, XREF, Georeferencing, Benchmark XXL e Production/Scalability Gate.

Use o `README.md` na raiz da entrega e `docs/VERIFICATION_01_35.md` para o estado validado.


## Native DWG 1.22.0
ACadSharp is the primary open-source native DWG provider via an isolated .NET JSON bridge. The legacy DXF-converter provider boundary remains supported as a fallback.

## 1.43.0 Text Intelligence
`compatibilizabim_core.mep.text_intelligence` parses and spatially associates vector CAD text (diameter, material, system, height/elevation and vertical direction) as evidence for MEP recognition. Z remains unchanged until the dedicated 3D reconstruction stage.

## 1.44.0 MEP Z Reconstruction
Height/elevation/vertical text evidence is now converted into conservative MEP Z geometry with same-system network propagation and conflict protection. Large absolute project elevations require an explicit datum.


## 1.47.0 Revit Quality Reconstruction
Composite CAD patterns are classified before wall fallback (stairs, floor/slab, sanitary terminals and counters), collinear wall fragments are merged, MEP junctions gain explicit fitting semantics, legacy IFC pipes use circular swept-disk geometry, and both IFC backends emit richer property/quantity data for downstream Revit schedules.
