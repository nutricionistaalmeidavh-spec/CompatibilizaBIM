from __future__ import annotations
import argparse,json
from pathlib import Path
from cbim_sdk import CBIMProject
from .models import ProjectConfiguration,StoreyConfig
from .import_wizard import build_import_plan
from .reporting import build_conversion_report,write_report
from .studio import write_studio

def _project(path):return CBIMProject.model_validate_json(Path(path).read_text(encoding='utf-8'))

def main(argv=None):
    p=argparse.ArgumentParser(prog='cbim-product',description='CompatibilizaBIM product workflow tools (deliveries 41-45)');sub=p.add_subparsers(dest='cmd',required=True)
    plan=sub.add_parser('plan');plan.add_argument('sources',nargs='+');plan.add_argument('-o','--output',required=True);plan.add_argument('--name',default='Novo Projeto')
    studio=sub.add_parser('studio');studio.add_argument('--project',required=True);studio.add_argument('--plan',required=True);studio.add_argument('-o','--output',required=True)
    report=sub.add_parser('report');report.add_argument('--project',required=True);report.add_argument('--plan');report.add_argument('-o','--output',required=True)
    a=p.parse_args(argv)
    if a.cmd=='plan':
        obj=build_import_plan(a.sources,ProjectConfiguration(project_name=a.name));Path(a.output).write_text(obj.model_dump_json(indent=2),encoding='utf-8')
    elif a.cmd=='studio':
        proj=_project(a.project);pl=__import__('compatibilizabim_core.product.models',fromlist=['ImportPlan']).ImportPlan.model_validate_json(Path(a.plan).read_text(encoding='utf-8'));rp=build_conversion_report(proj,import_plan=pl);write_studio(proj,pl,rp,a.output)
    else:
        proj=_project(a.project);pl=None
        if a.plan:pl=__import__('compatibilizabim_core.product.models',fromlist=['ImportPlan']).ImportPlan.model_validate_json(Path(a.plan).read_text(encoding='utf-8'))
        write_report(build_conversion_report(proj,import_plan=pl),a.output)
