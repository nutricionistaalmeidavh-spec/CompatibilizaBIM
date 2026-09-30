from cbim_sdk.models import Wall
from compatibilizabim_core.advanced_geometry import AdvancedGeometryConfig,AdvancedGeometryEngine
from compatibilizabim_core.architecture import ArchitectureRecognizer
from compatibilizabim_core.cad.model import CadArc,CadDocument,CadLine,CadPoint,CadPolyline
from compatibilizabim_core.geometry import GeometryEngine
from compatibilizabim_core.topology import TopologyEngine


def test_adaptive_tessellation_preserves_curve_provenance_and_error_bound():
    doc=CadDocument(source_id='curve',entities=[
        CadArc(id='A1',layer='WALL',center=CadPoint(x=0,y=0),radius=5,start_angle_deg=0,end_angle_deg=90),
        CadArc(id='A2',layer='WALL',center=CadPoint(x=0,y=0),radius=5.14,start_angle_deg=0,end_angle_deg=90),
    ])
    engine=AdvancedGeometryEngine(AdvancedGeometryConfig(chord_tolerance_m=.01))
    tess=engine.tessellate(doc);summary=engine.analyze(doc)
    assert summary.arc_count==2 and summary.tessellated_segment_count==len(tess.entities)
    assert summary.max_chord_error_m<=.0100001
    assert all(e.metadata['source_entity_id'] in {'A1','A2'} for e in tess.entities)
    cad=GeometryEngine().process(tess);topo=TopologyEngine().build(cad);project=ArchitectureRecognizer().recognize(cad,topo)
    walls=[e for e in project.elements if isinstance(e,Wall)]
    assert len(walls)>=4
    assert {r.entity_id for w in walls for r in w.source_refs}<={'A1','A2'}


def test_analysis_flags_inclined_nonorthogonal_and_invalid_polygon():
    doc=CadDocument(source_id='a',entities=[
      CadLine(id='I',start=CadPoint(x=0,y=0,z=0),end=CadPoint(x=2,y=1,z=2)),
      CadPolyline(id='BOW',closed=True,points=[CadPoint(x=0,y=0),CadPoint(x=2,y=2),CadPoint(x=0,y=2),CadPoint(x=2,y=0)])])
    s=AdvancedGeometryEngine().analyze(doc)
    assert s.inclined_count==1 and s.non_orthogonal_count==1 and s.self_intersecting_polylines==['BOW']
