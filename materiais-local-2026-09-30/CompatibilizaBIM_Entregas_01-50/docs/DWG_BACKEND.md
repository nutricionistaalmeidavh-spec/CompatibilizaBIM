# DWG backend

The primary native DWG path is now the **ACadSharp provider** (MIT) through `dwg-acadsharp-bridge/`.

`ACadSharpProvider` executes the isolated .NET bridge and receives Canonical CAD JSON plus import diagnostics and XREF references. No ACadSharp class crosses into Python or CBIM.

Legacy providers that convert DWG to DXF remain compatible through `ExternalDWGConverter`; ODA/RealDWG are optional commercial fallbacks, not required by the architecture.

Production validation still requires building the bridge and running it against real DWGs. If no native bridge or fallback provider is available, the Core fails explicitly rather than silently pretending a DWG was parsed.
