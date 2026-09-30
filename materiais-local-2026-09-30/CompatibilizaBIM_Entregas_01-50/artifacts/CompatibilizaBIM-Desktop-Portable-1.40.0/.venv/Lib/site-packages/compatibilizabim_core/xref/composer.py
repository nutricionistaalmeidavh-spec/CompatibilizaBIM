from __future__ import annotations
import math
from dataclasses import dataclass,field
from ..cad.model import CadDocument,CadPoint,CadLine,CadPolyline,CadArc,CadCircle,CadSpline,CadInsert,CadText,CadBlock

@dataclass(frozen=True)
class CadTransform:
    tx:float=0.;ty:float=0.;tz:float=0.;rotation_deg:float=0.;scale:float=1.
    def __post_init__(self):
        if self.scale<=0:raise ValueError('scale must be positive')
    def point(self,p:CadPoint)->CadPoint:
        a=math.radians(self.rotation_deg);c,s=math.cos(a),math.sin(a);x,y=p.x*self.scale,p.y*self.scale
        return CadPoint(x=x*c-y*s+self.tx,y=x*s+y*c+self.ty,z=p.z*self.scale+self.tz)
    def combine(self,child:'CadTransform')->'CadTransform':
        # Parent(self) after child. Uniform scale keeps circles/arcs valid.
        o=self.point(CadPoint(x=child.tx,y=child.ty,z=child.tz))
        return CadTransform(tx=o.x,ty=o.y,tz=o.z,rotation_deg=self.rotation_deg+child.rotation_deg,scale=self.scale*child.scale)

@dataclass
class XrefNode:
    name:str
    document:CadDocument
    transform:CadTransform=field(default_factory=CadTransform)
    children:list['XrefNode']=field(default_factory=list)

class XrefComposer:
    """Compose nested DXF/DWG-provider documents while preserving provenance."""
    def _entity(self,e,t:CadTransform,prefix:str,depth:int):
        raw=e.model_copy(deep=True);raw.id=f'{prefix}::{e.id}';raw.metadata={**e.metadata,'xref_path':prefix,'xref_source_entity_id':e.id,'xref_depth':depth}
        if isinstance(raw,CadLine):raw.start=t.point(raw.start);raw.end=t.point(raw.end)
        elif isinstance(raw,(CadPolyline,CadSpline)):raw.points=[t.point(p) for p in raw.points]
        elif isinstance(raw,(CadCircle,CadArc)):raw.center=t.point(raw.center);raw.radius*=t.scale
        elif isinstance(raw,(CadInsert,CadText)):
            raw.position=t.point(raw.position);raw.rotation_deg+=t.rotation_deg
            if isinstance(raw,CadInsert):
                raw.block_name=f'{prefix}::{raw.block_name}'
                raw.xscale*=t.scale;raw.yscale*=t.scale;raw.zscale*=t.scale
            elif raw.height is not None:raw.height*=t.scale
        return raw
    def _block_entity(self,e,prefix:str,depth:int):
        # Block definitions stay in the source document's local coordinates. Only
        # their names/IDs are namespaced; the referencing INSERT receives the XREF
        # transform. This prevents double-transforming expanded block geometry.
        raw=e.model_copy(deep=True);raw.id=f'{prefix}::block::{e.id}';raw.metadata={**e.metadata,'xref_path':prefix,'xref_source_entity_id':e.id,'xref_depth':depth}
        if isinstance(raw,CadInsert): raw.block_name=f'{prefix}::{raw.block_name}'
        return raw
    def compose(self,root:XrefNode)->CadDocument:
        entities=[];blocks={};layers=set();active=set();seen_names=set()
        def visit(node:XrefNode,parent_t:CadTransform,path:list[str]):
            oid=id(node)
            if oid in active:raise ValueError('XREF cycle detected: '+' -> '.join(path+[node.name]))
            active.add(oid);full=path+[node.name];prefix='/'.join(full);t=parent_t.combine(node.transform)
            for e in node.document.entities:
                x=self._entity(e,t,prefix,len(full)-1);entities.append(x);layers.add(x.layer)
            # Namespace block definitions so same block names from different xrefs cannot collide.
            for name,b in node.document.blocks.items():
                key=f'{prefix}::{name}';blocks[key]=CadBlock(name=key,base_point=b.base_point.model_copy(deep=True),entities=[self._block_entity(e,prefix,len(full)-1) for e in b.entities])
            for child in node.children:visit(child,t,full)
            active.remove(oid);seen_names.add(prefix)
        visit(root,CadTransform(),[])
        return CadDocument(source_id=f'xref:{root.name}',source_format='canonical',source_path=root.document.source_path,entities=entities,blocks=blocks,layers=sorted(layers),metadata={'xref_root':root.name,'xref_document_count':len(seen_names),'xref_composed':True})
