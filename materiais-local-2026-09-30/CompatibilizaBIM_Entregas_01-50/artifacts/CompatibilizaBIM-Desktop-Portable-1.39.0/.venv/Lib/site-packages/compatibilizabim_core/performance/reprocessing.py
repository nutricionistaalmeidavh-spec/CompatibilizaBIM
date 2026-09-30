from __future__ import annotations

import hashlib
import json
from collections import deque
from typing import Callable, Generic, TypeVar

from pydantic import BaseModel, ConfigDict, Field
from cbim_sdk import CBIMProject

from ..cad.model import CadDocument, CadInsert
from .incremental import EntityHasher, IncrementalPlanner, SpatialPartitioner

T=TypeVar("T")


class ReprocessModel(BaseModel):
    model_config=ConfigDict(extra="forbid")


class DocumentFingerprint(ReprocessModel):
    entity_hashes: dict[str,str]
    block_hashes: dict[str,str]
    settings_hash: str
    document_hash: str


class IncrementalExecutionPlan(ReprocessModel):
    mode: str
    reasons: list[str]=Field(default_factory=list)
    changed_entity_ids: list[str]=Field(default_factory=list)
    affected_tiles: list[tuple[int,int]]=Field(default_factory=list)
    selected_entity_ids: list[str]=Field(default_factory=list)
    invalidated_stages: list[str]=Field(default_factory=list)
    impacted_cbim_ids: list[str]=Field(default_factory=list)


class IncrementalExecutionResult(ReprocessModel, Generic[T]):
    mode: str
    plan: IncrementalExecutionPlan
    output: T


class DocumentFingerprinter:
    def __init__(self):self.entities=EntityHasher()
    @staticmethod
    def _hash(data)->str:
        raw=json.dumps(data,sort_keys=True,separators=(",",":"),ensure_ascii=True,default=str).encode()
        return hashlib.sha256(raw).hexdigest()
    def fingerprint(self,doc:CadDocument,*,settings:dict|None=None)->DocumentFingerprint:
        eh=self.entities.document(doc)
        bh={name:self._hash(block.model_dump(mode="json")) for name,block in sorted(doc.blocks.items())}
        settings_hash=self._hash(settings or {})
        document_hash=self._hash({"entities":eh,"blocks":bh,"settings":settings_hash,"units":doc.units})
        return DocumentFingerprint(entity_hashes=eh,block_hashes=bh,settings_hash=settings_hash,document_hash=document_hash)


class IncrementalReprocessor:
    """Execute safe local CAD reprocessing and explicit global fallbacks.

    The engine never assumes topology-changing operations are local. Block definition
    changes, removals, settings changes and insert changes force a global rebuild.
    Pure local entity edits can be sliced by spatial tile and recomputed with a halo.
    """
    STAGE_ORDER=["geometry","topology","architecture","structure","mep","connectivity","intelligence","quantities","integration"]
    def __init__(self,*,tile_size_m:float=25.0,neighbor_tiles:int=1):
        self.planner=IncrementalPlanner(tile_size_m=tile_size_m,neighbor_tiles=neighbor_tiles)
        self.partitioner=SpatialPartitioner(tile_size_m=tile_size_m)
        self.fingerprinter=DocumentFingerprinter()

    def plan(self,before:CadDocument,after:CadDocument,*,before_settings:dict|None=None,after_settings:dict|None=None,project:CBIMProject|None=None)->IncrementalExecutionPlan:
        # Fingerprint once per document; reuse entity hashes for change detection.
        bfp=self.fingerprinter.fingerprint(before,settings=before_settings);afp=self.fingerprinter.fingerprint(after,settings=after_settings)
        bh,ah=bfp.entity_hashes,afp.entity_hashes
        added=sorted(ah.keys()-bh.keys());removed=sorted(bh.keys()-ah.keys());changed_existing=sorted(k for k in ah.keys()&bh.keys() if ah[k]!=bh[k]);changed=sorted(set(added+removed+changed_existing))
        if not changed and bfp.document_hash==afp.document_hash:
            return IncrementalExecutionPlan(mode="noop",reasons=["no_changes"],invalidated_stages=[])
        bby={e.id:e for e in before.entities};aby={e.id:e for e in after.entities};tiles=set()
        for eid in added+changed_existing:
            for t in self.partitioner.keys_for_entity(aby[eid]):tiles.add(t)
        for eid in removed+changed_existing:
            for t in self.partitioner.keys_for_entity(bby[eid]):tiles.add(t)
        expanded=set()
        for x,y in tiles:
            for dx in range(-self.planner.neighbor_tiles,self.planner.neighbor_tiles+1):
                for dy in range(-self.planner.neighbor_tiles,self.planner.neighbor_tiles+1):expanded.add((x+dx,y+dy))
        reasons=[]
        global_rebuild=bool(removed) or any(isinstance(aby.get(i),CadInsert) or isinstance(bby.get(i),CadInsert) for i in changed)
        if bfp.block_hashes!=afp.block_hashes:global_rebuild=True;reasons.append("block_definition_changed")
        if bfp.settings_hash!=afp.settings_hash:global_rebuild=True;reasons.append("processing_settings_changed")
        if removed:reasons.append("entity_removed")
        if any(isinstance(aby.get(i),CadInsert) for i in added+changed_existing):reasons.append("insert_changed")
        if global_rebuild:
            selected=sorted(e.id for e in after.entities);out_tiles=sorted(self.partitioner.partition(after));mode="global"
        else:
            out_tiles=sorted(expanded);tile_set=set(out_tiles);selected=sorted(e.id for e in after.entities if self.partitioner.keys_for_entity(e)&tile_set);mode="local";reasons.append("spatial_local_change")
        impacted=self.impact_cbim(project,changed) if project else []
        return IncrementalExecutionPlan(mode=mode,reasons=sorted(set(reasons)),changed_entity_ids=changed,affected_tiles=out_tiles,selected_entity_ids=selected,invalidated_stages=self.STAGE_ORDER.copy(),impacted_cbim_ids=impacted)

    def slice_document(self,document:CadDocument,plan:IncrementalExecutionPlan)->CadDocument:
        if plan.mode in {"global","noop"}:return document
        ids=set(plan.selected_entity_ids)
        return document.model_copy(update={"entities":[e for e in document.entities if e.id in ids],"metadata":{**document.metadata,"incremental_slice":True,"slice_entity_count":len(ids)}})

    def impact_cbim(self,project:CBIMProject|None,changed_source_ids:list[str])->list[str]:
        if project is None:return []
        changed=set(changed_source_ids);seed=set()
        for e in project.elements:
            if any(ref.entity_id in changed or ref.metadata.get("generated_segment_id") in changed for ref in e.source_refs):seed.add(e.id)
        # Expand through CBIM relations so hosted/connected consumers are invalidated too.
        graph={}
        for rel in project.relations:
            graph.setdefault(rel.from_id,set()).add(rel.to_id);graph.setdefault(rel.to_id,set()).add(rel.from_id)
        seen=set(seed);q=deque(seed)
        while q:
            node=q.popleft()
            for nxt in graph.get(node,()):
                if nxt not in seen:seen.add(nxt);q.append(nxt)
        return sorted(seen)

    def execute(self,before:CadDocument,after:CadDocument,*,local_processor:Callable[[CadDocument],T],global_processor:Callable[[CadDocument],T],before_settings:dict|None=None,after_settings:dict|None=None,project:CBIMProject|None=None)->IncrementalExecutionResult[T]:
        plan=self.plan(before,after,before_settings=before_settings,after_settings=after_settings,project=project)
        if plan.mode=="noop":output=local_processor(self.slice_document(after,plan))
        elif plan.mode=="local":output=local_processor(self.slice_document(after,plan))
        else:output=global_processor(after)
        return IncrementalExecutionResult(mode=plan.mode,plan=plan,output=output)
