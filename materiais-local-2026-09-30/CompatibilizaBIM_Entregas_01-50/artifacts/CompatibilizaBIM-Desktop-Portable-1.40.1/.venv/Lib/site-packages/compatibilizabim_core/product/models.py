from __future__ import annotations
from pathlib import Path
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, model_validator

ProductDiscipline = Literal['architecture','structure','hydraulic','fire','unknown']
SourceFormat = Literal['dwg','dxf','ifc','cbim']

class ProductModel(BaseModel):
    model_config=ConfigDict(extra='forbid')

class StoreyConfig(ProductModel):
    name:str
    elevation:float
    height:float=Field(default=2.8,gt=0)

class ProjectConfiguration(ProductModel):
    project_name:str='Novo Projeto'
    units:Literal['m','mm','cm']='m'
    coordinate_reference:str='local'
    preferred_manufacturer:str|None=None
    organization:str|None=None
    storeys:list[StoreyConfig]=Field(default_factory=lambda:[StoreyConfig(name='Térreo',elevation=0,height=2.8)])
    profile_path:str|None=None

    @model_validator(mode='after')
    def unique_storeys(self):
        names=[s.name.casefold() for s in self.storeys]
        if len(names)!=len(set(names)): raise ValueError('Storey names must be unique')
        return self

class ImportSource(ProductModel):
    path:str
    name:str
    discipline:ProductDiscipline='unknown'
    source_format:SourceFormat
    role:Literal['primary','xref','reference']='primary'
    enabled:bool=True
    detected_by:str='manual'
    warnings:list[str]=Field(default_factory=list)

class ImportPlan(ProductModel):
    config:ProjectConfiguration
    sources:list[ImportSource]=Field(default_factory=list)
    warnings:list[str]=Field(default_factory=list)
    ready:bool=False

    def enabled_sources(self): return [s for s in self.sources if s.enabled]

class LearnedRuleCandidate(ProductModel):
    selector_kind:Literal['layer','block']='layer'
    selector:str
    target:str
    system:str|None=None
    observations:int
    agreement:float=Field(ge=0,le=1)
    promoted:bool=False

class ProfileLearningResult(ProductModel):
    candidates:list[LearnedRuleCandidate]=Field(default_factory=list)
    promoted_rule_ids:list[str]=Field(default_factory=list)

class ConversionReport(ProductModel):
    project_id:str
    project_name:str
    source_files:int
    element_counts:dict[str,int]=Field(default_factory=dict)
    total_elements:int=0
    review_states:dict[str,int]=Field(default_factory=dict)
    mean_confidence:float=0.0
    low_confidence:int=0
    pending_review:int=0
    confirmed_or_edited:int=0
    completion_rate:float=0.0
    quantity_totals:dict[str,dict[str,float]]=Field(default_factory=dict)
    warnings:list[str]=Field(default_factory=list)
    blockers:list[str]=Field(default_factory=list)
    ready_to_export:bool=False
