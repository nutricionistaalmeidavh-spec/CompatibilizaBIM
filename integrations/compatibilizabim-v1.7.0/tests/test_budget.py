from compatibilizabim.budget import BudgetEngine, pricebook_from_json


def _book():
    return pricebook_from_json({
        "schema_version":1,"currency":"BRL","bdi_percent":20,"source":"manual",
        "compositions":[
            {"code":"ALV","description":"Alvenaria","unit":"m2","waste_percent":10,"components":[
                {"code":"MAT","description":"Material","category":"material","unit":"m2","coefficient":1,"unit_cost":40},
                {"code":"MO","description":"Mão de obra","category":"labor","unit":"h","coefficient":0.5,"unit_cost":30}
            ]},
            {"code":"CONC","description":"Concreto","unit":"m3","components":[{"code":"C","description":"Concreto","category":"material","unit":"m3","coefficient":1,"unit_cost":500}]}
        ],
        "mappings":[
            {"composition_code":"ALV","ifc_class":"IfcWall","quantity_kind":"area"},
            {"composition_code":"CONC","ifc_class":"IfcSlab","quantity_kind":"volume"}
        ]
    })


def test_budget_uses_composition_waste_bdi_and_preserves_storey():
    q={"groups":[{"discipline":"Architecture","source":"ifc_qto","storey":"Térreo","ifc_class":"IfcWall","type_name":"14cm","material":"Cerâmica","quantity_name":"NetArea","kind":"area","unit":"m2","value":100,"element_count":10}]}
    report=BudgetEngine().calculate(q,_book())
    line=report["lines"][0]
    assert line["base_unit_cost"] == 55
    assert round(line["final_unit_cost"],2) == 72.6
    assert round(line["total_cost"],2) == 7260
    assert line["storey"] == "Térreo"
    assert line["abc_class"] == "A"


def test_budget_reports_unmatched_quantities_instead_of_guessing():
    q={"groups":[{"discipline":"MEP","source":"ifc_qto","storey":None,"ifc_class":"IfcPipeSegment","type_name":None,"material":None,"quantity_name":"Length","kind":"length","unit":"m","value":50,"element_count":5}]}
    report=BudgetEngine().calculate(q,_book())
    assert report["matched_group_count"] == 0
    assert report["unmatched_group_count"] == 1
    assert report["total_cost"] == 0


def test_more_specific_mapping_wins():
    book=pricebook_from_json({"compositions":[
        {"code":"GEN","description":"G","unit":"m2","components":[{"code":"x","description":"x","category":"m","unit":"m2","coefficient":1,"unit_cost":1}]},
        {"code":"SPEC","description":"S","unit":"m2","components":[{"code":"x","description":"x","category":"m","unit":"m2","coefficient":1,"unit_cost":2}]}
    ],"mappings":[
        {"composition_code":"GEN","ifc_class":"IfcWall","quantity_kind":"area"},
        {"composition_code":"SPEC","ifc_class":"IfcWall","quantity_kind":"area","type_contains":"14cm"}
    ]})
    q={"groups":[{"discipline":"A","source":"ifc_qto","storey":None,"ifc_class":"IfcWall","type_name":"Parede 14cm","material":None,"quantity_name":"Area","kind":"area","unit":"m2","value":2,"element_count":1}]}
    assert BudgetEngine().calculate(q,book)["lines"][0]["composition_code"] == "SPEC"


def test_budget_does_not_price_geometry_fallback_without_explicit_permission():
    q={"groups":[{"discipline":"Architecture","source":"geometry_fallback","storey":None,"ifc_class":"IfcWall","type_name":None,"material":None,"quantity_name":"SurfaceArea","kind":"area","unit":"m2","value":10,"element_count":1}]}
    report=BudgetEngine().calculate(q,_book())
    assert report["matched_group_count"] == 0


def test_budget_refuses_ambiguous_area_when_mapping_does_not_choose_net_or_gross():
    q={"groups":[
        {"discipline":"Architecture","source":"ifc_qto","storey":"T","ifc_class":"IfcWall","type_name":"14cm","material":None,"quantity_name":"NetArea","kind":"area","unit":"m2","value":10,"element_count":1},
        {"discipline":"Architecture","source":"ifc_qto","storey":"T","ifc_class":"IfcWall","type_name":"14cm","material":None,"quantity_name":"GrossArea","kind":"area","unit":"m2","value":12,"element_count":1}
    ]}
    report=BudgetEngine().calculate(q,_book())
    assert report["matched_group_count"] == 0
    assert report["unmatched_group_count"] == 2


def test_budget_pdf_is_generated(tmp_path):
    from compatibilizabim.budget import write_budget_pdf
    q={"groups":[{"discipline":"Architecture","source":"ifc_qto","storey":"Térreo","ifc_class":"IfcWall","type_name":"14cm","material":None,"quantity_name":"NetArea","kind":"area","unit":"m2","value":10,"element_count":1}]}
    report=BudgetEngine().calculate(q,_book())
    out=tmp_path/'budget.pdf'; write_budget_pdf(out,report)
    assert out.read_bytes().startswith(b'%PDF')
