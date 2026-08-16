from __future__ import annotations
import argparse, json
from pathlib import Path
from .engine import ClashEngine
from .ifc_backend import IfcOpenShellBackend
from .models import ClashRequest

def main(argv=None):
    p = argparse.ArgumentParser(); p.add_argument('file_a', type=Path); p.add_argument('file_b', type=Path); p.add_argument('--mode', default='intersection', choices=('intersection','collision','clearance')); p.add_argument('--tolerance', type=float, default=.002); p.add_argument('--clearance', type=float, default=.05)
    a = p.parse_args(argv); result = ClashEngine(IfcOpenShellBackend()).run(ClashRequest(a.file_a, a.file_b, mode=a.mode, tolerance=a.tolerance, clearance=a.clearance))
    print(json.dumps({'file_a': str(a.file_a), 'file_b': str(a.file_b), 'mode': a.mode, 'conflitos': [r.__dict__ if hasattr(r, '__dict__') else {'indice': r.index, 'modo': r.mode, 'aGlobalId': r.a_global_id, 'bGlobalId': r.b_global_id, 'aClasse': r.a_ifc_class, 'bClasse': r.b_ifc_class, 'aNome': r.a_name, 'bNome': r.b_name, 'ponto': r.point, 'distanciaM': r.depth_m} for r in result]}, ensure_ascii=False))
    return 0
if __name__ == '__main__': raise SystemExit(main())
