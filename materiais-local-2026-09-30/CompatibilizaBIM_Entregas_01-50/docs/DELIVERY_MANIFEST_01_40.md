# Deliveries 36–40 — Real DWG validation & federation

36. Architecture real-DWG validation harness: import coverage, recognition rate, confidence, relevant element counts, IFC sanity and pending-review metrics.
37. Structural real-DWG validation harness: columns/beams/slabs/openings with the same evidence contract.
38. Hydraulic real-DWG validation harness: plumbing systems, pipes/fittings/equipment, connectivity and IFC evidence.
39. Fire real-DWG validation harness: fire systems, pipes/fittings/equipment, connectivity and IFC evidence.
40. Multi-discipline federation validation: architecture + structure + hydraulic + fire snapshots, cross-discipline AABB clash candidates, ID collision checks and batch evidence gating.

## Evidence rule
A synthetic fixture or public compatibility sample may validate code paths but **cannot** set `production_evidence_eligible=true`. Production evidence requires all four disciplines to be tagged `real_project`, processed through provider `acadsharp`, pass their thresholds, and federate without ID collisions.

## Environment boundary
This container has no .NET SDK/NuGet and no outbound DNS, so ACadSharp cannot be restored/compiled here. The CLI, validator, federation, reports, tests, and bridge contract are executable; the final real-project evidence remains blocked until the bridge is compiled on a machine with .NET and actual DWGs are provided.
