from cbim_sdk import CBIMProject
from cbim_sdk.models import Pipe, Point3D, SourceRef, System
from compatibilizabim_core.cad.model import CadDocument, CadLine, CadText, CadPoint
from compatibilizabim_core.dwg.models import DWGImportDiagnostics
from compatibilizabim_core.validation.engine import ProjectValidationEngine
from compatibilizabim_core.validation.models import ValidationCase, ValidationThresholds


def test_validation_separates_context_from_unknown_and_reports_catalog_advisory():
    doc=CadDocument(source_id='dwg:x',entities=[
        CadLine(id='wall',layer='ALVENARIA',start=CadPoint(x=0,y=0),end=CadPoint(x=1,y=0)),
        CadLine(id='proj',layer='PROJEÇÃO',start=CadPoint(x=0,y=1),end=CadPoint(x=1,y=1)),
        CadText(id='txt',layer='TEXTO',text='x',position=CadPoint(x=0,y=2)),
        CadLine(id='mystery',layer='ZZZ',start=CadPoint(x=0,y=3),end=CadPoint(x=1,y=3)),
        CadLine(id='pipe',layer='H-AF-TB',start=CadPoint(x=0,y=4),end=CadPoint(x=1,y=4),metadata={'default_diameter_mm':25}),
    ])
    sys=System(name='AF',discipline='plumbing',classification='cold_water')
    pipe=Pipe(path=[Point3D(x=0,y=4),Point3D(x=1,y=4)],diameter=.025,system_id=sys.id,source_refs=[SourceRef(source_id='dwg:x',entity_id='pipe',layer='H-AF-TB')],properties={'service':'cold_water','catalog_candidate_count':3,'catalog_candidates':'A|x|1|0.8'})
    project=CBIMProject(name='P',systems=[sys],elements=[pipe])
    diag=DWGImportDiagnostics(provider='acadsharp',source_path='x.dwg',total_entities=5,converted_entities=5,unsupported_entities=0)
    case=ValidationCase(name='x',discipline='hydraulic',source_path='x.dwg',thresholds=ValidationThresholds(min_recognition_rate=0,require_ifc_export=False,require_network_for_mep=False))
    report=ProjectValidationEngine().validate(case,diag,project,canonical_entity_count=5,canonical_document=doc)
    assert report.layer_role_counts['architecture']==1
    assert report.layer_role_counts['context']==1
    assert report.layer_role_counts['annotation']==1
    assert report.layer_role_counts['unknown']==1
    assert report.unknown_nonannotation_count==1
    assert report.catalog_advisory_count==1
    assert all('4 non-annotation' not in w for w in report.warnings)
