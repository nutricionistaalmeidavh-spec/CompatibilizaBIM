from __future__ import annotations
from itertools import combinations
from cbim_sdk import CBIMProject
from cbim_sdk.models import Beam,Column,Door,Equipment,Fitting,Opening,Pipe,Slab,Space,Wall,Window
from ..integration import CoreIntegrationGateway
from .models import Discipline,FederatedElementRef,CrossDisciplineClashCandidate,FederatedValidationSnapshot

PHYSICAL={'wall','column','beam','slab','pipe','equipment','opening'}

def _points(e):
    if isinstance(e,Wall): return [e.start,e.end]
    if isinstance(e,Beam): return [e.start,e.end]
    if isinstance(e,Column):
        c=e.center; return [type(c)(x=c.x-e.width/2,y=c.y-e.depth/2,z=c.z),type(c)(x=c.x+e.width/2,y=c.y+e.depth/2,z=c.z+e.height)]
    if isinstance(e,Slab): return e.boundary
    if isinstance(e,Pipe): return e.path
    if isinstance(e,(Equipment,Fitting,Door,Window,Opening)): return [e.position]
    if isinstance(e,Space): return e.boundary
    return []

def _bbox(e):
    pts=_points(e)
    if not pts:return None
    xs=[p.x for p in pts];ys=[p.y for p in pts];zs=[p.z for p in pts]
    pad=0.0
    if isinstance(e,Wall): pad=e.thickness/2
    elif isinstance(e,Beam): pad=max(e.width,e.height)/2
    elif isinstance(e,Pipe): pad=e.diameter/2
    elif isinstance(e,(Equipment,Fitting)): pad=.05
    elif isinstance(e,Opening): pad=max(e.width,e.depth or .05)/2
    if isinstance(e,Wall): zmax=max(zs)+e.height
    elif isinstance(e,Slab): zmax=max(zs)+e.thickness
    else:zmax=max(zs)
    return (min(xs)-pad,min(ys)-pad,min(zs)-pad,max(xs)+pad,max(ys)+pad,zmax+pad)

def _intersect(a,b,tol=1e-6):
    if not a or not b:return False,0.0
    dx=min(a[3],b[3])-max(a[0],b[0]);dy=min(a[4],b[4])-max(a[1],b[1]);dz=min(a[5],b[5])-max(a[2],b[2])
    hit=dx>=-tol and dy>=-tol and dz>=-tol
    return hit,max(dx,0)*max(dy,0)*max(dz,0)

class FederationEngine:
    def __init__(self): self.gateway=CoreIntegrationGateway()
    def federate(self,projects:dict[Discipline,CBIMProject],*,candidate_limit:int=5000)->FederatedValidationSnapshot:
        refs=[]; issues={}; networks={}; collisions=[]; seen={}
        for d,p in projects.items():
            snap=self.gateway.snapshot(p);issues[d]=snap.issue_targets;networks[d]=snap.network_count
            for e in p.elements:
                if e.id in seen:collisions.append(e.id)
                seen[e.id]=d
                refs.append(FederatedElementRef(discipline=d,project_id=p.id,element_id=e.id,element_type=e.type,storey_id=e.storey_id,bbox=_bbox(e)))
        candidates=[]
        by_d={d:[r for r in refs if r.discipline==d and r.element_type in PHYSICAL] for d in projects}
        for da,db in combinations(projects.keys(),2):
            for a in by_d[da]:
                for b in by_d[db]:
                    hit,vol=_intersect(a.bbox,b.bbox)
                    if hit:
                        candidates.append(CrossDisciplineClashCandidate(left=a,right=b,overlap_volume=vol))
                        if len(candidates)>=candidate_limit:break
                if len(candidates)>=candidate_limit:break
            if len(candidates)>=candidate_limit:break
        warnings=[]
        if collisions:warnings.append(f'{len(collisions)} duplicate CBIM element IDs across discipline projects')
        if len(candidates)>=candidate_limit:warnings.append(f'clash candidate list truncated at {candidate_limit}')
        return FederatedValidationSnapshot(disciplines=list(projects.keys()),project_ids={d:p.id for d,p in projects.items()},element_counts={d:len(p.elements) for d,p in projects.items()},total_elements=sum(len(p.elements) for p in projects.values()),issue_targets=issues,network_counts=networks,id_collisions=sorted(set(collisions)),cross_discipline_candidates=candidates,passed=not collisions,warnings=warnings)
