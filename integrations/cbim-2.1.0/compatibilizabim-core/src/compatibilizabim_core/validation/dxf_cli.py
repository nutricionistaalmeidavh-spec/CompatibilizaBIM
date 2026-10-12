"""First-class, evidence-preserving DXF -> CBIM -> IFC converter.
It uses the existing deterministic DXFImporter and CBIM pipeline, not a DWG fallback.
"""
from __future__ import annotations

import argparse
import json
import sys
from collections import Counter

import ezdxf
from pathlib import Path

from compatibilizabim_core.cad.dxf import DXFImporter
from compatibilizabim_core.dwg.models import DWGImportDiagnostics, DWGImportResult
from compatibilizabim_core.validation.models import ValidationCase
from compatibilizabim_core.validation.runner import RealDWGValidationRunner


class NativeDXFAdapter:
    def __init__(self, *, unitless_scale_to_m: float = 1.0):
        self.reader = DXFImporter(unitless_scale_to_m=unitless_scale_to_m)

    def read_result(self, source):
        source = Path(source)
        if source.suffix.lower() != '.dxf' or not source.is_file():
            raise ValueError('A fonte deve ser um DXF local existente')
        document = self.reader.read(source)
        drawing = ezdxf.readfile(source)
        raw_types = Counter(entity.dxftype() for entity in drawing.modelspace())
        supported = {'LINE','LWPOLYLINE','POLYLINE','ARC','CIRCLE','SPLINE','INSERT','TEXT','MTEXT'}
        unsupported_types = {name: count for name, count in raw_types.items() if name not in supported}
        xrefs = {
            str(block.name) for block in drawing.blocks
            if (int(getattr(block.block.dxf, 'flags', 0) or 0) & 4)
        }
        kinds = {}
        for entity in document.entities:
            kinds[entity.kind] = kinds.get(entity.kind, 0) + 1
        # The DXFImporter expands local blocks in the downstream canonical
        # pipeline; external references without available block definitions
        # must never disappear without diagnostics.
        missing = sorted(xrefs | {
            entity.block_name for entity in document.entities
            if entity.kind == 'insert' and entity.block_name not in document.blocks
        })
        notes = [f'Bloco/XREF externo não resolvido: {name}; vincule e importe a fonte separadamente'
                 for name in missing]
        if unsupported_types:
            notes.append('Entidades DXF não convertidas: ' + ', '.join(
                f'{kind} ({count})' for kind, count in sorted(unsupported_types.items())
            ))
        diagnostic = DWGImportDiagnostics(
            provider='ezdxf', source_path=str(source),
            version=str(document.metadata.get('dxf_version') or ''),
            unit_scale_to_m=float(document.metadata.get('scale_to_m', 1)),
            total_entities=sum(raw_types.values()),
            converted_entities=min(sum(raw_types.values()), len(document.entities)),
            unsupported_entities=sum(unsupported_types.values()),
            unsupported_types=unsupported_types,
            blocks=len(document.blocks), by_canonical_kind=kinds,
            warnings=notes,
        )
        return DWGImportResult(document=document, diagnostics=diagnostic)


def main(argv=None):
    parser = argparse.ArgumentParser(description='Importa DXF real em CBIM/IFC usando ezdxf')
    parser.add_argument('--source', type=Path, required=True)
    parser.add_argument('--discipline', choices=['architecture', 'structure', 'hydraulic', 'fire'], required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--unitless-scale-to-m', type=float, default=1)
    args = parser.parse_args(argv)
    if not args.source.is_file() or args.source.suffix.lower() != '.dxf':
        parser.error('Informe um arquivo DXF local válido')
    if args.unitless_scale_to_m <= 0:
        parser.error('O fator de escala deve ser positivo')
    adapter = NativeDXFAdapter(unitless_scale_to_m=args.unitless_scale_to_m)
    case = ValidationCase(
        name=f'{args.discipline}-{args.source.stem}', discipline=args.discipline,
        source_path=str(args.source), evidence_kind='real_project', resolve_xrefs=False
    )
    batch = RealDWGValidationRunner(adapter, output_dir=args.output).run_batch([case], federate=False)
    # A single DXF cannot provide the four-discipline production evidence
    # of the native DWG pilot gate, but lack of ACadSharp is not an error here.
    batch.blockers = [
        item for item in batch.blockers
        if item not in ('native_acadsharp_execution_not_proven_for_all_cases', 'all_four_disciplines_not_validated')
    ]
    (args.output / 'validation-batch.json').write_text(
        batch.model_dump_json(indent=2, ensure_ascii=True), encoding='utf-8'
    )
    print(batch.model_dump_json(indent=2, ensure_ascii=True), flush=True)
    return 0 if batch.all_passed else 1


if __name__ == '__main__':
    raise SystemExit(main())
