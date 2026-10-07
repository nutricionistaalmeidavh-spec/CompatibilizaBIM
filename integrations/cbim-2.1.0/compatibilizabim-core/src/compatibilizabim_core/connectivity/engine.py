from __future__ import annotations
import math
from collections import defaultdict
from itertools import product
from pydantic import BaseModel,ConfigDict,Field
from cbim_sdk import CBIMProject
from cbim_sdk.models import Equipment,Fitting,Pipe,Point3D,Relation,SanitaryTerminal
from shapely.geometry import LineString,Point
from shapely.strtree import STRtree

class ConnectivityModel(BaseModel): model_config=ConfigDict(extra='forbid')
class NetworkNode(ConnectivityModel):
    id:str; x:float; y:float; z:float; element_ids:list[str]=Field(default_factory=list)
class NetworkEdge(ConnectivityModel):
    id:str; from_node_id:str; to_node_id:str; pipe_id:str; length:float
class MEPNetwork(ConnectivityModel):
    system_id:str|None=None; nodes:list[NetworkNode]=Field(default_factory=list); edges:list[NetworkEdge]=Field(default_factory=list); components:list[list[str]]=Field(default_factory=list); open_end_node_ids:list[str]=Field(default_factory=list)

def _xyz(p): return (p.x,p.y,p.z)
def _nearest_parameter(a:Point3D,b:Point3D,p:Point3D):
    av=_xyz(a);bv=_xyz(b);pv=_xyz(p);v=tuple(bv[i]-av[i] for i in range(3));den=sum(q*q for q in v)
    if den<=1e-18:return 0.0,math.dist(av,pv)
    t=max(0.0,min(1.0,sum((pv[i]-av[i])*v[i] for i in range(3))/den));q=tuple(av[i]+t*v[i] for i in range(3));return t,math.dist(q,pv)
def _interpolate(a:Point3D,b:Point3D,t:float)->Point3D:
    return Point3D(x=a.x+(b.x-a.x)*t,y=a.y+(b.y-a.y)*t,z=a.z+(b.z-a.z)*t)

class _PointGrid:
    """Small 3D spatial hash used for node clustering and O(1)-ish nearest lookup."""
    def __init__(self,tol:float):self.tol=tol;self.cells=defaultdict(list);self.points=[]
    def key(self,p):return (math.floor(p.x/self.tol),math.floor(p.y/self.tol),math.floor(p.z/self.tol))
    def neighbours(self,p):
        k=self.key(p)
        for d in product((-1,0,1),repeat=3):
            yield from self.cells[(k[0]+d[0],k[1]+d[1],k[2]+d[2])]
    def find(self,p):
        best=None;bestd=self.tol+1e-12
        for i in self.neighbours(p):
            d=math.dist(_xyz(p),_xyz(self.points[i]))
            if d<=bestd:best,bestd=i,d
        return best
    def add(self,p):
        i=len(self.points);self.points.append(p);self.cells[self.key(p)].append(i);return i

class MEPConnectivityEngine:
    def __init__(self,*,tolerance_m:float=.03):
        if tolerance_m<=0: raise ValueError('tolerance_m must be positive')
        self.tol=tolerance_m
    def _key(self,p:Point3D): return (round(p.x/self.tol),round(p.y/self.tol),round(p.z/self.tol))
    def build(self,project:CBIMProject)->list[MEPNetwork]:
        bysys=defaultdict(list)
        for e in project.elements:
            sid=getattr(e,'system_id',None)
            if isinstance(e,(Pipe,Fitting,Equipment,SanitaryTerminal)) and sid: bysys[sid].append(e)
        networks=[]
        for sid,elements in sorted(bysys.items()):
            components=[e for e in elements if isinstance(e,(Fitting,Equipment,SanitaryTerminal))]
            comp_points=[Point(c.position.x,c.position.y) for c in components]
            comp_tree=STRtree(comp_points) if comp_points else None
            raw_points=[]; raw_segments=[]
            for e in elements:
                if not isinstance(e,Pipe):continue
                for a,b in zip(e.path,e.path[1:]):
                    cuts=[(0.0,a,e.id),(1.0,b,e.id)]
                    candidate_indices=[]
                    if comp_tree is not None:
                        line=LineString([(a.x,a.y),(b.x,b.y)])
                        candidate_indices=[int(i) for i in comp_tree.query(line.buffer(self.tol))]
                    for ci in candidate_indices:
                        c=components[ci];t,d=_nearest_parameter(a,b,c.position)
                        if d<=self.tol and -1e-9<=t<=1+1e-9: cuts.append((t,_interpolate(a,b,t),c.id))
                    cuts.sort(key=lambda x:x[0]);dedup=[]
                    for cut in cuts:
                        if not dedup or abs(cut[0]-dedup[-1][0])>1e-8:dedup.append(cut)
                        else: dedup[-1]=(dedup[-1][0],dedup[-1][1],dedup[-1][2]+'|'+cut[2])
                    for _,p,ids in dedup: raw_points.append((p,ids.split('|')))
                    for u,v in zip(dedup,dedup[1:]):
                        if math.dist(_xyz(u[1]),_xyz(v[1]))>1e-9: raw_segments.append((u[1],v[1],e.id))
            for c in components: raw_points.append((c.position,[c.id]))
            grid=_PointGrid(self.tol);members=[]
            for p,ids in raw_points:
                match=grid.find(p)
                if match is None:
                    grid.add(p);members.append(set(ids))
                else:members[match].update(ids)
            coords=grid.points
            nodes=[NetworkNode(id=f'{sid}:N{i:05d}',x=p.x,y=p.y,z=p.z,element_ids=sorted(ids)) for i,(p,ids) in enumerate(zip(coords,members),1)]
            edges=[]
            for i,(a,b,pid) in enumerate(raw_segments,1):
                ia,ib=grid.find(a),grid.find(b)
                if ia is None or ib is None or ia==ib:continue
                edges.append(NetworkEdge(id=f'{sid}:E{i:05d}',from_node_id=nodes[ia].id,to_node_id=nodes[ib].id,pipe_id=pid,length=math.dist(_xyz(a),_xyz(b))))
                nodes[ia].element_ids=sorted(set(nodes[ia].element_ids)|{pid});nodes[ib].element_ids=sorted(set(nodes[ib].element_ids)|{pid})
            adjacency=defaultdict(set)
            for e in edges:adjacency[e.from_node_id].add(e.to_node_id);adjacency[e.to_node_id].add(e.from_node_id)
            comps=[];seen=set()
            for n in [n.id for n in nodes]:
                if n in seen:continue
                stack=[n];comp=[];seen.add(n)
                while stack:
                    u=stack.pop();comp.append(u)
                    for v in adjacency[u]:
                        if v not in seen:seen.add(v);stack.append(v)
                comps.append(sorted(comp))
            open_ends=[n.id for n in nodes if len(adjacency[n.id])==1 and not any(not eid.startswith('pipe_') for eid in n.element_ids)]
            networks.append(MEPNetwork(system_id=sid,nodes=nodes,edges=edges,components=comps,open_end_node_ids=open_ends))
        return networks
    def enrich_relations(self,project:CBIMProject)->CBIMProject:
        p=project.model_copy(deep=True);existing={(r.type,r.from_id,r.to_id) for r in p.relations}
        for net in self.build(p):
            for node in net.nodes:
                ids=node.element_ids
                for i,a in enumerate(ids):
                    for b in ids[i+1:]:
                        key=('connects',a,b)
                        if key not in existing and ('connects',b,a) not in existing:
                            p.relations.append(Relation(type='connects',from_id=a,to_id=b,metadata={'system_id':net.system_id,'network_node_id':node.id,'tolerance_m':self.tol}));existing.add(key)
        return CBIMProject.model_validate(p.model_dump(exclude_computed_fields=True))
