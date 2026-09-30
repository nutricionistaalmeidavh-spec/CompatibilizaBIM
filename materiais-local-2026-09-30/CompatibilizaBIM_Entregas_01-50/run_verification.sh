#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
export PYTHONPATH="$ROOT/compatibilizabim-core/src:$ROOT/cbim-sdk/python/src"
python -m compileall -q "$ROOT/compatibilizabim-core/src" "$ROOT/cbim-sdk/python/src"
(cd "$ROOT/compatibilizabim-core" && pytest -q)
(cd "$ROOT/cbim-sdk/python" && PYTHONPATH=src pytest -q)
python - <<'PY'
from pathlib import Path
from html.parser import HTMLParser
from cbim_sdk import CBIMProject
from compatibilizabim_core.product.models import ImportPlan
from compatibilizabim_core.commercial import WorkspaceStore,AutosaveManager,CustomerConfiguration,SignedLicense,LicenseVerifier,PilotEvidence,FirstCommercialPilotGate
root=Path.cwd()
CBIMProject.model_validate_json((root/'artifacts/reviewed-demo-01-45.cbim.json').read_text())
ImportPlan.model_validate_json((root/'artifacts/import-plan-01-45.json').read_text())
HTMLParser().feed((root/'artifacts/compatibilizabim-studio-01-50.html').read_text())
store=WorkspaceStore(root/'artifacts/workspace-demo-01-50');store.load_project();store.load_import_plan();assert store.status().has_report
customer=CustomerConfiguration.model_validate_json((root/'artifacts/demo-customer-01-50.json').read_text())
lic=SignedLicense.model_validate_json((root/'artifacts/demo-license-01-50.json').read_text())
assert LicenseVerifier((root/'artifacts/demo-license-public-01-50.pem').read_bytes()).verify(lic,customer).valid
e=PilotEvidence.model_validate_json((root/'artifacts/commercial-pilot-evidence-01-50.json').read_text())
r=FirstCommercialPilotGate().evaluate(e);assert not r.pilot_ready and 'real_evidence' in r.blockers
assert not any(root.rglob('*.pem')) or not any('PRIVATE KEY' in p.read_text(errors='ignore') for p in root.rglob('*.pem'))
print('Product/commercial artifacts 01-50 PASS')
PY
echo "Verification 01-50 PASS"
