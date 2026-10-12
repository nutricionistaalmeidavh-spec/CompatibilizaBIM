from __future__ import annotations

import json
from pathlib import Path

import pytest
from cbim_sdk import CBIMProject

from compatibilizabim_core.commercial.licensing import (
    CustomerConfiguration,
    LicenseAuthority,
    LicensePayload,
    save_customer_config,
    save_license,
)
from compatibilizabim_core.commercial.workspace import WorkspaceStore
from compatibilizabim_core.desktop.p1_launcher import prepare_workspace, verify_offline_license


def test_prepares_real_cbim_workspace_without_overwriting_existing(tmp_path):
    demo = Path(__file__).resolve().parents[2] / "artifacts" / "cad-to-cbim-demo.cbim.json"
    project = CBIMProject.model_validate_json(demo.read_text(encoding="utf-8"))
    source = tmp_path / "HID_REAL.dwg"
    source.write_bytes(b"AC1032" + b"\0" * 24)
    report = tmp_path / "hydraulic-HID_REAL.validation.json"
    report.write_text(json.dumps({"provider":"acadsharp","review_pending_count":7,"import_coverage":0.96}), encoding="utf-8")
    workspace = tmp_path / "jobs" / "example" / "studio-workspace"
    result = prepare_workspace(project_path=demo, source_path=source, discipline="hydraulic", workspace_path=workspace, validation_path=report)
    assert result["project_id"] == project.id
    store = WorkspaceStore(workspace)
    assert store.load_project().id == project.id
    assert store.load_import_plan().ready is True
    assert (workspace / "reports" / "native-dwg-validation.json").exists()
    with pytest.raises(FileExistsError):
        prepare_workspace(project_path=demo, source_path=source, discipline="hydraulic", workspace_path=workspace)


def test_offline_license_is_signed_bound_to_customer_and_edition(tmp_path):
    private, public = LicenseAuthority.generate_keypair()
    public_path = tmp_path / "issuer-public.pem"
    public_path.write_bytes(public)
    customer = CustomerConfiguration(customer_id="pilot-01", customer_name="Escritorio de Teste")
    config_path = save_customer_config(customer, tmp_path / "customer.json")
    payload = LicensePayload(license_id="L-P1-001", customer_id=customer.customer_id, customer_name=customer.customer_name, installation_ids=[customer.installation_id], features=["desktop", "cad_to_cbim", "ifc_export"])
    license_path = save_license(LicenseAuthority.issue(payload, private), tmp_path / "license.json")
    assert verify_offline_license(public_path, config_path, license_path, feature="desktop").valid
    assert verify_offline_license(public_path, config_path, license_path, feature="cad_to_cbim").valid
    assert not verify_offline_license(public_path, config_path, license_path, feature="premium_other").valid
    modified = json.loads(license_path.read_text(encoding="utf-8"))
    modified["payload"]["customer_name"] = "Outro"
    license_path.write_text(json.dumps(modified), encoding="utf-8")
    assert not verify_offline_license(public_path, config_path, license_path, feature="desktop").valid


def test_offline_license_absent_fails_closed(tmp_path):
    with pytest.raises(FileNotFoundError):
        verify_offline_license(tmp_path / "absent-public.pem", tmp_path / "absent-customer.json", tmp_path / "absent-license.json", feature="desktop")
