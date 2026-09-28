from __future__ import annotations
import argparse
from pathlib import Path
from .ifc_backend import IfcOpenShellBackend
from .quantities import QuantityEngine, quantity_report, write_quantity_csv, write_quantity_json


def build_parser():
    p=argparse.ArgumentParser(prog='compatibilizabim-quantities',description='Extrai quantitativos BIM de arquivos IFC.')
    p.add_argument('files',nargs='+',type=Path)
    p.add_argument('--output',type=Path,default=Path('quantities.json'))
    p.add_argument('--csv',type=Path,default=None)
    p.add_argument('--no-geometry-fallback',action='store_true')
    return p

def main(argv=None):
    a=build_parser().parse_args(argv)
    rows=QuantityEngine(IfcOpenShellBackend()).extract(a.files,geometry_fallback=not a.no_geometry_fallback)
    report=quantity_report(rows,model_files=[p.name for p in a.files]); write_quantity_json(a.output,report)
    if a.csv: write_quantity_csv(a.csv,report)
    print(f"Quantitativos: {report['record_count']} registros / {report['group_count']} grupos -> {a.output}")
    return 0

if __name__=='__main__': raise SystemExit(main())
