from compatibilizabim_core import *
from cbim_sdk.models import CBIMProject,Wall,Point3D
def p(x,y):return CadPoint(x=x,y=y)
def l(i,a,b,layer):return CadLine(id=i,layer=layer,start=p(*a),end=p(*b))
def test_levels_assign_storeys_and_z():
    pr=CBIMProject(name='x',elements=[Wall(start=Point3D(x=0,y=0),end=Point3D(x=1,y=0),thickness=.14,height=2.8)])
    out=Levels3DReconstructor().apply(pr,[LevelDefinition('T',0,2.8),LevelDefinition('P1',3,3)])
    assert len(out.storeys)==2 and out.elements[0].storey_id==out.storeys[0].id and out.elements[0].height==2.8
def test_structure_recognizes_beam_slab_foundation_opening():
    doc=CadDocument(source_id='s',entities=[l('b1',(0,0),(4,0),'VIGA'),l('b2',(0,.2),(4,.2),'VIGA'),CadPolyline(id='s1',layer='LAJE',points=[p(0,0),p(4,0),p(4,3),p(0,3)],closed=True),CadPolyline(id='f1',layer='SAPATA',points=[p(5,0),p(6,0),p(6,1),p(5,1)],closed=True),CadCircle(id='o1',layer='ABERTURA',center=p(2,2),radius=.2)])
    pr=StructuralRecognizer().enrich(CBIMProject(name='x'),doc);c=pr.element_counts();assert c['beam']==1 and c['slab']==2 and c['opening']==1
    assert any(e.type=='slab' and e.properties.get('structural_role')=='foundation' for e in pr.elements)
