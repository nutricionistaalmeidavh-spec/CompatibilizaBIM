from __future__ import annotations
import math
from collections import defaultdict
from dataclasses import dataclass
from cbim_sdk import CBIMProject
from cbim_sdk.models import Fitting,Pipe,Point3D

@dataclass(frozen=True)
class NetworkReconstructionReport:
    segmented_paths:int=0
    elbows:int=0
    tees:int=0
    crosses:int=0
    reducers:int=0
    coupling_candidates:int=0


def _xyz(p:Point3D): return (p.x,p.y,p.z)
def _dist(a:Point3D,b:Point3D): return math.dist(_xyz(a),_xyz(b))
def _unit(node:Point3D,other:Point3D):
    vx,vy,vz=other.x-node.x,other.y-node.y,other.z-node.z;L=math.sqrt(vx*vx+vy*vy+vz*vz)
    return (0.,0.,0.) if L<=1e-12 else (vx/L,vy/L,vz/L)
def _angle(u,v):
    dot=max(-1.,min(1.,sum(a*b for a,b in zip(u,v))))
    return math.degrees(math.acos(dot))
def _key(p:Point3D,tol:float): return (round(p.x/tol),round(p.y/tol),round(p.z/tol))

class MEPNetworkReconstructor:
    """Infer explicit fittings from the already-recognized MEP network.

    CBIM keeps a multi-vertex Pipe path for backward compatibility and quantities, while
    the IFC exporter emits each straight leg as an IfcPipeSegment. This stage inserts the
    missing semantic fitting at internal bends and at multi-pipe junctions.
    """
    def __init__(self,*,tolerance_m:float=.03,angle_tolerance_deg:float=8.0):
        self.tol=tolerance_m;self.angle_tol=angle_tolerance_deg

    def reconstruct(self,project:CBIMProject)->tuple[CBIMProject,NetworkReconstructionReport]:
        p=project.model_copy(deep=True)
        pipes=[e for e in p.elements if isinstance(e,Pipe)]
        existing=[e for e in p.elements if isinstance(e,Fitting)]
        # Each incident record is (pipe, node, outward direction, segment index).
        nodes=defaultdict(list);segmented_paths=0
        for pipe in pipes:
            if len(pipe.path)>2: segmented_paths+=1
            for i,(a,b) in enumerate(zip(pipe.path,pipe.path[1:])):
                if _dist(a,b)<=1e-9:continue
                nodes[(pipe.system_id,_key(a,self.tol))].append((pipe,a,_unit(a,b),i))
                nodes[(pipe.system_id,_key(b,self.tol))].append((pipe,b,_unit(b,a),i))
        new=[];elbows=tees=crosses=reducers=coupling_candidates=0
        for (sid,_),items in nodes.items():
            if len(items)<2:continue
            anchor=items[0][1]
            if any(_dist(node,anchor)>self.tol for _,node,_,_ in items):continue
            nearby_existing=[f for f in existing if f.system_id==sid and _dist(f.position,anchor)<=self.tol]
            if nearby_existing:
                connected=','.join(sorted({r[0].id for r in items}))
                for f in nearby_existing:
                    props=dict(f.properties);props.setdefault('connected_pipe_ids',connected);props.setdefault('network_node_degree',len(items));f.properties=props
                continue
            if any(f.system_id==sid and _dist(f.position,anchor)<=self.tol for f in new):continue
            dirs=[r[2] for r in items];diameters=[r[0].diameter for r in items];dmax=max(diameters);dmin=min(diameters)
            ftype=None;props={'inferred_from_topology':True,'connected_pipe_ids':','.join(sorted({r[0].id for r in items}))}
            degree=len(items)
            if degree>=4:
                ftype='cross';crosses+=1
            elif degree==3:
                ftype='tee';tees+=1
            elif degree==2:
                ang=_angle(dirs[0],dirs[1]);props['angle_deg']=round(ang,3)
                if abs(dmax-dmin)>max(.001,dmax*.05):
                    ftype='reducer';reducers+=1;props['diameter_in_m']=dmax;props['diameter_out_m']=dmin
                elif abs(180-ang)<=self.angle_tol:
                    # Only flag a possible coupling when two different CAD/BIM pipe objects meet.
                    if items[0][0].id != items[1][0].id:
                        coupling_candidates+=1
                        items[0][0].properties['coupling_candidate_at_endpoint']=True
                        items[1][0].properties['coupling_candidate_at_endpoint']=True
                    continue
                elif self.angle_tol < ang < 180-self.angle_tol:
                    ftype='elbow';elbows+=1
            if ftype:
                new.append(Fitting(position=Point3D(x=anchor.x,y=anchor.y,z=anchor.z),fitting_type=ftype,nominal_diameter=dmax,system_id=sid,confidence=.93 if ftype in {'elbow','tee','cross'} else .88,properties=props))
        p.elements.extend(new)
        p.metadata['network_reconstruction_segmented_path_count']=segmented_paths
        p.metadata['network_reconstruction_elbow_count']=elbows
        p.metadata['network_reconstruction_tee_count']=tees
        p.metadata['network_reconstruction_cross_count']=crosses
        p.metadata['network_reconstruction_reducer_count']=reducers
        p.metadata['network_reconstruction_coupling_candidate_count']=coupling_candidates
        out=CBIMProject.model_validate(p.model_dump(exclude_computed_fields=True))
        return out,NetworkReconstructionReport(segmented_paths=segmented_paths,elbows=elbows,tees=tees,crosses=crosses,reducers=reducers,coupling_candidates=coupling_candidates)
