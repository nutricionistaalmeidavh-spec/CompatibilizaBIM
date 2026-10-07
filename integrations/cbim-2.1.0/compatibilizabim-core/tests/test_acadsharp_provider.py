import json,sys
from pathlib import Path
from compatibilizabim_core.dwg import ACadSharpProvider,DWGImporter

def payload(path):
 return {'document':{'source_id':'dwg:test','source_format':'dwg','source_path':str(path),'units':'m','entities':[{'id':'dwg:1A','kind':'line','layer':'WALL','metadata':{'source_type':'Line','handle':'1A'},'start':{'x':0,'y':0,'z':0},'end':{'x':4,'y':0,'z':0}}],'blocks':{},'layers':['WALL'],'metadata':{}},'diagnostics':{'provider':'acadsharp','source_path':str(path),'version':'AC1032','unit_name':'Meters','unit_scale_to_m':1,'total_entities':1,'converted_entities':1,'unsupported_entities':0,'blocks':0,'xrefs':0,'by_source_type':{'Line':1},'by_canonical_kind':{'line':1},'unsupported_types':{},'warnings':[],'errors':[]},'xrefs':[]}
def test_acadsharp_direct_provider_contract(tmp_path):
 dwg=tmp_path/'a.dwg';dwg.write_bytes(b'AC1032fake')
 script=tmp_path/'bridge.py';script.write_text("import json,sys; from pathlib import Path; p="+repr(payload(dwg))+"; Path(sys.argv[2]).write_text(json.dumps(p))")
 provider=ACadSharpProvider(command=[sys.executable,str(script),'{source}','{target}']); result=DWGImporter(provider).read_result(dwg)
 assert result.document.source_format=='dwg' and result.document.metadata['native_dwg'] is True
 assert result.diagnostics.coverage==1 and result.document.entities[0].end.x==4
