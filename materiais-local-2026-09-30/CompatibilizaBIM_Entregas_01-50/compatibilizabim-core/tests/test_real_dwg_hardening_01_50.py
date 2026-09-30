from time import perf_counter

from cbim_sdk import CBIMProject
from cbim_sdk.models import Fitting, Pipe

from compatibilizabim_core.cad.model import CadDocument,CadInsert,CadLine,CadPoint,CadText
from compatibilizabim_core.geometry.normalize import GeometryNormalizer
from compatibilizabim_core.pipeline import CADToCBIMPipeline
from compatibilizabim_core.validation import ProjectValidationEngine,ValidationCase,ValidationThresholds
from compatibilizabim_core.dwg.models import DWGImportDiagnostics


def real_style_doc():
    ents=[
        CadLine(id='af1',layer='H-AF-TB',start=CadPoint(x=0,y=0,z=1),end=CadPoint(x=1,y=0,z=1)),
        CadLine(id='af2',layer='H-AF-TB',start=CadPoint(x=2,y=0,z=1),end=CadPoint(x=3,y=0,z=1)),
        CadInsert(id='cx1',layer='H-AF-CX',block_name='H-U-AF-TB_COR0900_20',position=CadPoint(x=1,y=0,z=1),xscale=20,yscale=20,zscale=20),
        CadText(id='txt',layer='TEXTO',text='AF',position=CadPoint(x=0,y=2)),
        CadInsert(id='arrow',layer='SETAS',block_name='W3e4r5tyh',position=CadPoint(x=0,y=3)),
        CadLine(id='fire1',layer='H-INC-TB',start=CadPoint(x=0,y=4,z=2),end=CadPoint(x=1,y=4,z=2)),
        CadLine(id='spk',layer='REDE SPK',start=CadPoint(x=0,y=5,z=2),end=CadPoint(x=1,y=5,z=2)),
        CadInsert(id='unknown',layer='H-TC-CX',block_name='COMPONENTE_DESCONHECIDO',position=CadPoint(x=0,y=6)),
    ]
    return CadDocument(source_id='dwg:BARRILETE.dwg',source_format='dwg',entities=ents,layers=sorted({e.layer for e in ents}))


def test_observed_real_project_layers_separate_pipe_fitting_fire_and_annotations():
    cad,_,project=CADToCBIMPipeline().run(real_style_doc(),include_hydraulic=True,include_fire=False,preferred_manufacturer=None)
    hyd=[e for e in project.elements if e.type in {'pipe','fitting'}]
    pipes=[e for e in hyd if isinstance(e,Pipe)]
    fittings=[e for e in hyd if isinstance(e,Fitting)]
    assert len(pipes)==2
    assert len(fittings)==1
    fitting=fittings[0]
    assert fitting.fitting_type=='elbow'
    assert round((fitting.nominal_diameter or 0)*1000)==20
    assert fitting.properties['angle_deg']==90.0
    assert fitting.review_state=='confirmed'
    assert not any('catalog_manufacturer' in e.properties for e in hyd)
    assert not any(e.properties.get('service')=='fire' for e in project.elements)


def test_real_project_validation_uses_only_eligible_hydraulic_entities_as_denominator():
    cad,_,project=CADToCBIMPipeline().run(real_style_doc(),include_hydraulic=True,include_fire=False,preferred_manufacturer=None)
    diag=DWGImportDiagnostics(provider='acadsharp',source_path='BARRILETE.dwg',version='AC1032',total_entities=100,converted_entities=96,unsupported_entities=4)
    case=ValidationCase(name='hyd',discipline='hydraulic',source_path='BARRILETE.dwg',evidence_kind='real_project',thresholds=ValidationThresholds(min_recognition_rate=.9,require_ifc_export=False,require_network_for_mep=False))
    report=ProjectValidationEngine().validate(case,diag,project,canonical_entity_count=len(cad.entities),canonical_document=cad)
    assert report.eligible_source_entities==3
    assert report.recognized_source_entities==3
    assert report.recognition_rate==1.0
    assert report.ignored_source_entities==len(cad.entities)-3
    assert report.unclassified_eligible_count==0
    assert report.unmapped_by_layer.get('H-TC-CX')==1


def test_default_diameter_remains_pending_but_block_evidence_can_auto_confirm():
    _,_,project=CADToCBIMPipeline().run(real_style_doc(),include_hydraulic=True,include_fire=False)
    pipes=[e for e in project.elements if isinstance(e,Pipe)]
    fitting=next(e for e in project.elements if isinstance(e,Fitting))
    assert all(p.properties['diameter_source']=='recognizer_default' and p.review_state=='auto' for p in pipes)
    assert fitting.properties['diameter_source']=='block_suffix'
    assert fitting.review_state=='confirmed'


def test_fast_collinear_merge_scales_to_thousands_of_segments():
    lines=[CadLine(id=f'l{i:05}',layer='H-AF-TB',start=CadPoint(x=i*.01,y=0),end=CadPoint(x=(i+1)*.01,y=0)) for i in range(5000)]
    doc=CadDocument(source_id='perf',entities=lines)
    t=perf_counter(); out=GeometryNormalizer().normalize(doc); elapsed=perf_counter()-t
    assert len(out.entities)==1
    assert elapsed < 3.0


def test_pipeline_emits_stage_progress_and_timings():
    events=[]
    def progress(stage,status,elapsed,detail): events.append((stage,status,elapsed,detail))
    CADToCBIMPipeline().run(real_style_doc(),include_hydraulic=True,include_fire=False,progress=progress)
    done={stage for stage,status,_,_ in events if status=='done'}
    assert {'geometry','topology','hydraulic_recognition','connectivity','intelligence'} <= done
    assert all(elapsed is None or elapsed>=0 for _,_,elapsed,_ in events)
