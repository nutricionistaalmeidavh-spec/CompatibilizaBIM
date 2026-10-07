from pathlib import Path
import ezdxf, pytest
from compatibilizabim_core.dwg import DWGBackendUnavailable,DWGImporter
class FakeProvider:
    name='fake-licensed-provider'
    def __init__(self,available=True): self._available=available
    def available(self): return self._available
    def to_dxf(self,source:Path,target:Path):
        doc=ezdxf.new('R2018'); doc.units=4; doc.layers.add('WALL'); doc.modelspace().add_line((0,0),(1000,0),dxfattribs={'layer':'WALL'}); doc.saveas(target)
def test_dwg_provider_boundary_converts_to_canonical(tmp_path):
    source=tmp_path/'tower.dwg'; source.write_bytes(b'fake dwg fixture'); out=DWGImporter(FakeProvider()).read(source); assert out.source_format=='dwg' and out.metadata['dwg_provider']=='fake-licensed-provider' and round(out.entities[0].end.x,6)==1.0
def test_dwg_missing_provider_fails_explicitly(tmp_path):
    source=tmp_path/'tower.dwg'; source.write_bytes(b'x')
    with pytest.raises(DWGBackendUnavailable): DWGImporter(FakeProvider(False)).read(source)
