from __future__ import annotations
from collections import Counter
from statistics import fmean
from cbim_sdk import CBIMProject
from ..connectivity import MEPConnectivityEngine
from ..dwg.models import DWGImportDiagnostics
from ..mep.semantics import classify_layer_role,classify_mep_entity,is_annotation_entity
from ..mep.evidence import MepEvidenceEngine
from .models import Discipline,DisciplineValidationReport,ValidationCase

RELEVANT_TYPES: dict[Discipline,set[str]]={
    'architecture': {'wall','column','door','window','space','slab','stair','sanitary_terminal','furniture'},
    'structure': {'column','beam','slab','opening'},
    'hydraulic': {'pipe','fitting','equipment'},
    'fire': {'pipe','fitting','equipment'},
}

def _relevant_element(e, discipline:Discipline, project:CBIMProject)->bool:
    if e.type not in RELEVANT_TYPES[discipline]: return False
    if discipline in {'hydraulic','fire'}:
        sid=getattr(e,'system_id',None); systems={s.id:s for s in project.systems}; s=systems.get(sid)
        return bool(s and ((discipline=='hydraulic' and s.discipline=='plumbing') or (discipline=='fire' and s.discipline=='fire')))
    if discipline=='structure':
        if e.type in {'beam','slab','opening'}: return True
        return bool(e.properties.get('discipline')=='structure' or e.properties.get('structural') is True or e.type=='column')
    return True

class ProjectValidationEngine:
    def __init__(self): self.networks=MEPConnectivityEngine()
    def validate(self,case:ValidationCase,diagnostics:DWGImportDiagnostics,project:CBIMProject,*,canonical_entity_count:int,canonical_document=None,xref_missing:list[str]|None=None,ifc_exported:bool=False,ifc_sanity:dict|None=None)->DisciplineValidationReport:
        rel=[e for e in project.elements if _relevant_element(e,case.discipline,project)]
        all_counts=Counter(e.type for e in project.elements); rel_counts=Counter(e.type for e in rel)
        refs={r.entity_id for e in rel for r in e.source_refs}
        eligible_ids=None; unclassified_by_layer=Counter(); unmapped_by_layer=Counter(); context_by_layer=Counter(); layer_role_counts=Counter(); ignored=0; unknown_nonannotation_count=0; evidence_auto_create_count=0; evidence_candidate_count=0; evidence_rejected_count=0
        if canonical_document is not None and case.discipline in {'hydraulic','fire'}:
            evidence=MepEvidenceEngine().assess(canonical_document,case.discipline)
            evidence_auto_create_count=sum(1 for ev in evidence.values() if ev.decision=='auto_create')
            evidence_candidate_count=sum(1 for ev in evidence.values() if ev.decision=='candidate')
            evidence_rejected_count=sum(1 for ev in evidence.values() if ev.decision=='reject')
            eligible=[]
            for entity in canonical_document.entities:
                role=classify_layer_role(entity.layer); layer_role_counts[role]+=1
                ev=evidence.get(entity.id)
                if ev and ev.create:
                    eligible.append(entity)
                elif role in {'architecture','context'}:
                    context_by_layer[entity.layer]+=1
                elif role=='unknown' and not is_annotation_entity(entity):
                    unmapped_by_layer[entity.layer]+=1; unknown_nonannotation_count+=1
            eligible_ids={e.id for e in eligible}
            recognized_ids=refs & eligible_ids
            missing_ids=eligible_ids-recognized_ids
            by_id={e.id:e for e in eligible}
            for entity_id in missing_ids: unclassified_by_layer[by_id[entity_id].layer]+=1
            eligible_count=len(eligible_ids); recognized_count=len(recognized_ids)
            recognition_rate=(recognized_count/eligible_count) if eligible_count else 0.0
            ignored=max(0,canonical_entity_count-eligible_count)
        else:
            eligible_count=canonical_entity_count; recognized_count=len(refs)
            recognition_rate=(recognized_count/canonical_entity_count) if canonical_entity_count else 0.0
        confidences=[e.confidence for e in rel]; mean_conf=fmean(confidences) if confidences else 0.0; low=sum(1 for c in confidences if c<.70); pending=sum(1 for e in rel if e.review_state not in {'confirmed','edited'})
        networks=self.networks.build(project) if case.discipline in {'hydraulic','fire'} else []
        if case.discipline in {'hydraulic','fire'}:
            systems={s.id:s for s in project.systems}; target='plumbing' if case.discipline=='hydraulic' else 'fire'; networks=[n for n in networks if systems.get(n.system_id) and systems[n.system_id].discipline==target]
        expected_cov=None
        if case.expected_element_counts:
            denom=sum(case.expected_element_counts.values()); matched=sum(min(rel_counts.get(k,0),v) for k,v in case.expected_element_counts.items()); expected_cov=(matched/denom) if denom else 1.0
        import_cov=diagnostics.coverage; unsupported_rate=(diagnostics.unsupported_entities/diagnostics.total_entities) if diagnostics.total_entities else 0.0
        sanity=bool(ifc_sanity and ifc_sanity.get('has_step_header') and ifc_sanity.get('has_ifc4_schema') and ifc_sanity.get('has_end_marker') and int(ifc_sanity.get('entity_count',0))>0) if ifc_exported else False
        failed=[]; t=case.thresholds
        if import_cov<t.min_import_coverage: failed.append('import_coverage')
        if unsupported_rate>t.max_unsupported_rate: failed.append('unsupported_rate')
        if recognition_rate<t.min_recognition_rate: failed.append('recognition_rate')
        if mean_conf<t.min_mean_confidence: failed.append('mean_confidence')
        if not rel: failed.append('no_relevant_elements')
        if t.require_ifc_export and not (ifc_exported and sanity): failed.append('ifc_export')
        if t.require_network_for_mep and case.discipline in {'hydraulic','fire'} and rel_counts.get('pipe',0)>0 and not networks: failed.append('mep_connectivity')
        if diagnostics.errors: failed.append('import_errors')
        catalog_advisory_count=sum(1 for e in rel if int(e.properties.get('catalog_candidate_count',0) or 0)>0)
        catalog_assigned_count=sum(1 for e in rel if bool(e.properties.get('catalog_manufacturer')))
        z_direct=int(project.metadata.get('z_reconstruction_direct_resolved_count',0) or 0)
        z_propagated=int(project.metadata.get('z_reconstruction_propagated_count',0) or 0)
        z_vertical=int(project.metadata.get('z_reconstruction_vertical_resolved_count',0) or 0)
        z_unresolved=int(project.metadata.get('z_reconstruction_unresolved_count',0) or 0)
        z_conflicting=int(project.metadata.get('z_reconstruction_conflicting_count',0) or 0)
        def _has_nonzero_z(e):
            pts=[]
            if hasattr(e,'path'): pts=getattr(e,'path')
            elif hasattr(e,'position'): pts=[getattr(e,'position')]
            return any(abs(float(p.z))>1e-9 for p in pts)
        z_nonzero=sum(1 for e in rel if _has_nonzero_z(e))
        architecture_stair_count=int(project.metadata.get('architecture_stair_count',0) or 0)
        architecture_slab_count=int(project.metadata.get('architecture_slab_count',0) or 0)
        architecture_wall_count=int(project.metadata.get('architecture_wall_count',0) or 0)
        network_segmented_path_count=int(project.metadata.get('network_reconstruction_segmented_path_count',0) or 0)
        network_elbow_count=int(project.metadata.get('network_reconstruction_elbow_count',0) or 0)
        network_tee_count=int(project.metadata.get('network_reconstruction_tee_count',0) or 0)
        network_cross_count=int(project.metadata.get('network_reconstruction_cross_count',0) or 0)
        network_reducer_count=int(project.metadata.get('network_reconstruction_reducer_count',0) or 0)
        network_coupling_candidate_count=int(project.metadata.get('network_reconstruction_coupling_candidate_count',0) or 0)
        warnings=list(diagnostics.warnings)
        if xref_missing: warnings.append(f'{len(xref_missing)} XREF(s) missing')
        if unknown_nonannotation_count: warnings.append(f'{unknown_nonannotation_count} unknown non-annotation canonical entities remain outside known {case.discipline} semantics')
        return DisciplineValidationReport(case_name=case.name,discipline=case.discipline,source_path=case.source_path,evidence_kind=case.evidence_kind,provider=diagnostics.provider,dwg_version=diagnostics.version,import_coverage=import_cov,unsupported_rate=unsupported_rate,converted_entities=diagnostics.converted_entities,unsupported_entities=diagnostics.unsupported_entities,canonical_entities=canonical_entity_count,recognized_source_entities=recognized_count,eligible_source_entities=eligible_count,ignored_source_entities=ignored,unclassified_eligible_count=sum(unclassified_by_layer.values()),unclassified_by_layer=dict(unclassified_by_layer.most_common()),unmapped_by_layer=dict(unmapped_by_layer.most_common()),layer_role_counts=dict(layer_role_counts),context_by_layer=dict(context_by_layer.most_common()),unknown_nonannotation_count=unknown_nonannotation_count,catalog_advisory_count=catalog_advisory_count,catalog_assigned_count=catalog_assigned_count,evidence_auto_create_count=evidence_auto_create_count,evidence_candidate_count=evidence_candidate_count,evidence_rejected_count=evidence_rejected_count,z_direct_resolved_count=z_direct,z_propagated_count=z_propagated,z_vertical_resolved_count=z_vertical,z_unresolved_count=z_unresolved,z_conflicting_count=z_conflicting,z_nonzero_element_count=z_nonzero,architecture_stair_count=architecture_stair_count,architecture_slab_count=architecture_slab_count,architecture_wall_count=architecture_wall_count,network_segmented_path_count=network_segmented_path_count,network_elbow_count=network_elbow_count,network_tee_count=network_tee_count,network_cross_count=network_cross_count,network_reducer_count=network_reducer_count,network_coupling_candidate_count=network_coupling_candidate_count,recognition_rate=min(recognition_rate,1.0),project_elements=len(project.elements),relevant_elements=len(rel),element_counts=dict(sorted(all_counts.items())),relevant_element_counts=dict(sorted(rel_counts.items())),expected_element_counts=case.expected_element_counts,expected_count_coverage=expected_cov,mean_confidence=mean_conf,low_confidence_count=low,review_pending_count=pending,network_count=len(networks),xref_missing=xref_missing or [],ifc_exported=ifc_exported,ifc_sanity_passed=sanity,warnings=warnings,errors=diagnostics.errors,passed=not failed,failed_criteria=failed)
