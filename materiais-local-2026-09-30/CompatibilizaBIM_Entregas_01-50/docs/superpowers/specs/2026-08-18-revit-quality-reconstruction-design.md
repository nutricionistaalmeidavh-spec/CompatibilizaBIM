# Revit Quality Reconstruction Design

## Goal
Consolidate the post-v1.44 Revit findings into one cumulative release: better architectural object reconstruction, better MEP network semantics, real circular pipe geometry, stronger IFC/Revit data, and conservative 3D reconstruction.

## Scope
1. Architectural semantics before wall detection: stairs, slabs/floors, sanitary fixtures, counters/furniture.
2. Entity reservation so the same CAD primitives cannot become both stair/furniture and walls.
3. Wall continuity merging for collinear/touching fragments.
4. MEP network reconstruction that splits multi-segment paths into straight pipes and inserts fittings at bends/junctions/reductions while remaining conservative.
5. Circular pipe geometry in the legacy IFC exporter and explicit IFC classes for new CBIM object types.
6. IFC properties/quantities sufficient for downstream Revit schedules/parameter inspection.
7. Preserve existing strict-evidence and Z-reconstruction behavior; do not invent Z where the DWG has no trustworthy evidence.

## Architecture
The CAD recognizers emit richer CBIM objects first. A network reconstruction stage then normalizes MEP elements into explicit pipes/fittings. Exporters consume the richer CBIM contract and add IFC semantics and quantities. The legacy exporter remains usable without IfcOpenShell; the optional IfcOpenShell backend receives equivalent mappings.

## Acceptance criteria
- Repetitive tread-like line groups are excluded from wall pairs and represented as a stair candidate/object.
- PISO/LAJE/FLOOR closed contours create Slab elements.
- PIA/CUBA/LAVATORIO blocks or closed contours create sanitary terminals, not walls.
- BALCAO/BANCADA/COUNTER/CABINET blocks or closed contours create furniture/counter objects, not walls.
- Adjacent collinear wall fragments with compatible thickness are merged.
- Bends in rigid MEP paths are split into straight Pipe objects with explicit elbow fittings.
- 3-way junctions produce Tee fittings when geometrically supported.
- Diameter changes produce Reducer candidates/fittings when supported.
- IFC pipe geometry is circular, not box-shaped.
- IFC contains properties and quantities for relevant elements.
- Existing Core and CBIM tests remain green; new regression tests cover all changes.
