"""Entry point for P1 local Studio; never launches a public server."""
from __future__ import annotations

import argparse
import json
import secrets
import sys
import threading
from pathlib import Path

from cbim_sdk import CBIMProject
from compatibilizabim_core.commercial.licensing import LicenseValidation, verify_license_files
from compatibilizabim_core.commercial.workspace import WorkspaceStore
from compatibilizabim_core.product.import_wizard import build_import_plan
from compatibilizabim_core.product.models import ProjectConfiguration
from .server import DesktopApplication


def prepare_workspace(
    *, project_path: str | Path, source_path: str | Path, discipline: str,
    workspace_path: str | Path, validation_path: str | Path | None = None
) -> dict:
    """Persist a real Core document so the Studio edits the actual conversion result."""
    if discipline not in {'architecture', 'structure', 'hydraulic', 'fire'}:
        raise ValueError('Disciplina desconhecida')
    source = Path(source_path)
    if not source.is_file() or source.suffix.lower() != '.dwg':
        raise ValueError('Arquivo DWG original não encontrado')
    project = CBIMProject.model_validate_json(Path(project_path).read_text(encoding='utf-8'))
    plan = build_import_plan(
        [str(source)],
        ProjectConfiguration(project_name=project.name),
        discipline_overrides={str(source): discipline}
    )
    if not plan.ready:
        raise ValueError('Plano de importação incompleto; revise a disciplina')
    workspace = WorkspaceStore.create(workspace_path, project, plan)
    if validation_path:
        report = json.loads(Path(validation_path).read_text(encoding='utf-8'))
        workspace.save_report(report, 'native-dwg-validation.json')
    return workspace.status().model_dump(mode='json')


def verify_offline_license(public: str | Path, customer: str | Path, license_path: str | Path, *, feature: str = 'desktop') -> LicenseValidation:
    """Always verify the signed license, installation/customer binding and feature offline."""
    files = [Path(public), Path(customer), Path(license_path)]
    missing = [str(path) for path in files if not path.is_file()]
    if missing:
        raise FileNotFoundError('Material de ativação indisponível: ' + ', '.join(missing))
    return verify_license_files(public, customer, license_path, required_feature=feature)


def serve_secure_workspace(workspace: str | Path, *, public: str | None = None,
                           customer: str | None = None, license_path: str | None = None,
                           require_license: bool = False) -> None:
    provided = [public, customer, license_path]
    if require_license and not all(provided):
        raise PermissionError('Ativação offline obrigatória: importe a chave pública, os dados do cliente e a licença assinada')
    if any(provided):
        if not all(provided):
            raise PermissionError('Configuração de licença incompleta')
        result = verify_offline_license(public, customer, license_path, feature='desktop')
        if not result.valid:
            raise PermissionError('Licença do Studio inválida: ' + result.reason)
    application = DesktopApplication(workspace, session_token=secrets.token_urlsafe(32))
    application.autosave.begin_session()
    server = application.start(host='127.0.0.1', port=0, open_browser=False)

    def close_on_stdin() -> None:
        for line in sys.stdin:
            if line.strip() == 'quit':
                server.shutdown()
                break

    threading.Thread(target=close_on_stdin, name='studio-parent-watch', daemon=True).start()
    print('CBIM_STUDIO_READY ' + json.dumps({
        'host': '127.0.0.1', 'port': server.server_port,
        'token': application.session_token,
        'workspace': str(Path(workspace).resolve())
    }), flush=True)
    try:
        server.serve_forever()
    finally:
        application.autosave.mark_clean_shutdown()
        server.server_close()


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description='P1 CBIM Studio: workspace seguro e licença offline')
    sub = p.add_subparsers(dest='command', required=True)
    prepare = sub.add_parser('prepare')
    prepare.add_argument('--project', required=True)
    prepare.add_argument('--source', required=True)
    prepare.add_argument('--discipline', choices=('architecture', 'structure', 'hydraulic', 'fire'), required=True)
    prepare.add_argument('--workspace', required=True)
    prepare.add_argument('--validation-report')
    serve = sub.add_parser('serve')
    serve.add_argument('--workspace', required=True)
    serve.add_argument('--public-key')
    serve.add_argument('--customer')
    serve.add_argument('--license')
    serve.add_argument('--require-license', action='store_true')
    verify = sub.add_parser('verify')
    verify.add_argument('--public-key', required=True)
    verify.add_argument('--customer', required=True)
    verify.add_argument('--license', required=True)
    verify.add_argument('--feature', default='desktop')
    args = p.parse_args(argv)
    try:
        if args.command == 'prepare':
            result = prepare_workspace(
                project_path=args.project, source_path=args.source,
                discipline=args.discipline, workspace_path=args.workspace,
                validation_path=args.validation_report
            )
            print(json.dumps(result, ensure_ascii=False), flush=True)
        elif args.command == 'serve':
            serve_secure_workspace(
                args.workspace, public=args.public_key, customer=args.customer,
                license_path=args.license, require_license=args.require_license
            )
        else:
            result = verify_offline_license(args.public_key, args.customer, args.license, feature=args.feature)
            print(result.model_dump_json(), flush=True)
            return 0 if result.valid else 3
        return 0
    except (PermissionError, FileNotFoundError, ValueError) as exc:
        print(str(exc), file=sys.stderr, flush=True)
        return 4


if __name__ == '__main__':
    raise SystemExit(main())
