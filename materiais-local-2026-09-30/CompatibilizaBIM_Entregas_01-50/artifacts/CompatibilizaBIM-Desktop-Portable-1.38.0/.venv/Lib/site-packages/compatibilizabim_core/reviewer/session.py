from dataclasses import dataclass
from pydantic import TypeAdapter
from cbim_sdk import CBIMProject
from cbim_sdk.models import CBIMElement
ADAPTER=TypeAdapter(CBIMElement)
@dataclass(frozen=True)
class ReviewAction:action:str;element_id:str|None;detail:str=''
class ReviewSession:
    def __init__(self,project:CBIMProject):self.project=project.model_copy(deep=True);self._undo=[];self._redo=[];self.history=[]
    def _snap(self):return self.project.model_dump(mode='python',exclude_computed_fields=True)
    def _before(self):self._undo.append(self._snap());self._redo.clear()
    def _idx(self,eid):
        for i,e in enumerate(self.project.elements):
            if e.id==eid:return i
        raise KeyError(eid)
    def set_state(self,eid,state):
        if state not in {'auto','confirmed','rejected','edited'}:raise ValueError(state)
        self._before();i=self._idx(eid);e=self.project.elements[i];d=e.model_dump(mode='python',exclude={'length'});d['review_state']=state;self.project.elements[i]=type(e).model_validate(d);self.history.append(ReviewAction('state',eid,state))
    def edit(self,eid,**changes):
        self._before();i=self._idx(eid);e=self.project.elements[i];d=e.model_dump(mode='python',exclude={'length'});d.update(changes);d['review_state']='edited';self.project.elements[i]=type(e).model_validate(d);self.history.append(ReviewAction('edit',eid,','.join(sorted(changes))))
    def add(self,element):
        self._before();raw=element.model_dump(mode='python',exclude={'length'}) if hasattr(element,'model_dump') else element;e=ADAPTER.validate_python(raw);d=e.model_dump(mode='python',exclude={'length'});d['review_state']='edited';e=type(e).model_validate(d);self.project.elements.append(e);self.history.append(ReviewAction('add',e.id,e.type))
    def remove(self,eid):
        self._before();self.project.elements.pop(self._idx(eid));self.project.relations=[r for r in self.project.relations if r.from_id!=eid and r.to_id!=eid];self.history.append(ReviewAction('remove',eid))
    def undo(self):
        if not self._undo:return False
        self._redo.append(self._snap());self.project=CBIMProject.model_validate(self._undo.pop());self.history.append(ReviewAction('undo',None));return True
    def redo(self):
        if not self._redo:return False
        self._undo.append(self._snap());self.project=CBIMProject.model_validate(self._redo.pop());self.history.append(ReviewAction('redo',None));return True
    def summary(self):
        counts={};states={}
        for e in self.project.elements:counts[e.type]=counts.get(e.type,0)+1;states[e.review_state]=states.get(e.review_state,0)+1
        return {'elements':counts,'states':states,'history':len(self.history)}
