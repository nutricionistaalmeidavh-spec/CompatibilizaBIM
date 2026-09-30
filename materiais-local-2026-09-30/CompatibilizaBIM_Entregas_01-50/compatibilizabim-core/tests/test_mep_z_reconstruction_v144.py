from cbim_sdk import CBIMProject
from cbim_sdk.models import Building, Pipe, Fitting, Point3D, Storey, System

from compatibilizabim_core.mep.z_reconstruction import MEPZReconstructor, ZReconstructionConfig


def pt(x, y, z=0.0):
    return Point3D(x=x, y=y, z=z)


def base_project(elements, *, storeys=None):
    system = System(id='sys', name='Água fria', discipline='plumbing', classification='cold_water')
    if storeys is None:
        building = Building(id='b', name='B')
        storeys = [Storey(id='s1', name='Térreo', building_id='b', elevation=0.0, height=3.0)]
        buildings = [building]
    else:
        building_ids = {s.building_id for s in storeys if s.building_id}
        buildings = [Building(id=bid, name=bid) for bid in building_ids]
    return CBIMProject(name='P', buildings=buildings, storeys=storeys, systems=[system], elements=elements)


def pipe(pid, a, b, *, props=None, storey='s1'):
    return Pipe(id=pid, storey_id=storey, path=[a, b], diameter=.025, system_id='sys', properties=props or {})


def test_height_hint_is_applied_relative_to_storey_elevation():
    storeys=[Storey(id='s1',name='Pav 2',building_id='b',elevation=3.0,height=3.0)]
    p=pipe('p1',pt(0,0),pt(2,0),props={'height_hint_m':0.50,'z_reconstruction_pending':True})
    out, report = MEPZReconstructor().reconstruct(base_project([p],storeys=storeys))
    result=next(e for e in out.elements if e.id=='p1')
    assert [q.z for q in result.path] == [3.5,3.5]
    assert result.properties['z_reconstruction_source']=='height_hint'
    assert result.properties['z_reconstruction_pending'] is False
    assert report.direct_resolved == 1


def test_large_absolute_elevation_requires_project_datum():
    p=pipe('p1',pt(0,0),pt(2,0),props={'elevation_hint_m':595.52,'z_reconstruction_pending':True})
    out, report = MEPZReconstructor().reconstruct(base_project([p]))
    result=next(e for e in out.elements if e.id=='p1')
    assert [q.z for q in result.path] == [0.0,0.0]
    assert result.properties['z_reconstruction_pending'] is True
    assert result.properties['z_unresolved_reason']=='project_datum_required'
    assert report.unresolved == 1


def test_large_absolute_elevation_uses_explicit_project_datum():
    p=pipe('p1',pt(0,0),pt(2,0),props={'elevation_hint_m':595.52,'z_reconstruction_pending':True})
    cfg=ZReconstructionConfig(project_datum_elevation_m=595.0)
    out, report = MEPZReconstructor(cfg).reconstruct(base_project([p]))
    result=next(e for e in out.elements if e.id=='p1')
    assert all(abs(q.z-0.52)<1e-9 for q in result.path)
    assert result.properties['z_reconstruction_source']=='elevation_hint_datum'
    assert report.direct_resolved == 1


def test_single_anchor_propagates_z_through_connected_same_system_component():
    p1=pipe('p1',pt(0,0),pt(2,0),props={'height_hint_m':0.80,'z_reconstruction_pending':True})
    p2=pipe('p2',pt(2,0),pt(4,0))
    p3=pipe('p3',pt(4,0),pt(6,0))
    out, report=MEPZReconstructor().reconstruct(base_project([p1,p2,p3]))
    by={e.id:e for e in out.elements}
    assert [q.z for q in by['p1'].path]==[0.8,0.8]
    assert [q.z for q in by['p2'].path]==[0.8,0.8]
    assert [q.z for q in by['p3'].path]==[0.8,0.8]
    assert by['p2'].properties['z_reconstruction_source']=='network_propagation'
    assert by['p3'].properties['z_reconstruction_source']=='network_propagation'
    assert report.propagated == 2


def test_conflicting_component_anchors_do_not_overpropagate_middle_pipe():
    p1=pipe('p1',pt(0,0),pt(2,0),props={'height_hint_m':0.50,'z_reconstruction_pending':True})
    p2=pipe('p2',pt(2,0),pt(4,0))
    p3=pipe('p3',pt(4,0),pt(6,0),props={'height_hint_m':1.00,'z_reconstruction_pending':True})
    out, report=MEPZReconstructor().reconstruct(base_project([p1,p2,p3]))
    by={e.id:e for e in out.elements}
    assert [q.z for q in by['p1'].path]==[0.5,0.5]
    assert [q.z for q in by['p3'].path]==[1.0,1.0]
    assert [q.z for q in by['p2'].path]==[0.0,0.0]
    assert by['p2'].properties['z_reconstruction_pending'] is True
    assert by['p2'].properties['z_unresolved_reason']=='conflicting_network_anchors'
    assert report.conflicting >= 1


def test_up_directive_to_next_storey_inserts_vertical_leg_at_text_anchor_endpoint():
    storeys=[
        Storey(id='s1',name='Térreo',building_id='b',elevation=0.0,height=3.0),
        Storey(id='s2',name='Pav 1',building_id='b',elevation=3.0,height=3.0),
    ]
    p=pipe('p1',pt(0,0),pt(2,0),props={
        'vertical_direction':'up',
        'vertical_anchor_x':1.95,
        'vertical_anchor_y':0.02,
        'z_reconstruction_pending':True,
    })
    out, report=MEPZReconstructor().reconstruct(base_project([p],storeys=storeys))
    result=next(e for e in out.elements if e.id=='p1')
    assert len(result.path)==3
    assert result.path[0] == pt(0,0,0)
    assert result.path[1] == pt(2,0,0)
    assert result.path[2] == pt(2,0,3)
    assert result.properties['z_reconstruction_source']=='vertical_to_adjacent_storey'
    assert result.properties['z_reconstruction_pending'] is False
    assert report.vertical_resolved == 1


def test_fitting_in_single_anchor_component_inherits_network_z():
    p1=pipe('p1',pt(0,0),pt(2,0),props={'height_hint_m':0.70,'z_reconstruction_pending':True})
    fit=Fitting(id='f1',storey_id='s1',position=pt(2,0),fitting_type='elbow',nominal_diameter=.025,system_id='sys')
    out, report=MEPZReconstructor().reconstruct(base_project([p1,fit]))
    f=next(e for e in out.elements if e.id=='f1')
    assert abs(f.position.z-.70)<1e-9
    assert f.properties['z_reconstruction_source']=='network_propagation'
    assert report.propagated == 1


def test_pipeline_applies_z_reconstruction_before_connectivity():
    from compatibilizabim_core.cad.model import CadDocument, CadLine, CadPoint, CadText
    from compatibilizabim_core.pipeline import CADToCBIMPipeline
    events=[]
    doc=CadDocument(source_id='x',entities=[
        CadLine(id='p',layer='H-AF-TB',start=CadPoint(x=0,y=0,z=0),end=CadPoint(x=2,y=0,z=0)),
        CadText(id='t',layer='TEXTO',text='AF DN25 h=500mm',position=CadPoint(x=1,y=.05,z=0)),
    ])
    _,_,out=CADToCBIMPipeline().run(
        doc,include_fire=False,include_catalog=False,include_intelligence=False,
        progress=lambda stage,status,elapsed,detail:events.append((stage,status,detail)),
    )
    result=next(e for e in out.elements if isinstance(e,Pipe))
    assert [q.z for q in result.path]==[.5,.5]
    assert out.metadata['z_reconstruction_direct_resolved_count']>=1
    assert any(stage=='mep_z_reconstruction' and status=='done' for stage,status,_ in events)


def test_validation_report_exposes_z_reconstruction_metrics():
    from compatibilizabim_core.dwg.models import DWGImportDiagnostics
    from compatibilizabim_core.validation.engine import ProjectValidationEngine
    from compatibilizabim_core.validation.models import ValidationCase, ValidationThresholds
    p=pipe('p1',pt(0,0),pt(2,0),props={'height_hint_m':0.50,'z_reconstruction_pending':True})
    project,_=MEPZReconstructor().reconstruct(base_project([p]))
    case=ValidationCase(
        name='z',discipline='hydraulic',source_path='x.dwg',
        thresholds=ValidationThresholds(min_recognition_rate=0,min_mean_confidence=0,require_ifc_export=False,require_network_for_mep=False),
    )
    diag=DWGImportDiagnostics(provider='fixture',source_path='x.dwg',total_entities=1,converted_entities=1)
    report=ProjectValidationEngine().validate(case,diag,project,canonical_entity_count=1)
    assert report.z_direct_resolved_count == 1
    assert report.z_propagated_count == 0
    assert report.z_unresolved_count == 0
    assert report.z_nonzero_element_count == 1


def test_validation_cli_accepts_project_datum_elevation():
    from compatibilizabim_core.validation.cli import parser
    args=parser().parse_args(['--hydraulic','x.dwg','--project-datum-elevation-m','595.0'])
    assert args.project_datum_elevation_m == 595.0


def test_pipeline_uses_sobe_text_anchor_to_create_vertical_leg_to_next_storey():
    from compatibilizabim_core.cad.model import CadDocument, CadLine, CadPoint, CadText
    from compatibilizabim_core.levels.reconstruct import LevelDefinition
    from compatibilizabim_core.pipeline import CADToCBIMPipeline
    doc=CadDocument(source_id='x',entities=[
        CadLine(id='p',layer='H-AF-TB',start=CadPoint(x=0,y=0,z=0),end=CadPoint(x=2,y=0,z=0)),
        CadText(id='t',layer='TEXTO',text='AF DN25 SOBE',position=CadPoint(x=1.95,y=.02,z=0)),
    ])
    _,_,out=CADToCBIMPipeline().run(
        doc,
        levels=[LevelDefinition('Térreo',0,3),LevelDefinition('Pav 1',3,3)],
        include_fire=False,include_catalog=False,include_intelligence=False,
    )
    result=next(e for e in out.elements if isinstance(e,Pipe))
    assert [(q.x,q.y,q.z) for q in result.path]==[(0,0,0),(2,0,0),(2,0,3)]
    assert result.properties['z_reconstruction_source']=='vertical_to_adjacent_storey'
