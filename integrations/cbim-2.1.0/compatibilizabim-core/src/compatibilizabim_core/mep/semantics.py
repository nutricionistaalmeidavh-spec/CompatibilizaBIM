from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
from typing import Literal

from ..cad.model import CadEntity, CadInsert, CadLine, CadPolyline

MepDiscipline = Literal['hydraulic', 'fire']
MepTarget = Literal['pipe', 'fitting', 'equipment', 'ignore']


def _plain(value: str) -> str:
    normalized = unicodedata.normalize('NFKD', value or '')
    return ''.join(ch for ch in normalized if not unicodedata.combining(ch)).upper().strip()


ANNOTATION_LAYERS = {
    'TEXTO', 'TEXTO AMBIENTE', 'SETAS', 'COTA', 'COTAS', 'DIM', 'DIMENSOES', 'DIMENSÕES'
}

FITTING_TOKENS = (
    'TEE', 'TE_', '_TE', 'TÊ', 'JOELHO', 'ELBOW', 'CURVA', 'COR090', 'COR045',
    'REDUC', 'LUVA', 'COUPLING', 'CAP', 'TAMPA', 'CRUZ', 'CROSS', 'Y_'
)
EQUIPMENT_TOKENS = (
    'REGISTRO', 'VALVE', 'VALV', 'BOMBA', 'PUMP', 'RALO', 'DRAIN', 'CAIXA', 'TANK',
    'AQUECEDOR', 'HIDRANTE', 'SPRINKLER', 'SPRINK', 'RESERVATORIO', 'RESERVATÓRIO'
)


LayerRole = Literal['mep','architecture','annotation','context','unknown']

_ARCHITECTURE_LAYER_TOKENS = ('ALVENARIA','ESCADA','PAREDE','WALL','STAIR')
_CONTEXT_LAYER_TOKENS = ('PROJECAO','EIXO','PISO','VAGAS','FOLHA','CARIMBO','FORRO','LAYOUT','VERDE','NIVEIS','NIVEL')


def classify_layer_role(layer: str) -> LayerRole:
    value=_plain(layer)
    if value in {_plain(x) for x in ANNOTATION_LAYERS}: return 'annotation'
    if any(token == value or token in value for token in _ARCHITECTURE_LAYER_TOKENS): return 'architecture'
    if value=='AR' or any(token == value or token in value for token in _CONTEXT_LAYER_TOKENS): return 'context'
    if re.match(r'^H-(AF|AQ|ES|AP|INC)-(TB|CX|MT)$',value) or value=='REDE SPK': return 'mep'
    if any(token in value for token in ('INCENDIO','FIRE','HIDRANTE','SPRINK','AGUA_FRIA','AGUA_QUENTE','ESGOTO','PLUVIAL')): return 'mep'
    if re.search(r'(^|[-_ ])(AF|AQ|AP|ESG)([-_ ]|$)',value): return 'mep'
    return 'unknown'



@dataclass(frozen=True)
class MepSemantic:
    discipline: MepDiscipline
    system: str
    target: MepTarget
    evidence: str


def _target_for_insert(entity: CadInsert, *, default: MepTarget = 'fitting') -> MepTarget:
    label = _plain(entity.block_name)
    if any(_plain(token) in label for token in EQUIPMENT_TOKENS):
        return 'equipment'
    if any(_plain(token) in label for token in FITTING_TOKENS):
        return 'fitting'
    return default


def classify_mep_entity(entity: CadEntity) -> MepSemantic | None:
    """Classify observed Brazilian MEP CAD conventions without guessing product brands.

    Exact conventions are intentionally conservative. They encode patterns observed in a
    real hydraulic/fire DWG and coexist with the older generic token recognizers.
    """
    layer = _plain(entity.layer)
    block = _plain(getattr(entity, 'block_name', ''))
    role=classify_layer_role(entity.layer)
    if role in {'annotation','architecture','context'}:
        return None
    profile_target=str(entity.metadata.get('semantic_target',''))
    profile_system=str(entity.metadata.get('semantic_system',''))
    if profile_target in {'pipe','fitting','equipment'} and profile_system:
        discipline: MepDiscipline = 'fire' if profile_system=='fire_protection' else 'hydraulic'
        if profile_target=='pipe' and isinstance(entity,(CadLine,CadPolyline)):
            return MepSemantic(discipline,profile_system,'pipe','cad_profile')
        if profile_target in {'fitting','equipment'} and isinstance(entity,CadInsert):
            target=_target_for_insert(entity,default=profile_target)
            return MepSemantic(discipline,profile_system,target,'cad_profile')

    # Observed project convention: TB = tubulation linework, CX = connection inserts.
    m = re.match(r'^H-(AF|AQ|ES|AP|INC)-(TB|CX|MT)$', layer)
    if m:
        service_code, family = m.groups()
        if service_code == 'INC':
            discipline: MepDiscipline = 'fire'
            system = 'fire_protection'
        else:
            discipline = 'hydraulic'
            system = {'AF':'cold_water', 'AQ':'hot_water', 'ES':'sanitary', 'AP':'rainwater'}[service_code]
        if family == 'TB' and isinstance(entity, (CadLine, CadPolyline)):
            return MepSemantic(discipline, system, 'pipe', 'observed_layer_tb')
        if family == 'CX' and isinstance(entity, CadInsert):
            return MepSemantic(discipline, system, _target_for_insert(entity), 'observed_layer_cx')
        # MT remains unknown until a real sample establishes its semantics.
        return None

    # Sprinkler network layer observed in the same real project.
    if layer == 'REDE SPK' or 'SPRINK' in layer:
        if isinstance(entity, (CadLine, CadPolyline)):
            return MepSemantic('fire', 'fire_protection', 'pipe', 'sprinkler_layer')
        if isinstance(entity, CadInsert):
            return MepSemantic('fire', 'fire_protection', _target_for_insert(entity, default='equipment'), 'sprinkler_layer')

    label = f'{layer} {block}'
    if any(token in label for token in ('INCENDIO','FIRE','HIDRANTE','SPRINK','FIREPVC')):
        target: MepTarget = 'pipe' if isinstance(entity,(CadLine,CadPolyline)) else _target_for_insert(entity) if isinstance(entity,CadInsert) else 'ignore'
        return MepSemantic('fire','fire_protection',target,'generic_fire_token') if target != 'ignore' else None

    hydraulic_systems = (
        ('cold_water', ('AGUA_FRIA','AF_','AF-','COLD')),
        ('hot_water', ('AGUA_QUENTE','AQ_','AQ-','HOT')),
        ('sanitary', ('ESGOTO','SANIT','ESG_','ESG-','SEWER')),
        ('rainwater', ('PLUVIAL','AP_','AP-','RAIN')),
    )
    for system, tokens in hydraulic_systems:
        if any(token in label for token in tokens):
            target = 'pipe' if isinstance(entity,(CadLine,CadPolyline)) else _target_for_insert(entity) if isinstance(entity,CadInsert) else 'ignore'
            return MepSemantic('hydraulic',system,target,'generic_hydraulic_token') if target != 'ignore' else None
    return None


def is_annotation_entity(entity: CadEntity) -> bool:
    return _plain(entity.layer) in {_plain(x) for x in ANNOTATION_LAYERS}


def mep_candidate(entity: CadEntity, discipline: MepDiscipline) -> bool:
    semantic = classify_mep_entity(entity)
    return bool(semantic and semantic.discipline == discipline and semantic.target in {'pipe','fitting','equipment'})
