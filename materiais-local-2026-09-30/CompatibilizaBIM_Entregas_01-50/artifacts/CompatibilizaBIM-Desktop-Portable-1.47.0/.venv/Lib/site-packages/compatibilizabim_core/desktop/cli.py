from __future__ import annotations

import argparse,json,threading,time
from pathlib import Path
from urllib.request import urlopen

from cbim_sdk import CBIMProject
from compatibilizabim_core.product.models import ImportPlan
from compatibilizabim_core.commercial.workspace import WorkspaceStore
from compatibilizabim_core.commercial.recovery import AutosaveManager
from compatibilizabim_core.commercial.licensing import verify_license_files
from .server import DesktopApplication,serve_workspace


def main(argv=None):
    p=argparse.ArgumentParser(prog='cbim-desktop',description='CompatibilizaBIM local desktop/workspace tools (deliveries 46-50)');sub=p.add_subparsers(dest='cmd',required=True)
    c=sub.add_parser('create');c.add_argument('workspace');c.add_argument('--project',required=True);c.add_argument('--plan',required=True)
    s=sub.add_parser('serve');s.add_argument('workspace');s.add_argument('--host',default='127.0.0.1');s.add_argument('--port',type=int,default=8765);s.add_argument('--no-browser',action='store_true');s.add_argument('--public-key');s.add_argument('--customer');s.add_argument('--license')
    st=sub.add_parser('status');st.add_argument('workspace')
    au=sub.add_parser('autosave');au.add_argument('workspace');au.add_argument('--project')
    rc=sub.add_parser('recover');rc.add_argument('workspace');rc.add_argument('--commit',action='store_true')
    a=p.parse_args(argv)
    if a.cmd=='create':
        proj=CBIMProject.model_validate_json(Path(a.project).read_text(encoding='utf-8'));plan=ImportPlan.model_validate_json(Path(a.plan).read_text(encoding='utf-8'));store=WorkspaceStore.create(a.workspace,proj,plan);print(store.status().model_dump_json(indent=2))
    elif a.cmd=='serve':
        licensing=[a.public_key,a.customer,a.license]
        if any(licensing):
            if not all(licensing): raise SystemExit('Forneça --public-key, --customer e --license juntos')
            validation=verify_license_files(a.public_key,a.customer,a.license,required_feature='desktop')
            if not validation.valid: raise SystemExit(f'Licença inválida: {validation.reason}')
        serve_workspace(a.workspace,host=a.host,port=a.port,open_browser=not a.no_browser)
    elif a.cmd=='status':print(WorkspaceStore(a.workspace).status().model_dump_json(indent=2))
    elif a.cmd=='autosave':
        store=WorkspaceStore(a.workspace);mgr=AutosaveManager(store);project=CBIMProject.model_validate_json(Path(a.project).read_text()) if a.project else store.load_project();path=mgr.autosave(project);print(json.dumps({'autosave':str(path) if path else None}))
    else:
        store=WorkspaceStore(a.workspace);mgr=AutosaveManager(store);project=mgr.recover_latest(commit=a.commit);print(project.model_dump_json(by_alias=True,exclude_computed_fields=True,indent=2))


if __name__=='__main__':
    main()
