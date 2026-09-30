# Verification — Deliveries 01–35

## Executed
- Core tests: 55/55 PASS
- CBIM Python SDK tests: 6/6 PASS
- Core coverage: 91%
- CBIM SDK coverage: 95%
- Python compileall: PASS
- Core wheel 1.22.0: built and installed in a clean target
- CBIM wheel 0.3.0: built and installed in a clean target
- ACadSharp provider JSON subprocess contract: PASS with deterministic fake bridge
- DWG signature compatibility matrix: PASS
- Native XREF resolver: PASS
- DWG pipeline contract → CBIM → IFC4: PASS

## Native DWG evidence boundary
ACadSharp 3.6.51 is pinned in the included .NET bridge project. This runtime has no .NET SDK/NuGet access, so the C# bridge binary was not compiled or executed against a real semantic DWG here. Therefore `native_dwg_backend` remains a Production Gate blocker. The commercial ODA/RealDWG providers are no longer requirements; they are optional fallbacks.

## External validation still required
1. Compile/publish the ACadSharp bridge in an environment with .NET and NuGet restore.
2. Run the compatibility suite against real DWGs (architecture, structure, hydraulic, fire, XREF).
3. Validate at least one real large/high-end project end-to-end.
