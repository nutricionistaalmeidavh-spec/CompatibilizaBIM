import hashlib
from pathlib import Path
import pytest
from compatibilizabim.p2_workflow import P2Service

def _fixture(tmp_path: Path):
    svc=P2Service(tmp_path)
    source=tmp_path/'sources'
    source.mkdir()
    file=source/'HID-qa.ifc'
    file.write_text('ISO-10303-21;DATA;ENDSEC;',encoding='utf-8')
    svc.put_fixture_quantities({
        'records':[], 'groups':[], 'model_files':[file.name],
        'revision_sha256':{file.name:hashlib.sha256(file.read_bytes()).hexdigest()}
    })
    return svc,file

def test_ifc_query_rejects_unapproved_source_traversal_and_stale_revision(tmp_path):
    svc,file=_fixture(tmp_path)
    for name in ('../private.ifc','not-in-qto.ifc','/etc/passwd'):
        with pytest.raises(ValueError):
            svc.execute('ifc_query',{'file':name})
    file.write_text('ISO-10303-21;DATA;CHANGED;',encoding='utf-8')
    with pytest.raises(ValueError,match='revisão'):
        svc.execute('ifc_query',{'file':file.name})

def test_ifc_query_rejects_excessive_limits_and_injection(tmp_path):
    svc,file=_fixture(tmp_path)
    for params in ({'limit':9999},{'offset':-1},{'ifc_class':'IfcWall);import os'},{'text':'x'*501}):
        with pytest.raises(ValueError):
            svc.execute('ifc_query',{'file':file.name,**params})

def test_ifc_query_reads_authentic_ifc_and_never_modifies_qto(tmp_path,monkeypatch):
    svc,file=_fixture(tmp_path)
    class Element:
        GlobalId='IFC-GUID-1'
        Name='Tubo hidráulico'
        Description='Ø50 mm'
        ObjectType=None
        def is_a(self): return 'IfcPipeSegment'
    class Model:
        def by_type(self,name):
            assert name in ('IfcElement','IfcPipeSegment')
            return [Element()]
    import ifcopenshell
    monkeypatch.setattr(ifcopenshell,'open',lambda path:Model())
    before=(tmp_path/'quantities.json').read_bytes()
    result=svc.execute('ifc_query',{'file':file.name,'ifc_class':'IfcPipeSegment','text':'tubo','limit':25})
    assert result['source']=='ifcopenshell_real'
    assert result['rows'][0]['guid']=='IFC-GUID-1'
    assert result['read_only'] is True
    assert (tmp_path/'quantities.json').read_bytes()==before
