from compatibilizabim_core import *
from cbim_sdk.models import CBIMProject,Wall,Point3D
def test_review_session_edit_confirm_undo_redo_and_html():
    w=Wall(start=Point3D(x=0,y=0),end=Point3D(x=2,y=0),thickness=.14,height=2.8,confidence=.7);s=ReviewSession(CBIMProject(name='x',elements=[w]));s.set_state(w.id,'confirmed');assert s.project.elements[0].review_state=='confirmed';assert s.undo();assert s.project.elements[0].review_state=='auto';assert s.redo();assert s.project.elements[0].review_state=='confirmed';s.edit(w.id,name='Parede A');assert s.project.elements[0].name=='Parede A';h=build_reviewer_html(s);assert 'CAD/BIM Reviewer' in h and 'Exportar CBIM' in h and w.id in h
def test_pipeline_is_end_to_end_for_simple_wall():
    p=lambda x,y:CadPoint(x=x,y=y);doc=CadDocument(source_id='x',entities=[CadLine(id='a',layer='WALL',start=p(0,0),end=p(3,0)),CadLine(id='b',layer='WALL',start=p(0,.14),end=p(3,.14))]);cad,topo,pr=CADToCBIMPipeline().run(doc);assert cad.metadata['geometry_normalized'] and pr.storeys and pr.element_counts()['wall']==1 and pr.elements[0].storey_id
