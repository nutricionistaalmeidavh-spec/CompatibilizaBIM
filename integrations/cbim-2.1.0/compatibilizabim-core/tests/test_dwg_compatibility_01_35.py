from compatibilizabim_core.dwg import inspect_dwg_signature,run_compatibility_suite

def test_supported_and_unsupported_headers(tmp_path):
 good=tmp_path/'new.dwg';good.write_bytes(b'AC1032rest');old=tmp_path/'r12.dwg';old.write_bytes(b'AC1009rest')
 assert inspect_dwg_signature(good)==('AC1032','2018+',True)
 assert inspect_dwg_signature(old)[2] is False
 rows=run_compatibility_suite([good,old]);assert [r.declared_supported for r in rows]==[True,False]
