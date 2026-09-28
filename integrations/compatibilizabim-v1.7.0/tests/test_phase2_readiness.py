from __future__ import annotations

from pathlib import Path

from compatibilizabim.budget import BudgetEngine, assess_phase2_readiness, pricebook_from_json
from compatibilizabim.sinapi import SinapiDatabase, SinapiImporter, SinapiService


def _book():
    return pricebook_from_json({
        "schema_version": 1,
        "currency": "BRL",
        "bdi_percent": 20,
        "source": "SINAPI",
        "reference_date": "2026-07/SP",
        "compositions": [{
            "code": "SINAPI-103328", "description": "Alvenaria", "unit": "m2",
            "components": [{"code": "SINAPI-103328", "description": "Alvenaria", "category": "direct", "unit": "m2", "coefficient": 1, "unit_cost": 84.0}],
        }],
        "mappings": [{"composition_code": "SINAPI-103328", "ifc_class": "IfcWall", "quantity_kind": "area", "quantity_name_contains": "NetArea"}],
    })


def test_phase2_readiness_reports_coverage_and_blocks_incomplete_budget():
    quantities = {"groups": [
        {"discipline": "Architecture", "source": "ifc_qto", "storey": "T", "ifc_class": "IfcWall", "type_name": "14cm", "material": None, "quantity_name": "NetArea", "kind": "area", "unit": "m2", "value": 100, "element_count": 10},
        {"discipline": "MEP", "source": "geometry_fallback", "storey": "T", "ifc_class": "IfcPipeSegment", "type_name": None, "material": None, "quantity_name": "Length", "kind": "length", "unit": "m", "value": 20, "element_count": 4},
    ]}
    budget = BudgetEngine().calculate(quantities, _book())
    ready = assess_phase2_readiness(quantities, budget, provenance={
        "source_provider": "CAIXA", "source_sha256": "abc", "source_url": "https://www.caixa.gov.br/file.zip", "competence": "2026-07", "uf": "SP"
    })
    assert ready["coverage_percent"] == 50.0
    assert ready["element_coverage_percent"] == round(10 / 14 * 100, 2)
    assert ready["unmatched_group_count"] == 1
    assert ready["geometry_fallback_group_count"] == 1
    assert ready["provenance_complete"] is True
    assert ready["ready_for_reference_budget"] is False
    assert ready["warnings"]


def test_phase2_readiness_is_ready_when_all_groups_are_priced_and_provenance_is_complete():
    quantities = {"groups": [
        {"discipline": "Architecture", "source": "ifc_qto", "storey": "T", "ifc_class": "IfcWall", "type_name": "14cm", "material": None, "quantity_name": "NetArea", "kind": "area", "unit": "m2", "value": 100, "element_count": 10},
    ]}
    budget = BudgetEngine().calculate(quantities, _book())
    ready = assess_phase2_readiness(quantities, budget, provenance={
        "source_provider": "CAIXA", "source_sha256": "abc", "source_url": "https://www.caixa.gov.br/file.zip", "competence": "2026-07", "uf": "SP"
    })
    assert ready["coverage_percent"] == 100.0
    assert ready["ready_for_reference_budget"] is True
    assert ready["warnings"] == []
