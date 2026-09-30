from pathlib import Path
from compatibilizabim_core.cad.model import CadDocument,CadLine,CadPoint
from compatibilizabim_core.dwg import DWGImportDiagnostics,DWGImportResult,NativeXrefReference,DWGNativeXrefResolver
class I:
 def read_result(self,p):
  p=Path(p); doc=CadDocument(source_id=p.name,source_format='dwg',source_path=str(p),entities=[CadLine(id=p.stem,layer='WALL',start=CadPoint(x=0,y=0),end=CadPoint(x=1,y=0))])
  refs=[NativeXrefReference(name='CHILD',path='child.dwg',tx=10)] if p.name=='master.dwg' else []
  return DWGImportResult(document=doc,diagnostics=DWGImportDiagnostics(provider='fake',source_path=str(p),total_entities=1,converted_entities=1),xrefs=refs)
def test_native_xref_resolves_relative_path_and_transform(tmp_path):
 (tmp_path/'master.dwg').write_bytes(b'AC1032');(tmp_path/'child.dwg').write_bytes(b'AC1032')
 out,missing,_=DWGNativeXrefResolver(I()).compose(tmp_path/'master.dwg');assert not missing and len(out.entities)==2
 child=next(e for e in out.entities if e.id.endswith('master/CHILD::child'));assert child.start.x==10
