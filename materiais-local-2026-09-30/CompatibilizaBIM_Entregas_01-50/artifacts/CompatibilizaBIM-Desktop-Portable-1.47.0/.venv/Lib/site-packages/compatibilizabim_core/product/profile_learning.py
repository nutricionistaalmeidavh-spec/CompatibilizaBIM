from __future__ import annotations
from collections import defaultdict,Counter
from cbim_sdk import CBIMProject
from ..profiles import CadProfile,CadRule
from .models import LearnedRuleCandidate,ProfileLearningResult

class CADProfileLearner:
    """Learns only from explicit human-reviewed CBIM elements.

    Automatic recognitions are intentionally excluded so model errors cannot
    silently teach future projects.
    """
    def learn(self,project:CBIMProject,*,profile_name:str='Learned CAD Profile',organization:str|None=None,min_observations:int=2,min_agreement:float=.8)->tuple[CadProfile,ProfileLearningResult]:
        observations=defaultdict(list)
        for e in project.elements:
            if e.review_state not in {'confirmed','edited'}:continue
            system=e.properties.get('semantic_system') or e.properties.get('system')
            for ref in e.source_refs:
                layer=ref.layer or ref.metadata.get('layer')
                block=ref.metadata.get('block')
                if layer:observations[('layer',str(layer).upper())].append((e.type,system))
                if block:observations[('block',str(block).upper())].append((e.type,system))
        rules=[];candidates=[]
        for (kind,selector),values in sorted(observations.items()):
            target_counts=Counter(v[0] for v in values);target,count=target_counts.most_common(1)[0]
            agreement=count/len(values);systems=Counter(v[1] for v in values if v[1]);system=systems.most_common(1)[0][0] if systems else None
            promoted=len(values)>=min_observations and agreement>=min_agreement
            candidate=LearnedRuleCandidate(selector_kind=kind,selector=selector,target=target,system=system,observations=len(values),agreement=agreement,promoted=promoted);candidates.append(candidate)
            if promoted:
                rid=f'learned-{kind}-{selector.lower().replace(" ","-")}'
                kwargs={kind:selector}
                rules.append(CadRule(id=rid,target=target,match='exact',system=system,priority=100,**kwargs))
        profile=CadProfile(name=profile_name,organization=organization,rules=rules)
        return profile,ProfileLearningResult(candidates=candidates,promoted_rule_ids=[r.id for r in rules])

    def merge(self,base:CadProfile,learned:CadProfile)->CadProfile:
        by_id={r.id:r for r in base.rules}
        for rule in learned.rules:by_id[rule.id]=rule
        return CadProfile(name=base.name,version=base.version,organization=base.organization or learned.organization,rules=list(by_id.values()))
