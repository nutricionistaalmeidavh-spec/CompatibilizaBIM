from __future__ import annotations

import json
import threading
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.request import Request, urlopen

import pytest
from cbim_sdk import CBIMProject
from cbim_sdk.models import Point3D, Wall

from compatibilizabim_core.commercial import (
    AutosaveManager,
    CustomerConfiguration,
    FirstCommercialPilotGate,
    LicenseAuthority,
    LicensePayload,
    LicenseVerifier,
    verify_license_files,
    PilotEvidence,
    SignedLicense,
    WorkspaceStore,
)
from compatibilizabim_core.desktop.packaging import build_portable_desktop_bundle
from compatibilizabim_core.desktop.server import DesktopApplication
from compatibilizabim_core.product import ProjectConfiguration, build_import_plan


def project(name='Pilot Project'):
    return CBIMProject(name=name,elements=[Wall(id='w1',start=Point3D(x=0,y=0),end=Point3D(x=4,y=0),thickness=.14,height=2.8,confidence=.95,review_state='confirmed')])


def plan(name='Pilot Project'):
    return build_import_plan(['ARQ.dwg'],ProjectConfiguration(project_name=name))


def test_workspace_persists_reopens_and_snapshots_atomically(tmp_path):
    p=project();store=WorkspaceStore.create(tmp_path/'workspace',p,plan())
    assert store.load_project().id==p.id
    edited=p.model_copy(update={'name':'Pilot Project R2'})
    store.save_project(edited)
    snapshot=store.create_revision_snapshot('approved')
    status=store.status()
    assert status.revision==1 and status.project_name=='Pilot Project R2'
    assert len(status.project_sha256)==64 and snapshot.exists()
    reopened=WorkspaceStore(tmp_path/'workspace')
    assert reopened.load_project().name=='Pilot Project R2'
    backup=reopened.export_backup(tmp_path/'backup.cbim-workspace.zip')
    assert backup.exists() and backup.stat().st_size>100


def test_autosave_detects_crash_recovers_and_rotates(tmp_path):
    p=project();store=WorkspaceStore.create(tmp_path/'workspace',p,plan());mgr=AutosaveManager(store,retain=2)
    mgr.begin_session()
    assert mgr.autosave(p) is not None
    assert mgr.autosave(p) is None
    for i in range(3):
        changed=p.model_copy(update={'name':f'R{i}'})
        mgr.autosave(changed)
    assert mgr.recovery_candidates()==[]  # sessão atual não é tratada como falha
    mgr.begin_session()  # simula reabertura após encerramento sem mark_clean_shutdown
    candidates=mgr.recovery_candidates()
    assert len(candidates)==1
    recovered=mgr.recover_latest()
    assert recovered.name=='R2'
    mgr.mark_clean_shutdown()
    assert mgr.recovery_candidates()==[]


def test_offline_ed25519_license_is_customer_and_installation_bound():
    private,public=LicenseAuthority.generate_keypair()
    customer=CustomerConfiguration(customer_id='mh-hidraulica',customer_name='MH Hidráulica')
    payload=LicensePayload(license_id='LIC-001',customer_id=customer.customer_id,customer_name=customer.customer_name,installation_ids=[customer.installation_id],features=['cad_to_cbim','ifc_export','quantities'])
    signed=LicenseAuthority.issue(payload,private)
    result=LicenseVerifier(public).verify(signed,customer)
    assert result.valid and 'quantities' in result.features
    other=customer.model_copy(update={'installation_id':'different'})
    assert not LicenseVerifier(public).verify(signed,other).valid
    tampered=SignedLicense(payload=signed.payload.model_copy(update={'edition':'professional'}),signature_b64=signed.signature_b64)
    assert LicenseVerifier(public).verify(tampered,customer).reason=='invalid_signature'


def test_file_license_verifier_can_require_desktop_feature(tmp_path):
    private,public=LicenseAuthority.generate_keypair();customer=CustomerConfiguration(customer_id='c',customer_name='C')
    payload=LicensePayload(license_id='x',customer_id='c',customer_name='C',installation_ids=[customer.installation_id],features=['cad_to_cbim'])
    signed=LicenseAuthority.issue(payload,private)
    pub=tmp_path/'public.pem';cust=tmp_path/'customer.json';lic=tmp_path/'license.json'
    pub.write_bytes(public);cust.write_text(customer.model_dump_json());lic.write_text(signed.model_dump_json())
    result=verify_license_files(pub,cust,lic,required_feature='desktop')
    assert not result.valid and result.reason=='missing_feature:desktop'


def test_expired_license_fails():
    private,public=LicenseAuthority.generate_keypair();customer=CustomerConfiguration(customer_id='c',customer_name='C')
    payload=LicensePayload(license_id='x',customer_id='c',customer_name='C',installation_ids=[customer.installation_id],expires_at=datetime.now(timezone.utc)-timedelta(seconds=1))
    signed=LicenseAuthority.issue(payload,private)
    assert LicenseVerifier(public).verify(signed,customer).reason=='expired'


def test_first_commercial_pilot_gate_never_accepts_fixture_evidence():
    base=dict(native_dwg_backend_validated=True,disciplines_validated=['architecture','structure','hydraulic','fire'],import_coverage=.99,recognition_coverage=.9,pending_review_ratio=.1,ifc_export_passed=True,federation_passed=True,quantities_passed=True,persistence_passed=True,recovery_passed=True,desktop_smoke_passed=True,license_validation_passed=True,real_element_count=1000)
    fixture=FirstCommercialPilotGate().evaluate(PilotEvidence(**base,evidence_kind='fixture',production_evidence_eligible=False))
    assert not fixture.pilot_ready and 'real_evidence' in fixture.blockers
    real=FirstCommercialPilotGate().evaluate(PilotEvidence(**base,evidence_kind='real_client_project',production_evidence_eligible=True))
    assert real.pilot_ready and real.status=='commercial_pilot_ready'


def test_desktop_server_serves_status_and_persists_project(tmp_path):
    p=project();store=WorkspaceStore.create(tmp_path/'workspace',p,plan());app=DesktopApplication(store.root)
    server=app.start(port=0,open_browser=False);thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
    base=f'http://127.0.0.1:{server.server_address[1]}'
    try:
        status=json.loads(urlopen(base+'/api/status',timeout=3).read())
        assert status['project_name']=='Pilot Project'
        canonical=json.loads(urlopen(base+'/api/canonical',timeout=3).read())
        assert canonical['project']['id']==p.id
        assert canonical['revision']==0
        assert canonical['elements'][0]['id']=='w1'
        assert canonical['elements'][0]['review_state']=='confirmed'
        assert b'CompatibilizaBIM Studio' in urlopen(base+'/',timeout=3).read()
        changed=p.model_copy(update={'name':'Saved from Desktop'})
        req=Request(base+'/api/project',data=changed.model_dump_json(by_alias=True,exclude_computed_fields=True).encode(),method='POST',headers={'Content-Type':'application/json'})
        result=json.loads(urlopen(req,timeout=3).read())
        assert result['project_name']=='Saved from Desktop'
        assert store.load_project().name=='Saved from Desktop'
    finally:
        server.shutdown();server.server_close();thread.join(timeout=3)


def test_portable_desktop_bundle_contains_launch_and_integrity_manifest(tmp_path):
    w1=tmp_path/'cbim_sdk-0.3.0-py3-none-any.whl';w2=tmp_path/'compatibilizabim_core-1.37.0-py3-none-any.whl';w1.write_bytes(b'wheel1');w2.write_bytes(b'wheel2')
    out=build_portable_desktop_bundle(tmp_path/'bundle',[w1,w2],version='1.37.0')
    manifest=json.loads((out/'package-manifest.json').read_text())
    assert manifest['version']=='1.37.0' and not manifest['native_installer']
    assert (out/'launch_windows.bat').exists() and (out/'launch_linux.sh').exists()
    assert all(len(item['sha256'])==64 for item in manifest['wheels'])
