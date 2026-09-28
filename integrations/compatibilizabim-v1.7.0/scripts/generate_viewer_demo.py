from __future__ import annotations

import argparse
from pathlib import Path

from compatibilizabim.models import ClashResult
from compatibilizabim.rules import RuleClash
from compatibilizabim.viewer import MeshElement, ViewerSession
from compatibilizabim.viewer_html import write_viewer_html


def _box_vertices(x0: float, y0: float, z0: float, x1: float, y1: float, z1: float) -> tuple[float, ...]:
    return (
        x0,y0,z0, x1,y0,z0, x1,y1,z0, x0,y1,z0,
        x0,y0,z1, x1,y0,z1, x1,y1,z1, x0,y1,z1,
    )


def _box_triangles() -> tuple[int, ...]:
    return (
        0,1,2, 0,2,3,
        4,6,5, 4,7,6,
        0,4,5, 0,5,1,
        1,5,6, 1,6,2,
        2,6,7, 2,7,3,
        3,7,4, 3,4,0,
    )


def build_demo_session() -> ViewerSession:
    beam = MeshElement(
        global_id="DEMO-BEAM",
        ifc_class="IfcBeam",
        name="Viga V-12",
        discipline="Structure",
        source_file="estrutura-demo.ifc",
        vertices=_box_vertices(-3.0, -0.55, -0.55, 3.0, 0.55, 0.55),
        triangles=_box_triangles(),
    )
    pipe = MeshElement(
        global_id="DEMO-PIPE",
        ifc_class="IfcPipeSegment",
        name="Tubulação H-203",
        discipline="MEP",
        source_file="mep-demo.ifc",
        vertices=_box_vertices(-0.35, -2.5, -0.35, 0.35, 2.5, 0.35),
        triangles=_box_triangles(),
    )
    clash = RuleClash(
        rule_id="demo-pipe-beam",
        rule_name="Tubulação x Viga",
        severity="critical",
        clash=ClashResult(
            index=1,
            mode="intersection",
            a_global_id="DEMO-PIPE",
            b_global_id="DEMO-BEAM",
            a_ifc_class="IfcPipeSegment",
            b_ifc_class="IfcBeam",
            a_name="Tubulação H-203",
            b_name="Viga V-12",
            clash_type="pierce",
            p1=(0.0, 0.0, -0.35),
            p2=(0.0, 0.0, 0.35),
            point=(0.0, 0.0, 0.0),
            depth_m=0.70,
        ),
    )
    return ViewerSession.from_elements((beam, pipe), clashes=(clash,))


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Gera demo autocontido do visualizador CompatibilizaBIM")
    parser.add_argument("--out", type=Path, default=Path("viewer-demo.html"))
    args = parser.parse_args(argv)
    write_viewer_html(args.out, build_demo_session())
    print(f"Demo gerado: {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
