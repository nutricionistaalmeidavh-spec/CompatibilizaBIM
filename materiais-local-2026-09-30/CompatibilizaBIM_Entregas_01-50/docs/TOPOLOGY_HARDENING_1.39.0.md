# Topology hardening — Core 1.39.0

## Trigger

A real hydraulic DWG (`QUA-HID-LO-0100-TERR-R02.dwg`) imported 46,921 entities and normalized 45,690 entities quickly, then stalled in `TopologyEngine.build()` while evaluating Shapely intersections. The v1.38 implementation used `combinations(raw, 2)`, which makes sparse drawings pay for all possible line pairs.

## Changes

- Replaced all-pairs line intersection search with Shapely `STRtree` spatial queries.
- Deduplicates symmetric intersection pairs (`j > i`) and performs exact intersection only for spatially intersecting candidates.
- Robust cut-point extraction for `Point`, `MultiPoint`, linear overlaps, `MultiLineString`, and `GeometryCollection`.
- Excludes line/polyline entities explicitly marked `semantic_target=ignore` by CAD profiles.
- Replaced all-pairs endpoint gap repair with an indexed `dwithin` neighbor search while retaining deterministic greedy repair order.
- Replaced face-to-all-edge attribution with an indexed edge query.
- Added internal topology progress stages and timing/candidate diagnostics to `TopologyGraph.metadata`.

## Progress stages

The existing progress callback now also reports:

- `topology_spatial_index`
- `topology_intersections`
- `topology_edges`
- `topology_gap_repair`
- `topology_faces`

This lets a real Windows run show where time is spent inside topology instead of only showing one long `START topology` interval.

## Verification in packaging environment

Baseline v1.38 sparse parallel-line benchmark:

- 250 segments: ~0.440 s
- 500 segments: ~1.709 s
- 1,000 segments: ~6.844 s

v1.39 implementation on the same 1,000-segment shape: ~0.049 s.

50,000 sparse segments with indexed gap-repair enabled completed in ~5.991 s, producing 100,000 nodes and 50,000 edges with zero unnecessary intersection candidates in that synthetic case.

Synthetic timing is not a promise for a real project. The decisive validation remains rerunning the real `QUA-HID-LO-0100-TERR-R02.dwg` on Windows with the compiled ACadSharp bridge.
