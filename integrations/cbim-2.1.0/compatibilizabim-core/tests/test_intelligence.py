from cbim_sdk import CBIMProject
from cbim_sdk.models import Pipe,Point3D,Relation,System
from compatibilizabim_core.intelligence import RecognitionIntelligence

def test_intelligence_calibrates_auditable_mep_confidence():
    s=System(name='AF',discipline='plumbing',classification='cold_water')
    a=Pipe(path=[Point3D(x=0,y=0),Point3D(x=1,y=0)],diameter=.025,system_id=s.id,confidence=.70)
    b=Pipe(path=[Point3D(x=1,y=0),Point3D(x=2,y=0)],diameter=.025,system_id=s.id,confidence=.70)
    p=CBIMProject(name='x',systems=[s],elements=[a,b],relations=[Relation(type='connects',from_id=a.id,to_id=b.id)])
    decisions=RecognitionIntelligence().evaluate(p); assert all(d.calibrated_confidence>.70 for d in decisions); assert all(any(e.name=='mep_system' for e in d.evidence) for d in decisions)
    out=RecognitionIntelligence().apply(p); assert out.metadata['recognition_intelligence']=='deterministic_evidence_v2'
