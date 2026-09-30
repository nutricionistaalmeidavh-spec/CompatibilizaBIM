from __future__ import annotations

from typing import Literal
from pydantic import BaseModel, ConfigDict, Field


class PilotModel(BaseModel): model_config=ConfigDict(extra='forbid')


class PilotEvidence(PilotModel):
    evidence_kind:Literal['fixture','public_sample','real_client_project']='fixture'
    production_evidence_eligible:bool=False
    native_dwg_backend_validated:bool=False
    disciplines_validated:list[str]=Field(default_factory=list)
    import_coverage:float=Field(default=0,ge=0,le=1)
    recognition_coverage:float=Field(default=0,ge=0,le=1)
    pending_review_ratio:float=Field(default=1,ge=0,le=1)
    ifc_export_passed:bool=False
    federation_passed:bool=False
    quantities_passed:bool=False
    persistence_passed:bool=False
    recovery_passed:bool=False
    desktop_smoke_passed:bool=False
    license_validation_passed:bool=False
    real_element_count:int=Field(default=0,ge=0)
    notes:list[str]=Field(default_factory=list)


class PilotCheck(PilotModel):
    name:str;passed:bool;observed:str;requirement:str


class PilotGateResult(PilotModel):
    pilot_ready:bool
    status:str
    checks:list[PilotCheck]
    blockers:list[str]=Field(default_factory=list)


class FirstCommercialPilotGate:
    def __init__(self,*,min_import_coverage=.95,min_recognition_coverage=.80,max_pending_review=.25,min_real_elements=100):
        self.min_import_coverage=min_import_coverage;self.min_recognition_coverage=min_recognition_coverage;self.max_pending_review=max_pending_review;self.min_real_elements=min_real_elements
    def evaluate(self,e:PilotEvidence)->PilotGateResult:
        required_disciplines={'architecture','structure','hydraulic','fire'}
        checks=[
            PilotCheck(name='real_evidence',passed=e.evidence_kind=='real_client_project' and e.production_evidence_eligible,observed=f'{e.evidence_kind}, eligible={e.production_evidence_eligible}',requirement='real client project explicitly eligible as production evidence'),
            PilotCheck(name='native_dwg',passed=e.native_dwg_backend_validated,observed=str(e.native_dwg_backend_validated),requirement='native ACadSharp DWG bridge compiled and exercised on real DWG'),
            PilotCheck(name='disciplines',passed=required_disciplines.issubset(set(e.disciplines_validated)),observed=','.join(sorted(e.disciplines_validated)),requirement='architecture, structure, hydraulic and fire validated'),
            PilotCheck(name='import_coverage',passed=e.import_coverage>=self.min_import_coverage,observed=f'{e.import_coverage:.1%}',requirement=f'>={self.min_import_coverage:.0%}'),
            PilotCheck(name='recognition_coverage',passed=e.recognition_coverage>=self.min_recognition_coverage,observed=f'{e.recognition_coverage:.1%}',requirement=f'>={self.min_recognition_coverage:.0%}'),
            PilotCheck(name='review_load',passed=e.pending_review_ratio<=self.max_pending_review,observed=f'{e.pending_review_ratio:.1%}',requirement=f'<={self.max_pending_review:.0%} pending manual review'),
            PilotCheck(name='ifc_export',passed=e.ifc_export_passed,observed=str(e.ifc_export_passed),requirement='IFC export passes'),
            PilotCheck(name='federation',passed=e.federation_passed,observed=str(e.federation_passed),requirement='multidiscipline federation passes'),
            PilotCheck(name='quantities',passed=e.quantities_passed,observed=str(e.quantities_passed),requirement='quantities generated'),
            PilotCheck(name='workspace',passed=e.persistence_passed,observed=str(e.persistence_passed),requirement='project save/reopen passes'),
            PilotCheck(name='recovery',passed=e.recovery_passed,observed=str(e.recovery_passed),requirement='crash recovery passes'),
            PilotCheck(name='desktop',passed=e.desktop_smoke_passed,observed=str(e.desktop_smoke_passed),requirement='desktop/local app smoke passes'),
            PilotCheck(name='license',passed=e.license_validation_passed,observed=str(e.license_validation_passed),requirement='customer license verifies offline'),
            PilotCheck(name='scale',passed=e.real_element_count>=self.min_real_elements,observed=str(e.real_element_count),requirement=f'>={self.min_real_elements} real CBIM elements'),
        ]
        ready=all(c.passed for c in checks)
        return PilotGateResult(pilot_ready=ready,status='commercial_pilot_ready' if ready else 'commercial_pilot_blocked',checks=checks,blockers=[c.name for c in checks if not c.passed])
