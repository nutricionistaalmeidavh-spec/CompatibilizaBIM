# ACadSharp DWG backend

CompatibilizaBIM uses a process boundary: ACadSharp (.NET/MIT) reads DWG and emits Canonical CAD JSON. The Core never imports ACadSharp classes directly. The bridge is pinned to ACadSharp 3.6.51.

Supported reader signatures declared upstream: AC1014, AC1015, AC1018, AC1021, AC1024, AC1027, AC1032. AC1009/AC1012 are not declared DWG-readable by ACadSharp.

Diagnostics expose entity counts, converted/unsupported counts, canonical kinds, source entity types, warnings, blocks and XREF count. Unknown entity types are reported rather than silently fabricated.
