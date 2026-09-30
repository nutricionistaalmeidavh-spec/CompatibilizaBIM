from __future__ import annotations

from .model import CadProfile, CadRule


def observed_brazil_mep_profile() -> CadProfile:
    """Conservative built-in profile from a real Brazilian hydraulic/fire DWG.

    Only exact layer conventions proven in the validation sample are encoded here.
    Unknown families (for example H-INC-MT) are intentionally left unmapped.
    """
    return CadProfile(
        name='Observed Brazil MEP v1',
        version='1.0',
        rules=[
            CadRule(id='af-tb', target='pipe', layer='H-AF-TB', match='exact', system='cold_water', priority=100),
            CadRule(id='af-cx', target='fitting', layer='H-AF-CX', match='exact', system='cold_water', priority=100),
            CadRule(id='es-tb', target='pipe', layer='H-ES-TB', match='exact', system='sanitary', priority=100),
            CadRule(id='inc-tb', target='pipe', layer='H-INC-TB', match='exact', system='fire_protection', priority=100),
            CadRule(id='inc-cx', target='fitting', layer='H-INC-CX', match='exact', system='fire_protection', priority=100),
            CadRule(id='spk', target='pipe', layer='REDE SPK', match='exact', system='fire_protection', priority=90),
            CadRule(id='texto', target='ignore', layer='TEXTO', match='exact', priority=100),
            CadRule(id='texto-amb', target='ignore', layer='TEXTO AMBIENTE', match='exact', priority=100),
            CadRule(id='setas', target='ignore', layer='SETAS', match='exact', priority=100),
            CadRule(id='cota', target='ignore', layer='COTA', match='exact', priority=100),
            CadRule(id='cotas', target='ignore', layer='COTAS', match='exact', priority=100),
        ],
    )
