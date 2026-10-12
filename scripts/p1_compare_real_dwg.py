"""Compare CBIM 2.1 real-DWG evidence with the historic known-source baseline.
Never interpret coverage or recognition_rate as precision of the inferred BIM model.
"""
from __future__ import annotations
import argparse
import json
from pathlib import Path


METRICS = ('import_coverage', 'converted_entities', 'unsupported_entities',
           'relevant_elements', 'review_pending_count', 'network_count')


def compare_validation(current: dict, baseline: dict, *, source: str = '') -> dict:
    def number(doc: dict, key: str) -> float | None:
        raw = doc.get(key)
        return float(raw) if isinstance(raw, (float, int)) and not isinstance(raw, bool) else None

    deltas = {}
    for key in METRICS:
        new, old = number(current, key), number(baseline, key)
        deltas[key] = {'baseline': old, 'current': new, 'delta': None if new is None or old is None else round(new - old, 5)}

    old_counts = baseline.get('element_counts') or {}
    new_counts = current.get('element_counts') or {}
    if not isinstance(new_counts, dict) or not isinstance(old_counts, dict):
        raise ValueError('Contagem de elementos inválida')
    classes = sorted(set(old_counts) | set(new_counts))
    elements = {key: {'baseline': old_counts.get(key), 'current': new_counts.get(key)} for key in classes}
    flags = []
    if deltas['import_coverage']['delta'] is not None and deltas['import_coverage']['delta'] < -0.01:
        flags.append('cobertura_importacao_reduzida_mais_1pp')
    for role in ('pipe', 'fitting', 'wall'):
        prev, now = old_counts.get(role), new_counts.get(role)
        if isinstance(prev, int) and prev > 0 and isinstance(now, int) and now < prev * 0.8:
            flags.append(f'{role}_count_drop_gt_20pct')
    previous_pending = number(baseline, 'review_pending_count')
    current_pending = number(current, 'review_pending_count')
    if previous_pending and current_pending is not None and current_pending > previous_pending * 2:
        flags.append('pendencias_mais_que_dobraram')

    native_ifc_ok = current.get('provider') == 'acadsharp' and current.get('ifc_exported') is True and current.get('ifc_sanity_passed') is True
    if not native_ifc_ok:
        flags.append('validacao_nativa_ifc_nao_comprovada')
    return {
        'source': source,
        'historic_version': '1.40.1',
        'candidate_version': '2.1.0',
        'technical_gate_passed': native_ifc_ok,
        'core_thresholds_passed': current.get('passed') is True,
        'needs_engineer_review': bool(flags) or current.get('review_pending_count', 0) > 0,
        'warnings': flags,
        'metrics': deltas,
        'element_counts': elements,
        'notes': [
            'Cobertura de importação mede entidades lidas, não precisão geométrica/semântica.',
            'Taxa recognition_rate usa denominador de entidades elegíveis; não é precisão.',
            'Regressões de quantidade precisam ser conferidas em CAD/IFC por um projetista.',
            'Análises históricas em versões anteriores não certificam Revit nativo na versão atual.'
        ]
    }


def main(argv=None):
    p = argparse.ArgumentParser()
    p.add_argument('--baseline', required=True, type=Path)
    p.add_argument('--current', required=True, type=Path)
    p.add_argument('--output', required=True, type=Path)
    p.add_argument('--source', default='')
    a = p.parse_args(argv)
    report = compare_validation(
        json.loads(a.current.read_text(encoding='utf-8')),
        json.loads(a.baseline.read_text(encoding='utf-8')), source=a.source)
    a.output.parent.mkdir(parents=True, exist_ok=True)
    a.output.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps({k: report[k] for k in ('technical_gate_passed','core_thresholds_passed','needs_engineer_review','warnings')}, ensure_ascii=False))
    return 0 if report['technical_gate_passed'] else 2


if __name__ == '__main__':
    raise SystemExit(main())
