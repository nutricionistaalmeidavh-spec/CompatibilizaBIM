from __future__ import annotations

from pathlib import Path


TEMPLATE = """ISO-10303-21;
HEADER;
FILE_DESCRIPTION(('ViewDefinition [CoordinationView]'),'2;1');
FILE_NAME('{filename}','2026-08-14T00:00:00',('CompatibilizaBIM'),('CompatibilizaBIM'),'CompatibilizaBIM PoC','CompatibilizaBIM','');
FILE_SCHEMA(('IFC2X3'));
ENDSEC;
DATA;
#1=IFCPERSON($,$,'CompatibilizaBIM',$,$,$,$,$);
#2=IFCORGANIZATION($,'CompatibilizaBIM',$,$,$);
#3=IFCPERSONANDORGANIZATION(#1,#2,$);
#4=IFCAPPLICATION(#2,'0.2.0','CompatibilizaBIM','compatibilizabim');
#5=IFCOWNERHISTORY(#3,#4,$,.ADDED.,$,#3,#4,0);
#7=IFCCARTESIANPOINT((0.0,0.0,0.0));
#8=IFCAXIS2PLACEMENT3D(#7,$,$);
#9=IFCGEOMETRICREPRESENTATIONCONTEXT('Model','Model',3,1.0E-8,#8,$);
#10=IFCSIUNIT(*,.LENGTHUNIT.,.MILLI.,.METRE.);
#11=IFCSIUNIT(*,.AREAUNIT.,.MILLI.,.SQUARE_METRE.);
#12=IFCSIUNIT(*,.VOLUMEUNIT.,.MILLI.,.CUBIC_METRE.);
#13=IFCSIUNIT(*,.PLANEANGLEUNIT.,$,.RADIAN.);
#14=IFCUNITASSIGNMENT((#10,#11,#12,#13));
#15=IFCPROJECT('3M8uv5e1PCnu6lJ1G$7r5n',#5,'Synthetic Clash Project',$,$,$,$,(#9),#14);
#16=IFCSITE('1_CIr7zc1D6OXv62_qHF7A',#5,'Synthetic Site',$,$,$,$,$,.ELEMENT.,$,$,$,$,$);
#17=IFCLOCALPLACEMENT($,#8);
#30=IFCCARTESIANPOINT(({x_mm:.1f},0.0,0.0));
#31=IFCAXIS2PLACEMENT3D(#30,$,$);
#18=IFCLOCALPLACEMENT(#17,#31);
#19=IFCCARTESIANPOINT((0.0,0.0));
#20=IFCAXIS2PLACEMENT2D(#19,$);
#21=IFCCIRCLEPROFILEDEF(.AREA.,$,#20,400.0);
#22=IFCDIRECTION((0.0,1.0,0.0));
#23=IFCAXIS1PLACEMENT(#7,#22);
#24=IFCREVOLVEDAREASOLID(#21,#8,#23,3.141592653589793);
#25=IFCSHAPEREPRESENTATION(#9,'Body','SweptSolid',(#24));
#26=IFCPRODUCTDEFINITIONSHAPE($,$,(#25));
#27=IFCPROXY('{guid}',#5,'{name}',$,$,#18,#26,.PRODUCT.,$);
#28=IFCRELCONTAINEDINSPATIALSTRUCTURE('{containment_guid}',#5,'Site contains synthetic sphere',$,(#27),#16);
#29=IFCRELAGGREGATES('32lxp2EoH3aAt0ZI54g63R',#5,'Project contains site',$,#15,(#16));
ENDSEC;
END-ISO-10303-21;
"""


def write_sample(path: Path, *, x_mm: float, guid: str, containment_guid: str, name: str) -> None:
    path.write_text(
        TEMPLATE.format(
            filename=path.name,
            x_mm=x_mm,
            guid=guid,
            containment_guid=containment_guid,
            name=name,
        ),
        encoding="utf-8",
    )


def main() -> None:
    root = Path(__file__).resolve().parents[1] / "samples" / "synthetic"
    root.mkdir(parents=True, exist_ok=True)
    write_sample(
        root / "sphere_a.ifc",
        x_mm=0.0,
        guid="2v19J1oyzAnfRpOOp0Vynl",
        containment_guid="25D$dAXGL3AOHiH_WcCE9Z",
        name="Sphere A",
    )
    write_sample(
        root / "sphere_b_overlap.ifc",
        x_mm=600.0,
        guid="1Q0Kz9B0T8wP4jQWqfE3xA",
        containment_guid="3FlMv8M0P8QeAiH2bY8KqP",
        name="Sphere B Overlap",
    )
    write_sample(
        root / "sphere_b_clear.ifc",
        x_mm=1000.0,
        guid="0WlDc7EJbA9RZk5f3MQ2uV",
        containment_guid="1Kd9VY7yG6H1wT2cR8eB0M",
        name="Sphere B Clear",
    )


if __name__ == "__main__":
    main()
