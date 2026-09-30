from compatibilizabim_core import *
def p(x,y):return CadPoint(x=x,y=y)
def l(i,a,b,layer='WALL'):return CadLine(id=i,layer=layer,start=p(*a),end=p(*b))
def plan():
    block=CadBlock(name='PORTA_90',entities=[l('leaf',(0,0),(.9,0),'0')])
    return CadDocument(source_id='plan',entities=[l('w1',(0,0),(5,0)),l('w2',(0,.14),(5,.14)),l('w3',(0,4),(5,4)),l('w4',(0,3.86),(5,3.86)),l('w5',(0,.14),(0,3.86)),l('w6',(.14,.14),(.14,3.86)),l('w7',(5,.14),(5,3.86)),l('w8',(4.86,.14),(4.86,3.86)),CadPolyline(id='c1',layer='PILAR',points=[p(1,1),p(1.2,1),p(1.2,1.4),p(1,1.4)],closed=True),CadInsert(id='d1',layer='PORTA',block_name='PORTA_90',position=p(2.5,.07)),CadText(id='t1',layer='TEXT',text='SALA',position=p(2.5,2))],blocks={'PORTA_90':block})
def test_architecture_recognizes_wall_column_door_space_and_host():
    doc=GeometryEngine().process(plan(),expand_inserts=False);topo=TopologyEngine().build(doc);pr=ArchitectureRecognizer().recognize(doc,topo);c=pr.element_counts()
    assert c['wall']>=4 and c['column']==1 and c['door']==1 and c['space']>=1
    assert next(e for e in pr.elements if e.type=='door').host_id is not None
    assert any(e.type=='space' and e.name=='SALA' for e in pr.elements)
