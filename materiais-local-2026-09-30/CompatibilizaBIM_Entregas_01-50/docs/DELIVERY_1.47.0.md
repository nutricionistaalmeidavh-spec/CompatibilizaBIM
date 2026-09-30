# CompatibilizaBIM Core 1.47.0

Cumulative delivery preserving all previous modules.

## Architectural reconstruction
- regular stair tread groups are reserved before wall recognition
- closed floor/slab contours are promoted to CBIM Slab
- sink/lavatory/toilet/shower/tank symbols can become SanitaryTerminal
- counter/casework symbols can become Furniture
- compatible wall fragments are merged for continuity

## MEP reconstruction
- internal pipe bends and network junctions are classified as explicit elbow/tee/cross/reducer fittings
- coupling remains a candidate unless there is explicit evidence
- sanitary terminals participate in MEP connectivity and Z propagation when attached to a system
- existing non-zero CAD Z can seed network Z propagation

## IFC/Revit
- legacy IFC pipe representation uses IfcSweptDiskSolid rather than rectangular proxy solids
- multi-leg CBIM pipes are emitted as straight IfcPipeSegment legs
- Stair, SanitaryTerminal, Furniture and Valve semantics are exported
- CompatibilizaBIM property sets and base quantities are emitted for schedules/quantity workflows
- optional IfcOpenShell backend receives equivalent semantic classes and quantities

## Important validation boundary
Real QUA-HID results still require the Windows ACadSharp/Revit test. Synthetic/unit tests cannot prove that every real stair, floor, fixture, fitting or Z annotation is correctly reconstructed.
