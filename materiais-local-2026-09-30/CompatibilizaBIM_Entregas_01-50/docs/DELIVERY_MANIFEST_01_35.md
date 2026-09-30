# Deliveries 31–35 — Native Open-Source DWG

31. ACadSharp native provider bridge (MIT, pinned to 3.6.51).
32. DWG import diagnostics and coverage report.
33. DWG signature/compatibility test matrix (AC1014–AC1032 declared readable by ACadSharp).
34. Native XREF resolver feeding the existing XREF composer.
35. End-to-end DWG → Canonical CAD → CBIM → IFC pipeline.

## Verification boundary
The Python orchestration and JSON bridge contract are executable in this package. The current build environment has no .NET SDK and cannot restore NuGet packages, so the ACadSharp C# bridge source is included but its binary build is marked unverified until .NET/NuGet is available. This is intentionally not represented as a production-ready native DWG backend.
