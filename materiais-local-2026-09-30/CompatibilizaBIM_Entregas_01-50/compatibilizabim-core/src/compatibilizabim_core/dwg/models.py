from __future__ import annotations
from collections import Counter
from pathlib import Path
from pydantic import BaseModel, ConfigDict, Field
from ..cad.model import CadDocument

class DWGModel(BaseModel):
    model_config=ConfigDict(extra="forbid")

class NativeXrefReference(DWGModel):
    name:str
    path:str
    tx:float=0.0; ty:float=0.0; tz:float=0.0
    rotation_deg:float=0.0
    scale:float=1.0
    resolved:bool=False

class DWGImportDiagnostics(DWGModel):
    provider:str
    source_path:str
    version:str|None=None
    unit_name:str|None=None
    unit_scale_to_m:float=1.0
    total_entities:int=0
    converted_entities:int=0
    unsupported_entities:int=0
    blocks:int=0
    xrefs:int=0
    by_source_type:dict[str,int]=Field(default_factory=dict)
    by_canonical_kind:dict[str,int]=Field(default_factory=dict)
    unsupported_types:dict[str,int]=Field(default_factory=dict)
    warnings:list[str]=Field(default_factory=list)
    errors:list[str]=Field(default_factory=list)
    @property
    def coverage(self)->float:
        return 1.0 if self.total_entities==0 else self.converted_entities/self.total_entities

class DWGImportResult(DWGModel):
    document:CadDocument
    diagnostics:DWGImportDiagnostics
    xrefs:list[NativeXrefReference]=Field(default_factory=list)

class BridgePayload(DWGModel):
    document:CadDocument
    diagnostics:DWGImportDiagnostics
    xrefs:list[NativeXrefReference]=Field(default_factory=list)
