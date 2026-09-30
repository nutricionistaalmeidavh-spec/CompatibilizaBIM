from __future__ import annotations
from dataclasses import dataclass
from pydantic import BaseModel,ConfigDict,Field
from cbim_sdk import CBIMProject

class IntelligenceModel(BaseModel): model_config=ConfigDict(extra='forbid')
class Evidence(IntelligenceModel):
    name:str; weight:float; detail:str
class IntelligenceDecision(IntelligenceModel):
    element_id:str; original_confidence:float; calibrated_confidence:float; evidence:list[Evidence]=Field(default_factory=list); action:str='keep'

@dataclass(frozen=True)
class IntelligenceConfig:
    profile_weight:float=.08; multi_source_weight:float=.05; hosted_weight:float=.04; mep_system_weight:float=.08; connectivity_weight:float=.06; catalog_weight:float=.04; low_confidence_floor:float=.35

class RecognitionIntelligence:
    """Evidence-based confidence calibration.

    This stage is deterministic by design. It creates an auditable seam for a future
    statistical/ML classifier without replacing geometric recognizers with opaque guesses.
    """
    def __init__(self,config:IntelligenceConfig=IntelligenceConfig()):self.config=config
    def evaluate(self,project:CBIMProject)->list[IntelligenceDecision]:
        relations=project.relations; connected={r.from_id for r in relations if r.type=='connects'}|{r.to_id for r in relations if r.type=='connects'}
        decisions=[]
        for e in project.elements:
            score=float(e.confidence);ev=[]
            if any(ref.metadata.get('profile_rule') for ref in e.source_refs):
                score+=self.config.profile_weight;ev.append(Evidence(name='cad_profile',weight=self.config.profile_weight,detail='source matched a saved CAD profile'))
            if len(e.source_refs)>=2:
                score+=self.config.multi_source_weight;ev.append(Evidence(name='multi_source_geometry',weight=self.config.multi_source_weight,detail='element supported by multiple source entities'))
            if getattr(e,'host_id',None):
                score+=self.config.hosted_weight;ev.append(Evidence(name='host_relation',weight=self.config.hosted_weight,detail='element has a valid host'))
            if getattr(e,'system_id',None):
                score+=self.config.mep_system_weight;ev.append(Evidence(name='mep_system',weight=self.config.mep_system_weight,detail='MEP element classified into a system'))
            if e.id in connected:
                score+=self.config.connectivity_weight;ev.append(Evidence(name='network_connectivity',weight=self.config.connectivity_weight,detail='MEP element participates in a connectivity relation'))
            catalog_score=float(e.properties.get('catalog_advisory_top_score',0) or 0)
            if catalog_score>=.70:
                score+=self.config.catalog_weight;ev.append(Evidence(name='catalog_correspondence',weight=self.config.catalog_weight,detail=f'neutral catalog correspondence score {catalog_score:.2f}'))
            calibrated=max(self.config.low_confidence_floor,min(score,.995))
            requires_review=bool(e.properties.get('requires_review'))
            action='auto_confirm_candidate' if calibrated>=.97 and len(ev)>=2 and not requires_review else 'review' if calibrated<.70 or requires_review else 'keep'
            decisions.append(IntelligenceDecision(element_id=e.id,original_confidence=e.confidence,calibrated_confidence=round(calibrated,4),evidence=ev,action=action))
        return decisions
    def apply(self,project:CBIMProject)->CBIMProject:
        p=project.model_copy(deep=True); decisions={d.element_id:d for d in self.evaluate(p)}
        for e in p.elements:
            d=decisions[e.id];e.confidence=d.calibrated_confidence;e.properties['intelligence_action']=d.action;e.properties['intelligence_evidence_count']=len(d.evidence)
            if d.action=='auto_confirm_candidate': e.review_state='confirmed'
        p.metadata['recognition_intelligence']='deterministic_evidence_v2'
        return CBIMProject.model_validate(p.model_dump(exclude_computed_fields=True))
