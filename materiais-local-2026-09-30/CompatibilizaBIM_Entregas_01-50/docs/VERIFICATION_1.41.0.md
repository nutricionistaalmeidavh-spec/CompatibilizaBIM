# Verification — Core 1.41.0

## Fresh executable evidence
- Core test suite: **103/103 PASS**.
- CBIM SDK Python suite: **6/6 PASS**.
- `compileall` on Core source: **PASS**.
- Wheel `compatibilizabim_core-1.41.0-py3-none-any.whl`: built offline with no build isolation: **PASS**.
- Isolated wheel install + import as version `1.41.0`: **PASS**.
- Installed-wheel MEP regression: 7 repetitive parallel H-AF-TB lines (stair/tread synthetic) produce **0 pipes** without corroboration: **PASS**.
- Installed-wheel labeled MEP regression: `H-AF-TB` + nearby `AF Ø32 PVC` produces **1 DN32 PVC-hint pipe**: **PASS**.
- Installed-wheel catalog advisory: **5 neutral candidates**, `catalog_manufacturer=None`: **PASS**.
- Open-source registry: **7 capabilities** present; restricted/non-commercial datasets are not bundled.
- Catalog seed: **32 family-level items** across hydraulic/fire/electrical knowledge domains.
- Evidence-engine scale benchmark: **50,000 line entities → 50,000 evidence records in 8.892 s (~5,623 entities/s)** in this container.

## Real-project evidence boundary
The user proved Core 1.40.1 end-to-end on `QUA-HID-LO-0100-TERR-R02.dwg` on Windows/ACadSharp: 46,921 imported entities, 45,690 canonical entities, full topology/architecture/hydraulic/connectivity/IFC completion. Revit visual inspection then exposed MEP false positives, including stair-like CAD being emitted as piping. Core 1.41.0 directly targets that class of error, but the same DWG must be rerun on the user's Windows environment before claiming the visual false positive is fixed on that real file.

## Licensing/distribution boundary
Manufacturer BIM binaries are not redistributed. Catalog knowledge is family-level metadata/advisory only. CADTransformer and VecFormer model weights/datasets are not bundled. FloorPlanCAD, CubiCasa5K, ArchCAD-400K and other non-commercial/research-only datasets are excluded from the commercial package. LibreDWG remains reference-only pending GPL product/legal review.
