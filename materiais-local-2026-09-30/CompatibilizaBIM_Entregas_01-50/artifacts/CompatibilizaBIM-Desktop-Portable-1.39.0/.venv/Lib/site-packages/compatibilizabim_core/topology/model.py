from typing import Literal
from pydantic import BaseModel, ConfigDict, Field
class TopologyModel(BaseModel): model_config=ConfigDict(extra='forbid')
class TopologyNode(TopologyModel):
    id:str; x:float; y:float; degree:int=0
    kind:Literal['endpoint','pass','t_junction','cross','junction']='endpoint'
    source_entity_ids:list[str]=Field(default_factory=list)
class TopologyEdge(TopologyModel):
    id:str; start_node_id:str; end_node_id:str; source_entity_id:str; layer:str='0'; length:float=Field(gt=0); synthetic:bool=False
class TopologyFace(TopologyModel):
    id:str; boundary:list[tuple[float,float]]=Field(min_length=3); area:float=Field(gt=0); source_entity_ids:list[str]=Field(default_factory=list)
class TopologyGraph(TopologyModel):
    nodes:list[TopologyNode]=Field(default_factory=list); edges:list[TopologyEdge]=Field(default_factory=list); faces:list[TopologyFace]=Field(default_factory=list)
    metadata:dict[str,int|float|str|bool]=Field(default_factory=dict)
