from __future__ import annotations
import json
from pathlib import Path
from cbim_sdk import CBIMProject
from compatibilizabim_core.commercial.workspace import WorkspaceStore
from compatibilizabim_core.product.import_wizard import build_import_plan
from compatibilizabim_core.product.models import ProjectConfiguration
from compatibilizabim_core.desktop.server import DesktopApplication

def make_app(tmp_path):
    artifact=Path(__file__).resolve().parents[2]/'artifacts'/'cad-to-cbim-demo.cbim.json'
    project=CBIMProject.model_validate_json(artifact.read_text(encoding='utf-8'))
    plan=build_import_plan(['ARQ_TORRE.dwg'],ProjectConfiguration(project_name=project.name))
    store=WorkspaceStore.create(tmp_path/'project',project,plan)
    app=DesktopApplication(store.root); app.autosave.begin_session()
    return app,store

def test_f5_annotations_are_workspace_scoped_and_reference_real_elements(tmp_path):
    app,store=make_app(tmp_path); element=store.load_project().elements[0]
    saved=app.save_annotation_payload(json.dumps({'element_id':element.id,'text':'Conferir conexão','tags':['pendência'],'author':'revisor'}).encode())
    assert saved['element_id']==element.id and saved['text']=='Conferir conexão'
    assert app.annotations_payload()['items'][0]['id']==saved['id']
    try: app.save_annotation_payload(json.dumps({'element_id':'missing','text':'x'}).encode())
    except ValueError as exc: assert 'elemento' in str(exc).lower()
    else: raise AssertionError('annotation accepted unknown element')

def test_f7_audit_records_review_side_actions_without_replacing_project_history(tmp_path):
    app,store=make_app(tmp_path); element=store.load_project().elements[0]
    app.save_annotation_payload(json.dumps({'element_id':element.id,'text':'Revisar','tags':[],'author':'qa'}).encode())
    audit=app.audit_payload()
    assert audit['items'] and audit['items'][-1]['action']=='annotation.created'
    assert store.status().revision==0

def test_f6_export_uses_canonical_project_rows(tmp_path):
    app,store=make_app(tmp_path)
    export=app.export_payload('elements')
    assert export['columns'][:4]==['id','type','name','review_state']
    assert len(export['rows'])==len(store.load_project().elements)
