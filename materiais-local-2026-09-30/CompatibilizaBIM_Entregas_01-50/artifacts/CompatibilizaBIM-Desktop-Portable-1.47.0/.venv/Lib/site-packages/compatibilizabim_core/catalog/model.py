from __future__ import annotations

from pathlib import Path
from typing import Literal
import json

from pydantic import BaseModel, ConfigDict, Field
from cbim_sdk import CBIMProject
from cbim_sdk.models import Equipment, Fitting, Pipe

CatalogCategory = Literal['pipe','fitting','equipment','accessory','system']

class CatalogModel(BaseModel):
    model_config = ConfigDict(extra='forbid')

class CatalogItem(CatalogModel):
    id: str
    manufacturer: str
    line: str
    category: CatalogCategory
    systems: list[str] = Field(default_factory=list)
    material: str | None = None
    nominal_diameters_mm: list[float] = Field(default_factory=list)
    product_code: str | None = None
    description: str | None = None
    source_url: str | None = None
    metadata: dict[str, str | int | float | bool | None] = Field(default_factory=dict)

class CatalogMatch(CatalogModel):
    item_id: str
    manufacturer: str
    line: str
    score: float = Field(ge=0, le=1)
    reasons: list[str] = Field(default_factory=list)

class BrazilianCatalog(CatalogModel):
    version: str = '2026.08'
    items: list[CatalogItem] = Field(default_factory=list)

    @classmethod
    def load(cls, path: str | Path) -> 'BrazilianCatalog':
        return cls.model_validate_json(Path(path).read_text(encoding='utf-8'))

    def save(self, path: str | Path) -> Path:
        target=Path(path); target.write_text(self.model_dump_json(indent=2),encoding='utf-8'); return target

    def get(self, item_id: str) -> CatalogItem | None:
        return next((i for i in self.items if i.id==item_id),None)

    def match_element(self, element, *, preferred_manufacturer: str | None = None, limit: int = 5) -> list[CatalogMatch]:
        if isinstance(element, Pipe): category='pipe'; diameter=element.diameter*1000; system=None
        elif isinstance(element, Fitting): category='fitting'; diameter=(element.nominal_diameter or 0)*1000; system=None
        elif isinstance(element, Equipment): category='equipment'; diameter=0; system=None
        else: return []
        matches=[]
        for item in self.items:
            if item.category not in {category,'system'}: continue
            score=.25; reasons=['category']
            if preferred_manufacturer and item.manufacturer.casefold()==preferred_manufacturer.casefold(): score+=.20; reasons.append('preferred_manufacturer')
            service=str(element.properties.get('service',''))
            if service and service in item.systems: score+=.35; reasons.append('system')
            material_hint=str(element.properties.get('material_hint','')).casefold()
            if material_hint and item.material and material_hint==item.material.casefold(): score+=.10; reasons.append('material')
            if isinstance(element,Fitting):
                fitting_types=str(item.metadata.get('fitting_types','')).casefold().split(',')
                if element.fitting_type!='other' and element.fitting_type in {x.strip() for x in fitting_types if x.strip()}:
                    score+=.10; reasons.append('fitting_type')
            if diameter and item.nominal_diameters_mm:
                nearest=min(abs(d-diameter) for d in item.nominal_diameters_mm)
                if nearest < .5: score+=.20; reasons.append('diameter_exact')
                elif nearest <= 5: score+=.10; reasons.append('diameter_near')
                else: continue
            matches.append(CatalogMatch(item_id=item.id,manufacturer=item.manufacturer,line=item.line,score=min(score,1),reasons=reasons))
        return sorted(matches,key=lambda m:(-m.score,m.manufacturer,m.line,m.item_id))[:limit]


class CatalogAdvisor:
    """Attach neutral catalog correspondences without selecting a manufacturer."""
    def __init__(self,catalog:BrazilianCatalog): self.catalog=catalog
    def advise(self,project:CBIMProject,*,limit:int=5,minimum_score:float=.45)->CBIMProject:
        p=project.model_copy(deep=True)
        for e in p.elements:
            matches=[m for m in self.catalog.match_element(e,limit=limit) if m.score>=minimum_score]
            if not matches: continue
            e.properties['catalog_candidate_count']=len(matches)
            e.properties['catalog_advisory_top_score']=round(matches[0].score,4)
            e.properties['catalog_candidates']=';'.join(f'{m.manufacturer}|{m.line}|{m.item_id}|{m.score:.3f}' for m in matches)
            e.properties['catalog_advisory']='neutral_candidates_only'
        return CBIMProject.model_validate(p.model_dump(exclude_computed_fields=True))

class CatalogEnricher:
    def __init__(self,catalog:BrazilianCatalog): self.catalog=catalog
    def enrich(self, project:CBIMProject, *, preferred_manufacturer:str|None=None, minimum_score:float=.55)->CBIMProject:
        p=project.model_copy(deep=True)
        for e in p.elements:
            # A generic service+diameter match is not evidence of a real manufacturer.
            # Product identity is attached only when the user/project explicitly selects one.
            explicit = preferred_manufacturer or e.properties.get('specified_manufacturer')
            if not explicit:
                continue
            matches=self.catalog.match_element(e,preferred_manufacturer=str(explicit),limit=3)
            if matches and matches[0].score>=minimum_score:
                best=matches[0]; item=self.catalog.get(best.item_id)
                e.properties['catalog_item_id']=best.item_id; e.properties['catalog_manufacturer']=best.manufacturer; e.properties['catalog_line']=best.line; e.properties['catalog_match_score']=round(best.score,4); e.properties['catalog_evidence']='preferred_or_specified_manufacturer'
                if item and item.material: e.properties['catalog_material']=item.material
                if item and item.product_code: e.properties['catalog_product_code']=item.product_code
        return CBIMProject.model_validate(p.model_dump(exclude_computed_fields=True))
