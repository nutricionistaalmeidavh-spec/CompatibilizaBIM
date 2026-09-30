from __future__ import annotations

import math
import re
import unicodedata
from collections import defaultdict, deque
from dataclasses import dataclass
from typing import Literal

from ..cad.model import CadDocument, CadEntity, CadInsert, CadLine, CadPoint, CadPolyline
from .common import fitting_type_from_label
from .external_predictions import external_semantic_hint
from .semantics import EQUIPMENT_TOKENS, MepDiscipline, MepSemantic, classify_layer_role, classify_mep_entity
from .text_intelligence import TextEvidenceIndex

_DIAM = re.compile(r'(?:DN|DIA(?:M)?|Ø)\s*[-_ ]?\s*(\d{2,4})(?:\s*MM)?', re.IGNORECASE)
_MATERIALS = ('CPVC','PPR','PEX','PVC','COBRE','AÇO','ACO','PEAD','PBA')
EvidenceDecision = Literal['auto_create','candidate','reject']


def _plain(value: str) -> str:
    normalized = unicodedata.normalize('NFKD', value or '')
    return ''.join(ch for ch in normalized if not unicodedata.combining(ch)).upper().strip()


def _entity_points(entity: CadEntity) -> list[CadPoint]:
    if isinstance(entity, CadLine):
        return [entity.start, entity.end]
    if isinstance(entity, CadPolyline) and entity.points:
        return [entity.points[0], entity.points[-1]]
    if isinstance(entity, CadInsert):
        return [entity.position]
    return []


def _entity_midpoint(entity: CadEntity) -> CadPoint | None:
    if isinstance(entity, CadLine):
        return CadPoint(x=(entity.start.x+entity.end.x)/2,y=(entity.start.y+entity.end.y)/2,z=(entity.start.z+entity.end.z)/2)
    if isinstance(entity, CadPolyline) and entity.points:
        pts=entity.points
        return pts[len(pts)//2]
    if isinstance(entity, CadInsert):
        return entity.position
    return None


def _dist(a: CadPoint,b: CadPoint)->float:
    return math.dist((a.x,a.y,a.z),(b.x,b.y,b.z))


def _cell(p: CadPoint, size: float) -> tuple[int,int,int]:
    return (round(p.x/size),round(p.y/size),round(p.z/size))


def _neighbors(key: tuple[int,int,int]):
    x,y,z=key
    for dx in (-1,0,1):
        for dy in (-1,0,1):
            for dz in (-1,0,1):
                yield x+dx,y+dy,z+dz


def _text_facts(text: str) -> tuple[float|None,str|None,set[str]]:
    up=_plain(text)
    m=_DIAM.search(text.replace('_',' '))
    diameter=float(m.group(1)) if m and 10 <= float(m.group(1)) <= 2000 else None
    material=next((m for m in _MATERIALS if _plain(m) in up),None)
    systems=set()
    if any(t in up for t in ('AGUA FRIA','AF ',' AF','AF-','AF_')): systems.add('cold_water')
    if any(t in up for t in ('AGUA QUENTE','AQ ',' AQ','AQ-','AQ_')): systems.add('hot_water')
    if any(t in up for t in ('ESGOTO','ESG ','ESG-','ESG_','SANIT')): systems.add('sanitary')
    if any(t in up for t in ('PLUVIAL','AP ',' AP','AP-','AP_')): systems.add('rainwater')
    if any(t in up for t in ('INCENDIO','HIDRANTE','SPRINK','SPK','FIRE')): systems.add('fire_protection')
    return diameter,material,systems


def _direction(entity: CadEntity) -> tuple[float,float] | None:
    pts=_entity_points(entity)
    if len(pts)!=2:
        return None
    dx=pts[1].x-pts[0].x; dy=pts[1].y-pts[0].y
    norm=math.hypot(dx,dy)
    if norm <= 1e-12:
        return None
    return dx/norm,dy/norm


def _approximately_collinear(a: CadEntity,b: CadEntity,max_angle_deg:float=12.0)->bool:
    da=_direction(a); db=_direction(b)
    if not da or not db:
        return False
    dot=abs(da[0]*db[0]+da[1]*db[1])
    return dot >= math.cos(math.radians(max_angle_deg))


def _explicit_profile(entity: CadEntity, semantic: MepSemantic)->bool:
    return bool(
        semantic.evidence=='cad_profile'
        or (
            entity.metadata.get('semantic_target')==semantic.target
            and entity.metadata.get('semantic_system')==semantic.system
        )
    )


def _matching_external_hint(entity: CadEntity, semantic: MepSemantic, *, minimum:float=.90):
    hint=external_semantic_hint(entity)
    if not hint or hint.confidence < minimum or hint.target != semantic.target:
        return None
    if hint.system is not None and hint.system != semantic.system:
        return None
    return hint


def _recognized_insert(entity: CadInsert, semantic: MepSemantic)->bool:
    if _explicit_profile(entity,semantic):
        return True
    label=f'{entity.layer} {entity.block_name}'
    fitting_type,_=fitting_type_from_label(label)
    if semantic.target=='fitting' and fitting_type!='other':
        return True
    plain=_plain(entity.block_name)
    if semantic.target=='equipment' and any(_plain(token) in plain for token in EQUIPMENT_TOKENS):
        return True
    return _matching_external_hint(entity,semantic) is not None


@dataclass(frozen=True)
class MepEvidence:
    semantic: MepSemantic
    score: float
    reasons: tuple[str,...]
    decision: EvidenceDecision = 'candidate'
    strong_evidence_count: int = 0
    negative_reasons: tuple[str,...] = ()
    diameter_mm: float | None = None
    diameter_source: str | None = None
    material: str | None = None
    nearby_text: str | None = None
    connected_component_count: int = 0
    network_seeded: bool = False
    height_m: float | None = None
    elevation_m: float | None = None
    vertical_directive: str | None = None
    associated_text_ids: tuple[str,...] = ()
    vertical_anchor_x: float | None = None
    vertical_anchor_y: float | None = None

    @property
    def create(self) -> bool:
        return self.decision == 'auto_create'


class MepEvidenceEngine:
    def __init__(self, *, text_radius_m: float=.60, connect_tolerance_m: float=.03):
        self.text_radius_m=text_radius_m
        self.connect_tolerance_m=connect_tolerance_m

    def assess(self, document:CadDocument, discipline:MepDiscipline)->dict[str,MepEvidence]:
        base={e.id:classify_mep_entity(e) for e in document.entities}
        base={eid:s for eid,s in base.items() if s and s.discipline==discipline and s.target in {'pipe','fitting','equipment'}}
        by_id={e.id:e for e in document.entities}
        text_index=TextEvidenceIndex(document,radius_m=self.text_radius_m)

        # Only independently recognized inserts may seed a network. Merely being on H-*-CX
        # is not enough; this is the key v1.42 protection against arbitrary CAD blocks.
        strong_component_ids={
            eid for eid,semantic in base.items()
            if isinstance(by_id[eid],CadInsert) and _recognized_insert(by_id[eid],semantic)
        }
        component_grid=defaultdict(list)
        conn_cell=max(self.connect_tolerance_m,0.005)
        for eid in strong_component_ids:
            entity=by_id[eid]
            component_grid[_cell(entity.position,conn_cell)].append(entity)

        line_ids=[eid for eid,s in base.items() if s.target=='pipe' and isinstance(by_id[eid],(CadLine,CadPolyline))]
        endpoint_grid=defaultdict(list)
        for eid in line_ids:
            for pt in _entity_points(by_id[eid]):
                endpoint_grid[_cell(pt,conn_cell)].append(eid)

        direct_seed=set()
        facts={}
        adjacency=defaultdict(set)
        for eid in line_ids:
            entity=by_id[eid]
            semantic=base[eid]
            # Same-system propagation only, and only through approximately collinear
            # line-line continuation. Direction changes should be corroborated by a
            # recognized fitting rather than guessed from touching geometry.
            for pt in _entity_points(entity):
                for nk in _neighbors(_cell(pt,conn_cell)):
                    for other in endpoint_grid.get(nk,[]):
                        if other==eid or base[other].system != semantic.system:
                            continue
                        if not _approximately_collinear(entity,by_id[other]):
                            continue
                        if any(_dist(pt,op)<=self.connect_tolerance_m for op in _entity_points(by_id[other])):
                            adjacency[eid].add(other)

            text_ev=text_index.for_entity(entity)
            diameter=text_ev.diameter_mm
            material=text_ev.material
            systems=set(text_ev.systems)
            joined=text_ev.raw_text

            component_count=0
            for pt in _entity_points(entity):
                for nk in _neighbors(_cell(pt,conn_cell)):
                    for ins in component_grid.get(nk,[]):
                        if _dist(pt,ins.position)<=self.connect_tolerance_m:
                            component_count+=1

            own_diam=None
            m=_DIAM.search(f'{entity.layer} {getattr(entity,"block_name","")}'.replace('_',' '))
            if m and 10 <= float(m.group(1)) <= 2000:
                own_diam=float(m.group(1))
            ext=_matching_external_hint(entity,semantic)
            profile=_explicit_profile(entity,semantic)
            has_system_text=semantic.system in systems
            has_vertical_text=text_ev.vertical_directive is not None
            if diameter or own_diam or has_system_text or has_vertical_text or component_count or profile or ext:
                direct_seed.add(eid)
            facts[eid]=(
                diameter or own_diam,material,joined or None,systems,component_count,profile,ext,
                text_ev.diameter_source,text_ev.height_m,text_ev.elevation_m,text_ev.vertical_directive,text_ev.text_ids,text_ev.anchor_x,text_ev.anchor_y,
            )

        seeded=set(direct_seed)
        q=deque(direct_seed)
        while q:
            cur=q.popleft()
            for other in adjacency.get(cur,()):
                if other not in seeded:
                    seeded.add(other)
                    q.append(other)

        # Detect local stair/tread-like line patterns: many short, parallel, similarly-sized
        # segments with regular spacing. Strong direct evidence may override this negative
        # signal, but a layer name alone never can.
        repetitive=set()
        groups=defaultdict(list)
        for eid in line_ids:
            e=by_id[eid]
            if not isinstance(e,CadLine):
                continue
            dx=e.end.x-e.start.x;dy=e.end.y-e.start.y;length=math.hypot(dx,dy)
            if length<=0 or length>3.0:
                continue
            angle=(math.atan2(dy,dx)%math.pi)
            angle_bucket=round(angle/math.radians(5))
            ux,uy=dx/length,dy/length
            mx=(e.start.x+e.end.x)/2;my=(e.start.y+e.end.y)/2
            along=mx*ux+my*uy
            normal=-mx*uy+my*ux
            groups[(e.layer.upper(),angle_bucket,round(length/.10),round(along/3.0))].append((eid,normal))
        for vals in groups.values():
            if len(vals)<5:
                continue
            ordered=sorted(v for _,v in vals)
            gaps=[b-a for a,b in zip(ordered,ordered[1:]) if .05<=b-a<=.50]
            if len(gaps)<4:
                continue
            mean=sum(gaps)/len(gaps)
            variance=sum((g-mean)**2 for g in gaps)/len(gaps)
            if mean>0 and math.sqrt(variance)/mean<=.35:
                repetitive.update(eid for eid,_ in vals if eid not in direct_seed)

        out={}
        for eid,semantic in base.items():
            entity=by_id[eid]
            role=classify_layer_role(entity.layer)
            if role in {'architecture','context','annotation'}:
                continue

            reasons=[]
            negative=[]
            base_score={
                'observed_layer_tb':.52,
                'observed_layer_cx':.48,
                'sprinkler_layer':.52,
                'generic_fire_token':.35,
                'generic_hydraulic_token':.35,
                'cad_profile':.78,
            }.get(semantic.evidence,.30)
            score=base_score
            reasons.append(semantic.evidence)
            diameter=material=nearby=None
            diameter_source=None
            height_m=elevation_m=vertical_directive=None
            associated_text_ids=()
            vertical_anchor_x=vertical_anchor_y=None
            component_count=0
            network_seed=False
            strong=0

            if semantic.target=='pipe':
                diameter,material,nearby,systems,component_count,profile,ext,text_diameter_source,height_m,elevation_m,vertical_directive,associated_text_ids,vertical_anchor_x,vertical_anchor_y=facts.get(
                    eid,(None,None,None,set(),0,False,None,None,None,None,None,(),None,None)
                )
                diameter_source='nearby_text' if nearby and diameter is not None else ('explicit_token' if diameter is not None else None)
                if text_diameter_source and nearby and diameter is not None:
                    diameter_source='nearby_text'
                if profile:
                    strong+=2;score+=.20;reasons.append('explicit_cad_profile')
                if diameter is not None:
                    strong+=1;score+=.25;reasons.append('diameter_evidence')
                if material is not None:
                    score+=.05;reasons.append('material_text')
                if semantic.system in systems:
                    strong+=1;score+=.18;reasons.append('system_text')
                if vertical_directive is not None:
                    strong+=1;score+=.18;reasons.append('vertical_text')
                if height_m is not None:
                    score+=.08;reasons.append('height_text')
                if elevation_m is not None:
                    score+=.06;reasons.append('elevation_text')
                if component_count:
                    strong+=1;score+=.25;reasons.append('connected_recognized_mep_component')
                if eid in seeded and eid not in direct_seed:
                    strong+=1;score+=.20;network_seed=True;reasons.append('seeded_collinear_mep_network')
                if ext:
                    strong+=1;score+=min(.12,.12*ext.confidence);reasons.append(f'external_hint:{ext.source}')
                if eid in repetitive:
                    score-=.50;negative.append('repetitive_parallel_pattern')

                if eid in repetitive and eid not in direct_seed:
                    decision:EvidenceDecision='reject'
                elif profile and score>=.70:
                    decision='auto_create'
                elif strong>=1 and score>=.58:
                    decision='auto_create'
                else:
                    decision='candidate'

            elif isinstance(entity,CadInsert):
                ft,_=fitting_type_from_label(f'{entity.layer} {entity.block_name}')
                label=_plain(entity.block_name)
                profile=_explicit_profile(entity,semantic)
                ext=_matching_external_hint(entity,semantic)
                recognized_block=(semantic.target=='fitting' and ft!='other') or (
                    semantic.target=='equipment' and any(_plain(token) in label for token in EQUIPMENT_TOKENS)
                )
                if profile:
                    strong+=2;score+=.20;reasons.append('explicit_cad_profile')
                if recognized_block:
                    strong+=1;score+=.30;reasons.append('recognized_block_semantics')
                if ext:
                    strong+=1;score+=min(.12,.12*ext.confidence);reasons.append(f'external_hint:{ext.source}')
                label_for_diameter=f'{entity.layer} {entity.block_name}'.replace('_',' ')
                m=_DIAM.search(label_for_diameter) or re.search(r'(?:^|[_\- ])(\d{2,4})$',entity.block_name)
                if m and 10<=float(m.group(1))<=2000:
                    diameter=float(m.group(1))
                    diameter_source='block_suffix' if re.search(r'(?:^|[_\- ])(\d{2,4})$',entity.block_name) else 'explicit_token'
                    score+=.12;reasons.append('insert_diameter_evidence')
                decision='auto_create' if strong>=1 and score>=.64 else 'candidate'
            else:
                decision='reject'

            out[eid]=MepEvidence(
                semantic=semantic,
                score=max(0.0,min(score,1.0)),
                reasons=tuple(reasons),
                decision=decision,
                strong_evidence_count=strong,
                negative_reasons=tuple(negative),
                diameter_mm=diameter,
                diameter_source=diameter_source,
                material=material,
                nearby_text=nearby,
                connected_component_count=component_count,
                network_seeded=network_seed,
                height_m=height_m,
                elevation_m=elevation_m,
                vertical_directive=vertical_directive,
                associated_text_ids=associated_text_ids,
                vertical_anchor_x=vertical_anchor_x,
                vertical_anchor_y=vertical_anchor_y,
            )
        return out
