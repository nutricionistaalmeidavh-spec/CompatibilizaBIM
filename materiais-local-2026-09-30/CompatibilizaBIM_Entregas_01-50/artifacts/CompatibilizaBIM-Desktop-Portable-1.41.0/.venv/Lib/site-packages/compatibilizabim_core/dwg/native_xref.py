from __future__ import annotations
from pathlib import Path
from .models import DWGImportResult
from ..xref import XrefNode,CadTransform,XrefComposer

class DWGNativeXrefResolver:
    def __init__(self,importer,max_depth:int=16): self.importer=importer; self.max_depth=max_depth
    def _tree(self,path:Path,stack:tuple[Path,...],depth:int):
        rp=path.resolve()
        if rp in stack: raise ValueError('native DWG XREF cycle detected: '+' -> '.join(x.name for x in stack+(rp,)))
        if depth>self.max_depth: raise ValueError(f'native DWG XREF exceeds max depth {self.max_depth}')
        result=self.importer.read_result(path); node=XrefNode(path.stem,result.document); missing=[]
        for ref in result.xrefs:
            child_path=Path(ref.path)
            if not child_path.is_absolute(): child_path=path.parent/child_path
            if not child_path.exists(): missing.append(str(child_path)); continue
            child, child_missing, _child_result=self._tree(child_path,stack+(rp,),depth+1)
            missing.extend(child_missing)
            child.name=ref.name or child_path.stem
            child.transform=CadTransform(tx=ref.tx,ty=ref.ty,tz=ref.tz,rotation_deg=ref.rotation_deg,scale=ref.scale)
            node.children.append(child)
        return node,missing,result
    def compose(self,path:str|Path):
        path=Path(path); root,missing,result=self._tree(path,tuple(),0); doc=XrefComposer().compose(root)
        data=doc.model_dump(); data['metadata']={**doc.metadata,'native_xref':True,'native_xref_missing':len(missing)}; doc=doc.model_validate(data)
        return doc,missing,result
