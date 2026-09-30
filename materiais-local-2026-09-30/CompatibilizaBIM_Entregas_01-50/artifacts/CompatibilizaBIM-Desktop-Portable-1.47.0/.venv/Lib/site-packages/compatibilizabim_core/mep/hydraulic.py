from __future__ import annotations
from dataclasses import dataclass
from cbim_sdk import CBIMProject
from cbim_sdk.models import Equipment,Fitting,Pipe,Point3D,SourceRef,System
from ..cad.model import CadDocument,CadInsert,CadLine,CadPolyline
from .common import diameter_m_with_source,fitting_type_from_label
from .evidence import MepEvidenceEngine

@dataclass(frozen=True)
class HydraulicConfig:
    default_diameter_mm: float=25.0
    strict_evidence: bool=True

SYSTEM_NAMES={'cold_water':'Água fria','hot_water':'Água quente','sanitary':'Esgoto sanitário','rainwater':'Água pluvial'}

class HydraulicRecognizer:
    def __init__(self,config:HydraulicConfig=HydraulicConfig()):
        self.config=config; self.evidence=MepEvidenceEngine()

    def recognize(self,document:CadDocument,project:CBIMProject)->CBIMProject:
        p=project.model_copy(deep=True); sys_ids={}
        evidence=self.evidence.assess(document,'hydraulic')
        auto_count=sum(1 for ev in evidence.values() if ev.decision=='auto_create')
        candidate_count=sum(1 for ev in evidence.values() if ev.decision=='candidate')
        rejected_count=sum(1 for ev in evidence.values() if ev.decision=='reject')
        candidate_layers={}
        for entity in document.entities:
            ev=evidence.get(entity.id)
            if ev and ev.decision=='candidate': candidate_layers[entity.layer]=candidate_layers.get(entity.layer,0)+1
        p.metadata['hydraulic_evidence_auto_create_count']=auto_count
        p.metadata['hydraulic_evidence_candidate_count']=candidate_count
        p.metadata['hydraulic_evidence_rejected_count']=rejected_count
        p.metadata['hydraulic_text_associated_count']=sum(1 for ev in evidence.values() if ev.associated_text_ids)
        p.metadata['hydraulic_height_hint_count']=sum(1 for ev in evidence.values() if ev.height_m is not None)
        p.metadata['hydraulic_elevation_hint_count']=sum(1 for ev in evidence.values() if ev.elevation_m is not None)
        p.metadata['hydraulic_vertical_hint_count']=sum(1 for ev in evidence.values() if ev.vertical_directive is not None)
        if candidate_layers:
            import json
            p.metadata['hydraulic_evidence_candidate_layers']=json.dumps(dict(sorted(candidate_layers.items(),key=lambda kv:(-kv[1],kv[0]))),ensure_ascii=False)
        for entity in document.entities:
            ev=evidence.get(entity.id)
            if not ev or (self.config.strict_evidence and not ev.create): continue
            semantic=ev.semantic; code=semantic.system; name=SYSTEM_NAMES.get(code,code)
            if code not in sys_ids:
                system=System(name=name,discipline='plumbing',classification=code); p.systems.append(system); sys_ids[code]=system.id
            sid=sys_ids[code]
            src=[SourceRef(source_id=document.source_id,entity_id=entity.id,layer=entity.layer,metadata={'semantic_evidence':semantic.evidence,'evidence_score':round(ev.score,4),'evidence_decision':ev.decision,'strong_evidence_count':ev.strong_evidence_count})]
            if ev.diameter_mm is not None:
                diameter=ev.diameter_mm/1000.0; diameter_source=ev.diameter_source or 'corroborating_evidence'
            else:
                diameter,diameter_source=diameter_m_with_source(entity,self.config.default_diameter_mm)
            common={'service':code,'semantic_evidence':semantic.evidence,'diameter_source':diameter_source,'evidence_score':round(ev.score,4),'evidence_reasons':','.join(ev.reasons),'evidence_decision':ev.decision,'strong_evidence_count':ev.strong_evidence_count}
            if ev.material: common['material_hint']=ev.material
            if ev.nearby_text: common['nearby_text_evidence']=ev.nearby_text[:240]
            if ev.associated_text_ids: common['associated_text_ids']=','.join(ev.associated_text_ids)
            if ev.height_m is not None:
                common['height_hint_m']=round(ev.height_m,6)
                common['z_reconstruction_pending']=True
            if ev.elevation_m is not None:
                common['elevation_hint_m']=round(ev.elevation_m,6)
                common['z_reconstruction_pending']=True
            if ev.vertical_directive is not None:
                common['vertical_direction']=ev.vertical_directive
                if ev.vertical_anchor_x is not None and ev.vertical_anchor_y is not None:
                    common['vertical_anchor_x']=round(ev.vertical_anchor_x,6)
                    common['vertical_anchor_y']=round(ev.vertical_anchor_y,6)
                common['z_reconstruction_pending']=True
            if ev.network_seeded: common['network_seeded']=True
            if ev.connected_component_count: common['connected_mep_components']=ev.connected_component_count
            if diameter_source=='recognizer_default': common.update({'requires_review':True,'review_reason':'diameter_default'})
            if ev.score < .86: common.setdefault('requires_review',True); common.setdefault('review_reason','evidence_below_auto_confirm')
            if semantic.target=='pipe' and isinstance(entity,CadLine):
                p.elements.append(Pipe(path=[Point3D(x=entity.start.x,y=entity.start.y,z=entity.start.z),Point3D(x=entity.end.x,y=entity.end.y,z=entity.end.z)],diameter=diameter,system_id=sid,confidence=max(.70,min(.995,ev.score)),source_refs=src,properties=common))
            elif semantic.target=='pipe' and isinstance(entity,CadPolyline):
                p.elements.append(Pipe(path=[Point3D(x=q.x,y=q.y,z=q.z) for q in entity.points],diameter=diameter,system_id=sid,confidence=max(.70,min(.995,ev.score)),source_refs=src,properties=common))
            elif semantic.target=='fitting' and isinstance(entity,CadInsert):
                label=f'{entity.layer} {entity.block_name}'; pos=Point3D(x=entity.position.x,y=entity.position.y,z=entity.position.z)
                ft,angle=fitting_type_from_label(label); props=dict(common)
                if angle is not None: props['angle_deg']=angle
                if ft=='other': props.update({'requires_review':True,'review_reason':'fitting_type_unknown'})
                p.elements.append(Fitting(position=pos,fitting_type=ft,nominal_diameter=diameter,system_id=sid,confidence=max(.70,min(.995,ev.score)),source_refs=src,properties=props))
            elif semantic.target=='equipment' and isinstance(entity,CadInsert):
                pos=Point3D(x=entity.position.x,y=entity.position.y,z=entity.position.z)
                p.elements.append(Equipment(position=pos,equipment_type=entity.block_name,system_id=sid,rotation_deg=entity.rotation_deg,confidence=max(.70,min(.995,ev.score)),source_refs=src,properties=common))
        return p
