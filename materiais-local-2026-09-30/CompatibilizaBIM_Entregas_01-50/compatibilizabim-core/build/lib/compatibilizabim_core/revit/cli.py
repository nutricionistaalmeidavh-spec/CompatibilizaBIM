from __future__ import annotations

import argparse
import json
from pathlib import Path

from cbim_sdk import CBIMProject

from ..dwg import ACadSharpProvider, DWGImporter, DWGToCBIMPipeline
from .compiler import RevitBuildPlanCompiler
from .hydraulic import RevitHydraulicRefiner
from .library import LibraryManifest, RevitLibraryResolver
from .models import RevitBuildPlan


def _write_model(model, path: Path) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(model.model_dump_json(indent=2, exclude_none=True), encoding="utf-8")
    return path


def compile_cbim_file(cbim_path: str | Path, output: str | Path, *, revit_version: int = 2027, preferred_manufacturer: str | None = None) -> RevitBuildPlan:
    project = CBIMProject.model_validate_json(Path(cbim_path).read_text(encoding="utf-8"))
    plan = RevitBuildPlanCompiler(revit_version=revit_version, preferred_manufacturer=preferred_manufacturer).compile(project)
    _write_model(plan, Path(output))
    return plan


def resolve_library_file(plan_path: str | Path, manifest_path: str | Path, output: str | Path) -> RevitBuildPlan:
    plan = RevitBuildPlan.model_validate_json(Path(plan_path).read_text(encoding="utf-8"))
    manifest = LibraryManifest.model_validate_json(Path(manifest_path).read_text(encoding="utf-8"))
    resolved = RevitLibraryResolver(manifest).resolve_plan(plan)
    _write_model(resolved, Path(output))
    return resolved


def refine_hydraulic_file(plan_path: str | Path, output: str | Path, *, near_miss_tolerance_m: float = 0.01) -> RevitBuildPlan:
    plan = RevitBuildPlan.model_validate_json(Path(plan_path).read_text(encoding="utf-8"))
    refined, _ = RevitHydraulicRefiner(near_miss_tolerance_m=near_miss_tolerance_m).refine(plan)
    _write_model(refined, Path(output))
    return refined


def _discipline_kwargs(discipline: str, project_datum_elevation_m: float | None = None) -> dict:
    if discipline == "architecture":
        return {"include_hydraulic": False, "include_fire": False}
    if discipline == "structure":
        return {"include_hydraulic": False, "include_fire": False}
    if discipline == "hydraulic":
        return {"include_hydraulic": True, "include_fire": False, "project_datum_elevation_m": project_datum_elevation_m}
    if discipline == "fire":
        return {"include_hydraulic": False, "include_fire": True, "project_datum_elevation_m": project_datum_elevation_m}
    return {"include_hydraulic": True, "include_fire": True, "project_datum_elevation_m": project_datum_elevation_m}


def analyze_dwg_with_importer(
    source: str | Path,
    *,
    output_dir: str | Path,
    importer,
    discipline: str = "all",
    project_name: str | None = None,
    revit_version: int = 2027,
    preferred_manufacturer: str | None = None,
    project_datum_elevation_m: float | None = None,
    resolve_xrefs: bool = True,
    hydraulic_refine: bool = True,
    library_manifest: LibraryManifest | None = None,
    progress=None,
) -> dict[str, str | None]:
    source = Path(source)
    out = Path(output_dir)
    out.mkdir(parents=True, exist_ok=True)
    result = DWGToCBIMPipeline(importer).run(
        source,
        resolve_xrefs=resolve_xrefs,
        export_ifc=None,
        project_name=project_name or source.stem,
        preferred_manufacturer=preferred_manufacturer,
        progress=progress,
        **_discipline_kwargs(discipline, project_datum_elevation_m),
    )
    cbim_path = out / f"{source.stem}.cbim.json"
    _write_model(result.project, cbim_path)
    plan = RevitBuildPlanCompiler(revit_version=revit_version, preferred_manufacturer=preferred_manufacturer).compile(result.project)
    if hydraulic_refine and discipline in ("hydraulic", "fire", "all"):
        plan, _ = RevitHydraulicRefiner().refine(plan)
    if library_manifest is not None:
        plan = RevitLibraryResolver(library_manifest).resolve_plan(plan)
    plan_path = out / f"{source.stem}.revit-plan.json"
    _write_model(plan, plan_path)
    diagnostics_path = out / f"{source.stem}.revit-diagnostics.json"
    diagnostics_path.write_text(json.dumps([d.model_dump(mode="json") for d in plan.diagnostics], indent=2, ensure_ascii=False), encoding="utf-8")
    return {
        "cbim_path": str(cbim_path),
        "revit_plan_path": str(plan_path),
        "diagnostics_path": str(diagnostics_path),
        "ifc_path": None,
    }


def parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="cbim-revit", description="CBIM Core bridge for native Revit 2027 authoring plans.")
    sub = p.add_subparsers(dest="command", required=True)

    c = sub.add_parser("compile", help="Compile a CBIM project JSON into a Revit native build plan")
    c.add_argument("--cbim", type=Path, required=True)
    c.add_argument("--output", type=Path, required=True)
    c.add_argument("--revit-version", type=int, default=2027)
    c.add_argument("--preferred-manufacturer")

    r = sub.add_parser("resolve-library", help="Resolve family queries against a local Revit Library manifest")
    r.add_argument("--plan", type=Path, required=True)
    r.add_argument("--manifest", type=Path, required=True)
    r.add_argument("--output", type=Path, required=True)

    h = sub.add_parser("refine-hydraulic", help="Add hydraulic native-fitting requests and diagnostics to a Revit plan")
    h.add_argument("--plan", type=Path, required=True)
    h.add_argument("--output", type=Path, required=True)
    h.add_argument("--near-miss-tolerance-m", type=float, default=0.01)

    a = sub.add_parser("analyze-dwg", help="Analyze DWG through ACadSharp -> CBIM and emit a native Revit build plan without IFC")
    a.add_argument("--dwg", type=Path, required=True)
    a.add_argument("--output", type=Path, required=True)
    a.add_argument("--discipline", choices=("all", "architecture", "structure", "hydraulic", "fire"), default="all")
    a.add_argument("--project-name")
    a.add_argument("--bridge-exe", type=Path)
    a.add_argument("--bridge-project", type=Path)
    a.add_argument("--revit-version", type=int, default=2027)
    a.add_argument("--preferred-manufacturer")
    a.add_argument("--project-datum-elevation-m", type=float)
    a.add_argument("--library-manifest", type=Path)
    a.add_argument("--no-xref", action="store_true")
    a.add_argument("--no-hydraulic-refine", action="store_true")
    return p


def main(argv=None) -> int:
    args = parser().parse_args(argv)
    if args.command == "compile":
        compile_cbim_file(args.cbim, args.output, revit_version=args.revit_version, preferred_manufacturer=args.preferred_manufacturer)
        return 0
    if args.command == "resolve-library":
        resolve_library_file(args.plan, args.manifest, args.output)
        return 0
    if args.command == "refine-hydraulic":
        refine_hydraulic_file(args.plan, args.output, near_miss_tolerance_m=args.near_miss_tolerance_m)
        return 0
    if args.command == "analyze-dwg":
        provider = ACadSharpProvider(bridge_executable=args.bridge_exe, bridge_project=args.bridge_project)
        if not provider.available():
            raise SystemExit("ACadSharp bridge unavailable. Build the included Revit package bridge or pass --bridge-exe/--bridge-project.")
        manifest = None
        if args.library_manifest:
            manifest = LibraryManifest.model_validate_json(args.library_manifest.read_text(encoding="utf-8"))
        result = analyze_dwg_with_importer(
            args.dwg,
            output_dir=args.output,
            importer=DWGImporter(provider),
            discipline=args.discipline,
            project_name=args.project_name,
            revit_version=args.revit_version,
            preferred_manufacturer=args.preferred_manufacturer,
            project_datum_elevation_m=args.project_datum_elevation_m,
            resolve_xrefs=not args.no_xref,
            hydraulic_refine=not args.no_hydraulic_refine,
            library_manifest=manifest,
        )
        print(json.dumps(result, indent=2, ensure_ascii=False))
        return 0
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
