from __future__ import annotations
import json
from pathlib import Path
import ezdxf
from compatibilizabim_core.validation.dxf_cli import NativeDXFAdapter, main

def make_dxf(path:Path):
    doc=ezdxf.new('R2013')
    doc.units=6  # meters
    doc.layers.new('WALL')
    doc.modelspace().add_line((0,0),(5,0),dxfattribs={'layer':'WALL'})
    doc.modelspace().add_line((0,.14),(5,.14),dxfattribs={'layer':'WALL'})
    doc.saveas(path)

def test_dxf_adapter_produces_original_canonical_coordinates_and_provenance(tmp_path):
    source=tmp_path/'ARQ-demo.dxf';make_dxf(source)
    result=NativeDXFAdapter().read_result(source)
    assert result.diagnostics.provider=='ezdxf'
    assert result.document.source_format=='dxf'
    assert result.document.units=='m'
    assert len(result.document.entities)==2
    assert result.document.entities[0].end.x==5
    assert result.diagnostics.coverage==1

def test_dxf_cli_executes_real_pipeline_and_preserves_ifc_diagnostics(tmp_path):
    source=tmp_path/'ARQ-demo.dxf';make_dxf(source)
    destination=tmp_path/'cbim-output'
    code=main(['--source',str(source),'--discipline','architecture','--output',str(destination)])
    assert code in (0,1), 'Semantic thresholds can require manual review'
    batch=json.loads((destination/'validation-batch.json').read_text())
    assert batch['reports'][0]['provider']=='ezdxf'
    assert batch['reports'][0]['discipline']=='architecture'
    assert (destination/'architecture-ARQ-demo.cbim.json').is_file()
    assert batch['reports'][0]['ifc_sanity_passed'] is True
    assert (destination/'architecture-ARQ-demo.ifc').is_file()
    assert batch['production_evidence_eligible'] is False

def test_dxf_cli_never_accepts_wrong_extension_or_unitless_negative(tmp_path):
    bad=tmp_path/'demo.dwg';bad.write_text('not dxf')
    import pytest
    with pytest.raises(SystemExit):
        main(['--source',str(bad),'--discipline','hydraulic','--output',str(tmp_path/'out')])
    with pytest.raises(SystemExit):
        main(['--source',str(bad.with_suffix('.dxf')),'--discipline','hydraulic','--output',str(tmp_path/'out'),'--unitless-scale-to-m','-1'])

def test_dxf_unsupported_entities_are_counted_not_marked_as_full_coverage(tmp_path):
    source=tmp_path/'ARQ-unknown.dxf'
    doc=ezdxf.new('R2013');doc.modelspace().add_line((0,0),(1,0))
    doc.modelspace().add_point((1,1))
    doc.saveas(source)
    result=NativeDXFAdapter().read_result(source)
    assert result.diagnostics.total_entities==2
    assert result.diagnostics.converted_entities==1
    assert result.diagnostics.unsupported_types['POINT']==1
    assert result.diagnostics.coverage==.5
