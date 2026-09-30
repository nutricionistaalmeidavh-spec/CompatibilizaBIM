# Real DWG validation

After building `dwg-acadsharp-bridge`, run:

```bash
cbim-validate-dwg \
  --architecture /path/to/ARQ.dwg \
  --structure /path/to/EST.dwg \
  --hydraulic /path/to/HID.dwg \
  --fire /path/to/INC.dwg \
  --bridge-exe /path/to/CompatibilizaBIM.ACadSharpBridge \
  --output validation-output
```

Outputs include one `.cbim.json`, `.ifc`, and `.validation.json` per discipline, plus `federation.json` and `validation-batch.json`.

Only files explicitly tagged `evidence_kind=real_project` and executed by the ACadSharp native provider can satisfy the production evidence gate. Fixtures/public examples can exercise the framework but cannot unlock production readiness.
