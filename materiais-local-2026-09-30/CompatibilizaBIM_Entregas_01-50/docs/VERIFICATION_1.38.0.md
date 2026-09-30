# Verification — Core 1.38.0

## Verdict

- Regression suite: PASS.
- Real-DWG hardening fixture derived from observed project conventions: PASS.
- 50k collinear-segment performance regression: PASS.
- Wheel build/install smoke: PASS.
- ACadSharp post-patch execution on the user's Windows machine: **must be rerun after installing this ZIP**. The current container has no .NET runtime/SDK, so that final external boundary is not falsely marked as verified here.

## Fresh evidence

See `verification-results-1.38.0.txt`. Core has 79 tests passing; CBIM Python SDK has 6 tests passing. Source coverage for `compatibilizabim_core` is 91% in this run.

## Material changes verified

- H-AF-TB line -> hydraulic Pipe.
- H-AF-CX insert + `COR0900_20` -> elbow Fitting, 90°, DN20.
- H-INC/REDE SPK excluded from hydraulic and available to fire recognition.
- Annotation layers excluded from MEP recognition denominator.
- Catalog manufacturer not written without explicit project/user evidence.
- High-confidence elements with sufficient evidence can auto-confirm; default diameter remains review-required.
- Validation reports expose eligible/ignored/unmapped/unclassified metrics.
- Progress/timing callback exercises geometry/topology/MEP/connectivity/intelligence stages.
- Collinear merge scales via bucketing/sorting rather than repeated all-pairs passes.
