from pathlib import Path
from cbim_sdk import CBIMProject
from compatibilizabim_core.product import ProjectConfiguration,build_import_plan,build_conversion_report,write_studio,write_report

def test_existing_demo_can_generate_product_artifacts(tmp_path):
    root=Path(__file__).resolve().parents[2]
    demo=root/'artifacts'/'cad-to-cbim-demo.cbim.json'
    assert demo.exists()
    project=CBIMProject.model_validate_json(demo.read_text(encoding='utf-8'))
    plan=build_import_plan(['ARQ_TORRE.dwg'],ProjectConfiguration(project_name=project.name))
    report=build_conversion_report(project,import_plan=plan)
    studio=write_studio(project,plan,report,tmp_path/'studio.html')
    rep=write_report(report,tmp_path/'report.html')
    assert studio.stat().st_size>10000 and rep.stat().st_size>1000
