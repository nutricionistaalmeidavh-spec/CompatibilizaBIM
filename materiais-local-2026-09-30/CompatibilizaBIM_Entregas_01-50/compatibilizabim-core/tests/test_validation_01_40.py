from pathlib import Path
from cbim_sdk import CBIMProject
from cbim_sdk.models import Point3D,Wall,Pipe,System,SourceRef
from compatibilizabim_core.cad.model import CadDocument,CadLine,CadPoint,CadPolyline,CadInsert,CadBlock
from compatibilizabim_core.dwg.models import DWGImportDiagnostics,DWGImportResult
from compatibilizabim_core.validation import ValidationCase,ValidationThresholds,ProjectValidationEngine,FederationEngine,RealDWGValidationRunner


def diag(path,total=10):
    return DWGImportDiagnostics(provider='acadsharp',source_path=str(path),version='AC1032',total_entities=total,converted_entities=total,unsupported_entities=0,by_canonical_kind={'line':total})

def test_architecture_validation_metrics_pass():
    p=CBIMProject(name='A',elements=[Wall(start=Point3D(x=0,y=0),end=Point3D(x=5,y=0),thickness=.14,height=2.8,confidence=.95,source_refs=[SourceRef(source_id='dwg:a',entity_id=f'e{i}') for i in range(6)])])
    case=ValidationCase(name='arch',discipline='architecture',source_path='a.dwg',thresholds=ValidationThresholds(min_recognition_rate=.5,require_ifc_export=False))
    r=ProjectValidationEngine().validate(case,diag('a.dwg'),p,canonical_entity_count=10)
    assert r.passed and r.recognition_rate==.6 and r.relevant_element_counts['wall']==1

def test_federation_finds_cross_discipline_candidate():
    a=CBIMProject(name='A',elements=[Wall(start=Point3D(x=0,y=0),end=Point3D(x=5,y=0),thickness=.2,height=3)])
    s=System(name='AF',discipline='plumbing')
    h=CBIMProject(name='H',systems=[s],elements=[Pipe(path=[Point3D(x=2,y=-1,z=1),Point3D(x=2,y=1,z=1)],diameter=.05,system_id=s.id)])
    f=FederationEngine().federate({'architecture':a,'hydraulic':h})
    assert f.passed and f.total_elements==2 and len(f.cross_discipline_candidates)>=1

def make_doc(discipline):
    ents=[];blocks={}
    if discipline=='architecture':
        # Four wall pairs around a 5x4 room plus a door insert.
        coords=[((0,0),(5,0)),((0,.14),(5,.14)),((0,0),(0,4)),((.14,0),(.14,4)),((0,4),(5,4)),((0,3.86),(5,3.86)),((5,0),(5,4)),((4.86,0),(4.86,4))]
        for i,(a,b) in enumerate(coords):ents.append(CadLine(id=f'a{i}',layer='A-WALL',start=CadPoint(x=a[0],y=a[1]),end=CadPoint(x=b[0],y=b[1])))
        blocks={'PORTA80':CadBlock(name='PORTA80',entities=[CadLine(id='bd',layer='0',start=CadPoint(x=0,y=0),end=CadPoint(x=.8,y=0))])}
        ents.append(CadInsert(id='door',layer='A-DOOR',block_name='PORTA80',position=CadPoint(x=2,y=.07)))
    elif discipline=='structure':
        ents += [CadLine(id='b1',layer='S-BEAM',start=CadPoint(x=0,y=1),end=CadPoint(x=5,y=1)),CadLine(id='b2',layer='S-BEAM',start=CadPoint(x=0,y=1.25),end=CadPoint(x=5,y=1.25)),CadPolyline(id='slab',layer='S-SLAB',closed=True,points=[CadPoint(x=0,y=0),CadPoint(x=5,y=0),CadPoint(x=5,y=4),CadPoint(x=0,y=4)])]
    elif discipline=='hydraulic':
        ents += [CadLine(id='h1',layer='AGUA_FRIA_DN25',start=CadPoint(x=2,y=-1,z=1),end=CadPoint(x=2,y=2,z=1)),CadLine(id='h2',layer='AGUA_FRIA_DN25',start=CadPoint(x=2,y=2,z=1),end=CadPoint(x=4,y=2,z=1))]
    elif discipline=='fire':
        ents += [CadLine(id='f1',layer='FIRE_SPRINK_DN50',start=CadPoint(x=3,y=-1,z=2),end=CadPoint(x=3,y=2,z=2)),CadLine(id='f2',layer='FIRE_SPRINK_DN50',start=CadPoint(x=3,y=2,z=2),end=CadPoint(x=5,y=2,z=2))]
    return CadDocument(source_id=f'dwg:{discipline}',source_format='dwg',units='m',entities=ents,blocks=blocks,layers=sorted({e.layer for e in ents}),metadata={'native_dwg':True})

class FakeNativeImporter:
    name='acadsharp'
    def available(self):return True
    def read_result(self,path):
        d=Path(path).stem.split('-')[0]
        doc=make_doc(d)
        counts={}
        for e in doc.entities:counts[e.kind]=counts.get(e.kind,0)+1
        return DWGImportResult(document=doc,diagnostics=DWGImportDiagnostics(provider='acadsharp',source_path=str(path),version='AC1032',total_entities=len(doc.entities),converted_entities=len(doc.entities),by_canonical_kind=counts))

def test_batch_validates_four_disciplines_and_federates(tmp_path):
    cases=[]
    for d in ['architecture','structure','hydraulic','fire']:
        f=tmp_path/f'{d}-sample.dwg';f.write_bytes(b'AC1032fixture')
        cases.append(ValidationCase(name=d,discipline=d,source_path=str(f),evidence_kind='fixture',thresholds=ValidationThresholds(min_recognition_rate=0,require_ifc_export=True)))
    batch=RealDWGValidationRunner(FakeNativeImporter(),output_dir=tmp_path/'out').run_batch(cases)
    assert len(batch.reports)==4
    assert batch.federation and batch.federation.total_elements>0
    assert not batch.production_evidence_eligible
    assert 'real_project_sources_not_provided_for_all_cases' in batch.blockers
    assert all(r.ifc_exported and r.ifc_sanity_passed for r in batch.reports)
