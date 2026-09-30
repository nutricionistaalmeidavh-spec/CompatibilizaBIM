# MEP Semantic Gate — Core 1.42.0

## Why
Revit inspection of a real converted hydraulic DWG showed that some stair/detail linework was being emitted as piping. The v1.41 evidence engine improved diagnostics but still allowed a known MEP layer to be sufficient for element creation.

## v1.42 rule
A CAD entity may be a **MEP candidate** from its layer/profile, but it becomes an IFC-bound CBIM element only when independent evidence corroborates it.

### Pipe corroboration
Any one of the following may corroborate a known MEP candidate:
- explicit DN/diameter token from layer/block/nearby CAD text;
- matching system text such as AF/AQ/ESG/AP/INC/SPK;
- explicit CAD profile mapping;
- connection to an independently recognized fitting/equipment block;
- propagation from a strong seed through an approximately collinear same-system continuation;
- bounded high-confidence external CAD/ML hint that agrees with the CAD semantic candidate.

### Negative evidence
- architecture/context/annotation layers stay blocked;
- repetitive short parallel line patterns without direct MEP evidence are rejected;
- direction changes are not propagated line-to-line automatically; they need fitting/component evidence.

### Inserts
`H-*-CX` or equivalent layers alone do not prove a fitting. The block/profile/external evidence must independently support the component type.

## Diagnostics
Project metadata now contains:
- `<discipline>_evidence_auto_create_count`
- `<discipline>_evidence_candidate_count`
- `<discipline>_evidence_rejected_count`
- `<discipline>_evidence_candidate_layers` (JSON string when candidates exist)

Validation reports expose the same three evidence counts.

## Open-source boundary
This stage intentionally reuses the deterministic open-source geometry stack already proven in the Core: ACadSharp for DWG and Shapely/STRtree/spatial bucketing for geometry/topology. Rtree is not added as a second spatial dependency because it would duplicate the existing index layer without improving this gate. IfcOpenShell/bSDD remain downstream IFC semantics; CADTransformer/VecFormer remain evidence adapters and cannot override hard CAD/context rules.
