from pathlib import Path
from compatibilizabim_core.cad.model import CadDocument,CadLine,CadPoint
from compatibilizabim_core.dwg import DWGImportDiagnostics,DWGImportResult,DWGToCBIMPipeline
class I:
 def read_result(self,p):
  # four wall-pairs around a 4x3 room
  lines=[];i=0
  for a,b in [((0,0),(4,0)),((0,.14),(4,.14)),((4,0),(4,3)),((3.86,0),(3.86,3)),((0,3),(4,3)),((0,2.86),(4,2.86)),((0,0),(0,3)),((.14,0),(.14,3))]:
   i+=1;lines.append(CadLine(id=str(i),layer='WALL',start=CadPoint(x=a[0],y=a[1]),end=CadPoint(x=b[0],y=b[1])))
  d=CadDocument(source_id='dwg:test',source_format='dwg',source_path=str(p),entities=lines,layers=['WALL'])
  return DWGImportResult(document=d,diagnostics=DWGImportDiagnostics(provider='fake',source_path=str(p),total_entities=len(lines),converted_entities=len(lines)))
def test_dwg_to_cbim_to_ifc(tmp_path):
 dwg=tmp_path/'room.dwg';dwg.write_bytes(b'AC1032');ifc=tmp_path/'room.ifc';r=DWGToCBIMPipeline(I()).run(dwg,resolve_xrefs=False,export_ifc=ifc,include_hydraulic=False,include_fire=False)
 assert r.project.elements and ifc.exists() and r.ifc_sanity['has_ifc4_schema']
