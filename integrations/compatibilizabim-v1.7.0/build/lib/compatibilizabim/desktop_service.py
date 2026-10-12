from __future__ import annotations

import json
from dataclasses import asdict
import tempfile
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Sequence

from .cache import ContentCache, cache_key
from .ifc_backend import IfcOpenShellBackend
from .jobs import JobContext, JobManager, JobRecord, JobStore
from .issues import IssueService, IssueStore
from .revisions import RevisionService, RevisionStore
from .preflight import PreflightEngine
from .quantities import QuantityEngine, quantity_report, write_quantity_csv, write_quantity_json
from .budget import BudgetEngine, PriceBookStore, assess_phase2_readiness, pricebook_from_json, pricebook_to_json, write_budget_csv, write_budget_json, write_budget_pdf
from .sinapi import LATEST_VERIFIED_SINAPI, OfficialSinapiDownloader, SinapiDatabase, SinapiImporter, SinapiService
from .reporting import write_preflight_json, write_rule_report_json
from .viewer import ViewerEngine, viewer_manifest
from .rules import RuleEngine, get_preset
from .viewer_html import write_viewer_manifest_html
from .workspace import Project, ProjectModel, ProjectStore
from .schedule import ScheduleService, ScheduleStore
from .simulation4d import Simulation4D
from .measurements import MeasurementService, MeasurementStore, measurement_summary, write_measurement_csv
from .measurement_financial import FinancialMeasurementEngine, write_financial_measurement_json, write_financial_measurement_csv, write_financial_measurement_pdf

PreflightRunner = Callable[[Sequence[Path], Path, float, JobContext], dict[str, Any]]
ViewerRunner = Callable[[Sequence[Path], int | None, JobContext], dict[str, Any]]
RulesRunner = Callable[[Path, Path, str, Path, JobContext], dict[str, Any]]
QuantitiesRunner = Callable[[Sequence[Path], Path, Path, bool, JobContext], dict[str, Any]]
BudgetRunner = Callable[[Path, Path, Path, Path, Path, JobContext], dict[str, Any]]


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


class DesktopService:
    def __init__(
        self,
        root: Path,
        *,
        preflight_runner: PreflightRunner | None = None,
        viewer_runner: ViewerRunner | None = None,
        rules_runner: RulesRunner | None = None,
        quantities_runner: QuantitiesRunner | None = None,
        budget_runner: BudgetRunner | None = None,
        sinapi_downloader: OfficialSinapiDownloader | None = None,
    ) -> None:
        self.root = Path(root).expanduser().resolve()
        self.projects = ProjectStore(self.root)
        self.preflight_runner = preflight_runner or self._default_preflight_runner
        self.viewer_runner = viewer_runner or self._default_viewer_runner
        self.rules_runner = rules_runner or self._default_rules_runner
        self.quantities_runner = quantities_runner or self._default_quantities_runner
        self.budget_runner = budget_runner or self._default_budget_runner
        self.sinapi_downloader = sinapi_downloader or OfficialSinapiDownloader()
        self._managers: dict[str, JobManager] = {}
        self._lock = threading.RLock()

    def create_project(self, name: str, *, obra_id: str | None = None) -> dict[str, Any]:
        project = self.projects.create_project(name, obra_id=obra_id)
        self._log(project, "project_created", name=project.name, obra_id=project.obra_id)
        return self._project_json(project)

    def list_projects(self) -> list[dict[str, Any]]:
        return [self._project_json(project) for project in self.projects.list_projects()]

    def get_project(self, project_id: str) -> dict[str, Any]:
        return self._project_json(self.projects.get_project(project_id))

    def import_model_bytes(
        self,
        project_id: str,
        filename: str,
        content: bytes,
        *,
        discipline: str | None = None,
    ) -> dict[str, Any]:
        project = self.projects.get_project(project_id)
        if not filename.lower().endswith(".ifc"):
            raise ValueError("O arquivo precisa ter extensão .ifc")
        if not _looks_like_ifc(content):
            self._log(project, "model_rejected", filename=filename, reason="invalid_ifc_header")
            raise ValueError("Arquivo IFC inválido: cabeçalho STEP/FILE_SCHEMA não encontrado")
        upload_dir = project.path / ".uploads"
        upload_dir.mkdir(exist_ok=True)
        with tempfile.NamedTemporaryFile(
            prefix="upload-", suffix=".ifc", dir=upload_dir, delete=False
        ) as handle:
            handle.write(content)
            temp_path = Path(handle.name)
        try:
            renamed = temp_path.with_name(filename.replace("/", "_").replace("\\", "_"))
            if renamed.exists():
                renamed.unlink()
            temp_path.replace(renamed)
            model = self.projects.add_model(project_id, renamed, discipline=discipline)
        finally:
            for candidate in (temp_path, locals().get("renamed")):
                if isinstance(candidate, Path):
                    candidate.unlink(missing_ok=True)
            try:
                upload_dir.rmdir()
            except OSError:
                pass
        self._log(project, "model_imported", model_id=model.model_id, filename=filename, sha256=model.sha256)
        return self._model_json(model)

    def start_preflight(self, project_id: str, *, alignment_tolerance_m: float = 5.0) -> dict[str, Any]:
        project = self.projects.get_project(project_id)
        if not project.models:
            raise ValueError("Importe pelo menos um IFC antes do preflight")
        model_paths = [Path(model.stored_path) for model in project.models]
        manager = self._manager(project)

        def handler(ctx: JobContext, payload: dict[str, Any]) -> dict[str, Any]:
            ctx.progress(5, "preparando modelos")
            out = project.path / "reports" / f"preflight-{ctx.job_id}.json"
            result = self.preflight_runner(model_paths, out, alignment_tolerance_m, ctx)
            ctx.check_cancelled()
            result = dict(result)
            result["report_path"] = str(out)
            self._log(project, "preflight_completed", job_id=ctx.job_id, report_path=str(out))
            return result

        record = manager.submit(
            "preflight",
            {"alignment_tolerance_m": alignment_tolerance_m, "models": [m.model_id for m in project.models]},
            handler,
        )
        self._log(project, "job_submitted", job_id=record.job_id, job_type="preflight")
        return self._job_json(record)

    def start_rules(
        self,
        project_id: str,
        model_a_id: str,
        model_b_id: str,
        *,
        preset: str = "mep-structure",
    ) -> dict[str, Any]:
        project = self.projects.get_project(project_id)
        by_id = {model.model_id: model for model in project.models}
        if model_a_id not in by_id or model_b_id not in by_id:
            raise ValueError("Selecione dois modelos IFC válidos")
        if model_a_id == model_b_id:
            raise ValueError("Modelo A e Modelo B devem ser diferentes")
        file_a = Path(by_id[model_a_id].stored_path)
        file_b = Path(by_id[model_b_id].stored_path)
        manager = self._manager(project)

        def handler(ctx: JobContext, payload: dict[str, Any]) -> dict[str, Any]:
            ctx.progress(5, "preparando regras")
            out = project.path / "reports" / f"rules-{ctx.job_id}.json"
            result = self.rules_runner(file_a, file_b, preset, out, ctx)
            ctx.check_cancelled()
            issue_summary = IssueService().import_rule_report(
                out, project.path / "issues.json", project_id=project.project_id, obra_id=project.obra_id
            )
            revision_id = f"REV-{ctx.job_id.replace('JOB-', '')[:12].upper()}"
            RevisionService().add_report(
                out, project.path / "revisions.json", revision_id=revision_id, label=f"{preset} · {ctx.job_id}"
            )
            result = dict(result)
            result["report_path"] = str(out)
            result["issues_created"] = issue_summary.created
            result["issues_existing"] = issue_summary.existing
            result["revision_id"] = revision_id
            self._log(
                project, "rules_completed", job_id=ctx.job_id, preset=preset, report_path=str(out),
                issues_created=issue_summary.created, revision_id=revision_id,
            )
            return result

        record = manager.submit(
            "rules",
            {"model_a_id": model_a_id, "model_b_id": model_b_id, "preset": preset},
            handler,
        )
        self._log(project, "job_submitted", job_id=record.job_id, job_type="rules")
        return self._job_json(record)

    def start_quantities(
        self, project_id: str, *, model_ids: Sequence[str] | None = None, geometry_fallback: bool = True
    ) -> dict[str, Any]:
        project = self.projects.get_project(project_id)
        selected = list(project.models)
        if model_ids:
            wanted = set(model_ids)
            selected = [m for m in selected if m.model_id in wanted]
            if len(selected) != len(wanted):
                raise ValueError("Um ou mais modelos selecionados não pertencem ao projeto")
        if not selected:
            raise ValueError("Importe ou selecione pelo menos um IFC")
        paths = [Path(m.stored_path) for m in selected]
        manager = self._manager(project)

        def handler(ctx: JobContext, payload: dict[str, Any]) -> dict[str, Any]:
            ctx.progress(5, "extraindo quantitativos")
            json_out = project.path / "reports" / f"quantities-{ctx.job_id}.json"
            csv_out = project.path / "reports" / f"quantities-{ctx.job_id}.csv"
            result = self.quantities_runner(paths, json_out, csv_out, geometry_fallback, ctx)
            ctx.check_cancelled()
            result = dict(result)
            result.update({"report_path": str(json_out), "csv_path": str(csv_out)})
            self._log(project, "quantities_completed", job_id=ctx.job_id, report_path=str(json_out))
            return result

        record = manager.submit(
            "quantities",
            {"models": [m.model_id for m in selected], "geometry_fallback": geometry_fallback},
            handler,
        )
        self._log(project, "job_submitted", job_id=record.job_id, job_type="quantities")
        return self._job_json(record)

    def get_pricebook(self, project_id: str) -> dict[str, Any]:
        project = self.projects.get_project(project_id)
        return pricebook_to_json(PriceBookStore(project.path / "costs" / "pricebook.json").load())

    def save_pricebook(self, project_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        project = self.projects.get_project(project_id)
        book = pricebook_from_json(payload)
        codes = [item.code for item in book.compositions]
        if not codes or any(not code for code in codes):
            raise ValueError("O catálogo precisa ter pelo menos uma composição com código")
        if len(codes) != len(set(codes)):
            raise ValueError("Códigos de composição duplicados")
        known = set(codes)
        if any(mapping.composition_code not in known for mapping in book.mappings):
            raise ValueError("Mapeamento referencia composição inexistente")
        PriceBookStore(project.path / "costs" / "pricebook.json").save(book)
        self._log(project, "pricebook_saved", composition_count=len(book.compositions), mapping_count=len(book.mappings))
        return pricebook_to_json(book)

    def start_budget(self, project_id: str, *, quantities_report: str | None = None) -> dict[str, Any]:
        project = self.projects.get_project(project_id)
        book_path = project.path / "costs" / "pricebook.json"
        book = PriceBookStore(book_path).load()
        if not book.compositions or not book.mappings:
            raise ValueError("Cadastre composições e mapeamentos antes de gerar o orçamento")
        if quantities_report:
            qpath = (project.path / "reports" / Path(quantities_report).name).resolve()
        else:
            candidates = sorted((project.path / "reports").glob("quantities-JOB-*.json"), key=lambda p: p.stat().st_mtime)
            if not candidates:
                raise ValueError("Execute Quantitativos BIM antes do orçamento 5D")
            qpath = candidates[-1]
        if qpath.parent != (project.path / "reports").resolve() or not qpath.is_file():
            raise ValueError("Relatório de quantitativos inválido")
        manager = self._manager(project)

        def handler(ctx: JobContext, payload: dict[str, Any]) -> dict[str, Any]:
            ctx.progress(10, "aplicando composições")
            json_out = project.path / "reports" / f"budget-{ctx.job_id}.json"
            csv_out = project.path / "reports" / f"budget-{ctx.job_id}.csv"
            pdf_out = project.path / "reports" / f"budget-{ctx.job_id}.pdf"
            result = self.budget_runner(qpath, book_path, json_out, csv_out, pdf_out, ctx)
            ctx.check_cancelled()
            result = dict(result)
            result.update({"report_path": str(json_out), "csv_path": str(csv_out), "pdf_path": str(pdf_out)})
            self._log(project, "budget_completed", job_id=ctx.job_id, total_cost=result.get("total_cost"))
            return result

        record = manager.submit("budget", {"quantities_report": qpath.name}, handler)
        self._log(project, "job_submitted", job_id=record.job_id, job_type="budget")
        return self._job_json(record)

    def start_official_sinapi_update(
        self, project_id: str, *, competence: str = LATEST_VERIFIED_SINAPI.competence
    ) -> dict[str, Any]:
        project = self.projects.get_project(project_id)
        manager = self._manager(project)

        def handler(ctx: JobContext, payload: dict[str, Any]) -> dict[str, Any]:
            ctx.progress(5, "baixando publicação oficial CAIXA")
            source_dir = project.path / "costs" / "sinapi_sources"
            downloaded = self.sinapi_downloader.download(competence, source_dir)
            ctx.check_cancelled()
            ctx.progress(65, "validando e importando XLSX SINAPI")
            db = SinapiDatabase(project.path / "costs" / "sinapi.sqlite3")
            published_on = LATEST_VERIFIED_SINAPI.published_on if competence == LATEST_VERIFIED_SINAPI.competence else None
            release = SinapiImporter(db).import_archive(
                downloaded.path, competence=competence, source_url=downloaded.source_url,
                source_provider="CAIXA", published_on=published_on, fetched_at=downloaded.fetched_at,
            )
            result = asdict(release) | {
                "download_path": str(downloaded.path),
                "xlsx_members": list(downloaded.xlsx_members),
            }
            self._log(
                project, "sinapi_official_updated", release_id=release.release_id, competence=competence,
                source_url=downloaded.source_url, source_sha256=release.source_sha256,
            )
            return result

        record = manager.submit("sinapi_update", {"competence": competence}, handler)
        self._log(project, "job_submitted", job_id=record.job_id, job_type="sinapi_update")
        return self._job_json(record)

    def get_phase2_readiness(self, project_id: str) -> dict[str, Any]:
        project = self.projects.get_project(project_id)
        reports = project.path / "reports"
        quantities_files = sorted(reports.glob("quantities-*.json"), key=lambda p: p.stat().st_mtime)
        budget_files = sorted(reports.glob("budget-*.json"), key=lambda p: p.stat().st_mtime)
        if not quantities_files:
            raise ValueError("Execute Quantitativos BIM antes de validar a Fase 2")
        if not budget_files:
            raise ValueError("Gere o Orçamento 5D antes de validar a Fase 2")
        quantities = json.loads(quantities_files[-1].read_text(encoding="utf-8"))
        budget = json.loads(budget_files[-1].read_text(encoding="utf-8"))
        selection = self.get_sinapi_selection(project_id)
        release_id = selection.get("release_id")
        release = None
        if release_id:
            db = SinapiDatabase(project.path / "costs" / "sinapi.sqlite3")
            release = next((row for row in db.list_releases() if row.release_id == release_id), None)
        provenance = {
            "source_provider": release.source_provider if release else None,
            "source_sha256": release.source_sha256 if release else None,
            "source_url": release.source_url if release else None,
            "published_on": release.published_on if release else None,
            "fetched_at": release.fetched_at if release else None,
            "competence": release.competence if release else None,
            "uf": selection.get("uf"),
            "release_id": release_id,
        }
        result = assess_phase2_readiness(quantities, budget, provenance=provenance)
        result.update({"quantities_report": quantities_files[-1].name, "budget_report": budget_files[-1].name})
        return result

    def import_sinapi_bytes(self, project_id: str, filename: str, content: bytes, *, competence: str) -> dict[str, Any]:
        project = self.projects.get_project(project_id)
        suffix = Path(filename).suffix.lower()
        if suffix not in {".zip", ".xlsx"}:
            raise ValueError("A base SINAPI precisa ser .zip ou .xlsx")
        if not content:
            raise ValueError("Arquivo SINAPI vazio")
        source_dir = project.path / "costs" / "sinapi_sources"
        source_dir.mkdir(parents=True, exist_ok=True)
        safe = Path(filename).name.replace("/", "_").replace("\\", "_")
        temp = source_dir / f".tmp-{safe}"
        temp.write_bytes(content)
        try:
            db = SinapiDatabase(project.path / "costs" / "sinapi.sqlite3")
            release = SinapiImporter(db).import_archive(temp, competence=competence)
            target = source_dir / f"{release.release_id}-{safe}"
            if not target.exists():
                temp.replace(target)
            else:
                temp.unlink(missing_ok=True)
        except Exception:
            temp.unlink(missing_ok=True)
            raise
        self._log(project, "sinapi_imported", release_id=release.release_id, competence=release.competence, source_sha256=release.source_sha256)
        return asdict(release)

    def list_sinapi_releases(self, project_id: str) -> list[dict[str, Any]]:
        project = self.projects.get_project(project_id)
        return SinapiService(SinapiDatabase(project.path / "costs" / "sinapi.sqlite3")).list_releases()

    def search_sinapi_compositions(self, project_id: str, release_id: str, *, uf: str, query: str, limit: int = 20) -> list[dict[str, Any]]:
        project = self.projects.get_project(project_id)
        return SinapiService(SinapiDatabase(project.path / "costs" / "sinapi.sqlite3")).search_compositions(release_id, uf=uf, query=query, limit=limit)

    def activate_sinapi_pricebook(self, project_id: str, release_id: str, *, uf: str, bdi_percent: float, mappings: Sequence[dict[str, Any]]) -> dict[str, Any]:
        project = self.projects.get_project(project_id)
        service = SinapiService(SinapiDatabase(project.path / "costs" / "sinapi.sqlite3"))
        book = service.build_pricebook(release_id, uf=uf, bdi_percent=bdi_percent, mappings=mappings)
        PriceBookStore(project.path / "costs" / "pricebook.json").save(book)
        selection = {"schema_version": 1, "release_id": release_id, "uf": uf.upper(), "bdi_percent": float(bdi_percent), "mappings": list(mappings), "activated_at": _utc_now()}
        sel_path = project.path / "costs" / "sinapi-selection.json"
        tmp = sel_path.with_name(f".{sel_path.name}.tmp")
        tmp.write_text(json.dumps(selection, ensure_ascii=False, indent=2), encoding="utf-8"); tmp.replace(sel_path)
        self._log(project, "sinapi_pricebook_activated", release_id=release_id, uf=uf.upper(), mapping_count=len(mappings))
        return pricebook_to_json(book)

    def get_sinapi_selection(self, project_id: str) -> dict[str, Any]:
        project = self.projects.get_project(project_id)
        path = project.path / "costs" / "sinapi-selection.json"
        if not path.is_file():
            return {"schema_version": 1, "release_id": None, "uf": "SP", "bdi_percent": 0.0, "mappings": []}
        payload = json.loads(path.read_text(encoding="utf-8"))
        return payload if isinstance(payload, dict) else {"schema_version": 1, "release_id": None, "uf": "SP", "bdi_percent": 0.0, "mappings": []}

    def suggest_sinapi_mappings(self, project_id: str, release_id: str, *, uf: str, limit_per_group: int = 3) -> list[dict[str, Any]]:
        project = self.projects.get_project(project_id)
        candidates = sorted((project.path / "reports").glob("quantities-*.json"), key=lambda p: p.stat().st_mtime)
        if not candidates:
            raise ValueError("Execute Quantitativos BIM antes de solicitar sugestões SINAPI")
        report = json.loads(candidates[-1].read_text(encoding="utf-8"))
        groups = report.get("groups") or []
        service = SinapiService(SinapiDatabase(project.path / "costs" / "sinapi.sqlite3"))
        suggestions = []
        for group in groups:
            if not isinstance(group, dict):
                continue
            query = " ".join(str(group.get(k) or "") for k in ("type_name", "material", "quantity_name", "ifc_class")).strip()
            hits = service.search_compositions(release_id, uf=uf, query=query, limit=limit_per_group)
            suggestions.append({"group": group, "query": query, "candidates": hits})
        return suggestions

    def compare_sinapi_releases(self, project_id: str, old_release_id: str, new_release_id: str, *, uf: str, codes: Sequence[str] | None = None) -> dict[str, Any]:
        project = self.projects.get_project(project_id)
        return SinapiService(SinapiDatabase(project.path / "costs" / "sinapi.sqlite3")).compare_releases(old_release_id, new_release_id, uf=uf, codes=codes)

    def compare_sinapi_budgets(self, project_id: str, old_release_id: str, new_release_id: str, *, uf: str, bdi_percent: float, mappings: Sequence[dict[str, Any]], quantities_report: str | None = None) -> dict[str, Any]:
        project = self.projects.get_project(project_id)
        if quantities_report:
            qpath = (project.path / "reports" / Path(quantities_report).name).resolve()
        else:
            candidates = sorted((project.path / "reports").glob("quantities-*.json"), key=lambda p: p.stat().st_mtime)
            if not candidates:
                raise ValueError("Execute Quantitativos BIM antes de comparar competências SINAPI")
            qpath = candidates[-1]
        if qpath.parent != (project.path / "reports").resolve() or not qpath.is_file():
            raise ValueError("Relatório de quantitativos inválido")
        quantities = json.loads(qpath.read_text(encoding="utf-8"))
        service = SinapiService(SinapiDatabase(project.path / "costs" / "sinapi.sqlite3"))
        old_book = service.build_pricebook(old_release_id, uf=uf, bdi_percent=bdi_percent, mappings=mappings)
        new_book = service.build_pricebook(new_release_id, uf=uf, bdi_percent=bdi_percent, mappings=mappings)
        old_report = BudgetEngine().calculate(quantities, old_book); new_report = BudgetEngine().calculate(quantities, new_book)
        old_total = float(old_report["total_cost"]); new_total = float(new_report["total_cost"]); variation = new_total - old_total
        pct = (variation / old_total * 100.0) if old_total else None
        return {"old_release_id": old_release_id, "new_release_id": new_release_id, "uf": uf.upper(), "old_total": old_total, "new_total": new_total, "variation": variation, "variation_percent": pct, "old_unmatched": old_report["unmatched_group_count"], "new_unmatched": new_report["unmatched_group_count"]}

    def start_viewer(self, project_id: str, *, max_elements: int | None = None) -> dict[str, Any]:
        project = self.projects.get_project(project_id)
        if not project.models:
            raise ValueError("Importe pelo menos um IFC antes de gerar o viewer")
        model_paths = [Path(model.stored_path) for model in project.models]
        source_hash = ":".join(model.sha256 for model in project.models)
        key = cache_key("viewer-manifest-v1", source_hash, {"max_elements": max_elements})
        cache = ContentCache(project.path / "cache")
        manager = self._manager(project)

        def handler(ctx: JobContext, payload: dict[str, Any]) -> dict[str, Any]:
            manifest = cache.get_json(key)
            cached = manifest is not None
            if manifest is None:
                ctx.progress(10, "extraindo geometria")
                manifest = self.viewer_runner(model_paths, max_elements, ctx)
                ctx.check_cancelled()
                cache.put_json(key, manifest)
            else:
                ctx.progress(80, "carregando cache geométrico")
            out = project.path / "reports" / f"viewer-{ctx.job_id}.html"
            write_viewer_manifest_html(out, manifest)
            self._log(project, "viewer_completed", job_id=ctx.job_id, cached=cached, viewer_path=str(out))
            return {"viewer_path": str(out), "cache_key": key, "cached": cached}

        record = manager.submit(
            "viewer",
            {"models": [m.model_id for m in project.models], "max_elements": max_elements},
            handler,
        )
        self._log(project, "job_submitted", job_id=record.job_id, job_type="viewer")
        return self._job_json(record)

    def list_issues(self, project_id: str) -> list[dict[str, Any]]:
        project = self.projects.get_project(project_id)
        return [asdict(issue) for issue in IssueStore(project.path / "issues.json").load()]

    def update_issue(self, project_id: str, issue_id: str, **fields: Any) -> dict[str, Any]:
        project = self.projects.get_project(project_id)
        allowed = {"status", "assignee", "due_date", "storey", "ignored_reason", "screenshot"}
        clean = {key: value for key, value in fields.items() if key in allowed}
        issue = IssueService().update_issue(project.path / "issues.json", issue_id, **clean)
        self._log(project, "issue_updated", issue_id=issue_id, status=issue.status)
        return asdict(issue)

    def add_issue_comment(self, project_id: str, issue_id: str, *, author: str, text: str) -> dict[str, Any]:
        project = self.projects.get_project(project_id)
        issue = IssueService().add_comment(project.path / "issues.json", issue_id, author=author, text=text)
        self._log(project, "issue_commented", issue_id=issue_id, author=author)
        return asdict(issue)

    def list_revisions(self, project_id: str) -> list[dict[str, Any]]:
        project = self.projects.get_project(project_id)
        return [asdict(snapshot) for snapshot in RevisionStore(project.path / "revisions.json").load()]

    def compare_revisions(self, project_id: str, base_revision: str, current_revision: str) -> dict[str, Any]:
        project = self.projects.get_project(project_id)
        comparison = RevisionService().compare(project.path / "revisions.json", base_revision, current_revision)
        return {
            "base_revision": comparison.base_revision,
            "current_revision": comparison.current_revision,
            "counts": {
                "new": comparison.new_count,
                "persistent": comparison.persistent_count,
                "resolved": comparison.resolved_count,
            },
            "new": [asdict(item) for item in comparison.new],
            "persistent": [asdict(item) for item in comparison.persistent],
            "resolved": [asdict(item) for item in comparison.resolved],
        }

    def _schedule_service(self, project_id: str) -> ScheduleService:
        project = self.projects.get_project(project_id)
        return ScheduleService(ScheduleStore(project.path / "schedule.json"))

    def list_schedule(self, project_id: str) -> list[dict[str, Any]]:
        return self._schedule_service(project_id).list_activities()

    def add_schedule_activity(self, project_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        service = self._schedule_service(project_id)
        activity = service.add_activity(
            str(payload.get("activity_id") or ""), str(payload.get("name") or ""),
            str(payload.get("start_date") or ""), str(payload.get("end_date") or ""),
            predecessors=payload.get("predecessors") or (), discipline=payload.get("discipline"),
            storey=payload.get("storey"), composition_code=payload.get("composition_code"),
            notes=payload.get("notes"),
        )
        project = self.projects.get_project(project_id)
        self._log(project, "schedule_activity_added", activity_id=activity.activity_id)
        return service.list_activities()[-1]

    def import_schedule_csv_bytes(self, project_id: str, filename: str, content: bytes) -> dict[str, Any]:
        if not filename.lower().endswith(".csv"):
            raise ValueError("O cronograma precisa ser CSV nesta versão")
        if not content:
            raise ValueError("Cronograma vazio")
        project = self.projects.get_project(project_id)
        tmp = project.path / ".schedule-import.csv"
        tmp.write_bytes(content)
        try:
            result = self._schedule_service(project_id).import_csv(tmp)
        finally:
            tmp.unlink(missing_ok=True)
        self._log(project, "schedule_imported", filename=Path(filename).name, imported=result.get("imported"))
        return result

    def link_schedule_elements(self, project_id: str, activity_id: str, guids: Sequence[str], *, replace_existing: bool = False) -> dict[str, Any]:
        activity = self._schedule_service(project_id).link_elements(activity_id, guids, replace_existing=replace_existing)
        project = self.projects.get_project(project_id)
        self._log(project, "schedule_elements_linked", activity_id=activity_id, guid_count=len(activity.linked_guids))
        return asdict(activity) | {"duration_days": activity.duration_days}

    def update_schedule_progress(self, project_id: str, activity_id: str, progress: float, *, actual_start: str | None = None, actual_finish: str | None = None, recorded_on: str | None = None) -> dict[str, Any]:
        activity = self._schedule_service(project_id).update_progress(
            activity_id, progress, actual_start=actual_start, actual_finish=actual_finish, recorded_on=recorded_on
        )
        project = self.projects.get_project(project_id)
        self._log(project, "schedule_progress_updated", activity_id=activity_id, progress=activity.actual_progress)
        return asdict(activity) | {"duration_days": activity.duration_days}

    def get_4d_simulation(self, project_id: str, on_date: str) -> dict[str, Any]:
        schedule = self._schedule_service(project_id).store.load()
        if not schedule.activities:
            raise ValueError("Cadastre ou importe atividades 4D antes de simular")
        return Simulation4D().build(schedule, on_date)

    def start_4d_viewer(self, project_id: str, *, max_elements: int | None = None) -> dict[str, Any]:
        project = self.projects.get_project(project_id)
        if not project.models:
            raise ValueError("Importe pelo menos um IFC antes do viewer 4D")
        schedule = self._schedule_service(project_id).store.load()
        if not schedule.activities:
            raise ValueError("Cadastre ou importe atividades 4D antes do viewer 4D")
        if not any(a.linked_guids for a in schedule.activities):
            raise ValueError("Associe elementos IFC a pelo menos uma atividade antes do viewer 4D")
        model_paths = [Path(model.stored_path) for model in project.models]
        source_hash = ":".join(model.sha256 for model in project.models)
        key = cache_key("viewer-manifest-v1", source_hash, {"max_elements": max_elements})
        cache = ContentCache(project.path / "cache")
        manager = self._manager(project)

        def handler(ctx: JobContext, payload: dict[str, Any]) -> dict[str, Any]:
            manifest = cache.get_json(key)
            cached = manifest is not None
            if manifest is None:
                ctx.progress(10, "extraindo geometria 4D")
                manifest = self.viewer_runner(model_paths, max_elements, ctx)
                ctx.check_cancelled(); cache.put_json(key, manifest)
            enriched = dict(manifest)
            enriched["timeline"] = Simulation4D().timeline(schedule)
            enriched["schedule_activity_count"] = len(schedule.activities)
            out = project.path / "reports" / f"viewer4d-{ctx.job_id}.html"
            write_viewer_manifest_html(out, enriched)
            self._log(project, "viewer4d_completed", job_id=ctx.job_id, cached=cached, viewer_path=str(out))
            return {"viewer_path": str(out), "cache_key": key, "cached": cached, "timeline_points": len(enriched["timeline"])}

        record = manager.submit("viewer4d", {"models": [m.model_id for m in project.models], "max_elements": max_elements}, handler)
        self._log(project, "job_submitted", job_id=record.job_id, job_type="viewer4d")
        return self._job_json(record)

    def _measurement_service(self, project_id: str) -> MeasurementService:
        project = self.projects.get_project(project_id)
        return MeasurementService(MeasurementStore(project.path / "measurements.json"))

    def list_measurements(self, project_id: str) -> dict[str, Any]:
        service = self._measurement_service(project_id)
        batches = service.store.load()
        return {"batches": service.list_batches(), "summary": measurement_summary(batches)}

    def create_measurement(self, project_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        project = self.projects.get_project(project_id)
        qfiles = sorted((project.path / "reports").glob("quantities-*.json"), key=lambda p: p.stat().st_mtime)
        if not qfiles:
            raise ValueError("Execute Quantitativos BIM antes da medição")
        qpath = qfiles[-1]
        if payload.get("quantities_report"):
            candidate = (project.path / "reports" / Path(str(payload["quantities_report"])).name).resolve()
            if candidate.parent != (project.path / "reports").resolve() or not candidate.is_file():
                raise ValueError("Relatório de quantitativos inválido")
            qpath = candidate
        guids = [str(x) for x in payload.get("guids") or [] if str(x).strip()]
        activity_id = str(payload.get("activity_id") or "").strip() or None
        if activity_id:
            activity = next((a for a in self._schedule_service(project_id).store.load().activities if a.activity_id == activity_id), None)
            if activity is None:
                raise KeyError(f"Atividade não encontrada: {activity_id}")
            guids = sorted(set(guids) | set(activity.linked_guids))
        report = json.loads(qpath.read_text(encoding="utf-8"))
        batch = self._measurement_service(project_id).create_from_guids(
            report, guids, period=str(payload.get("period") or ""),
            cumulative_percent=float(payload.get("cumulative_percent") or 0.0),
            quantity_kind=str(payload.get("quantity_kind") or ""),
            quantity_name=payload.get("quantity_name"), contractor=payload.get("contractor"),
            activity_id=activity_id, notes=payload.get("notes"),
            allow_geometry_fallback=bool(payload.get("allow_geometry_fallback", False)),
        )
        self._log(project, "measurement_created", batch_id=batch.batch_id, period=batch.period, activity_id=activity_id)
        return self._measurement_service(project_id).list_batches()[-1]

    def approve_measurement(self, project_id: str, batch_id: str, *, approved_by: str) -> dict[str, Any]:
        project = self.projects.get_project(project_id)
        batch = self._measurement_service(project_id).approve(batch_id, approved_by=approved_by)
        self._log(project, "measurement_approved", batch_id=batch_id, approved_by=approved_by)
        return next(x for x in self._measurement_service(project_id).list_batches() if x["batch_id"] == batch_id)

    def reject_measurement(self, project_id: str, batch_id: str, *, reason: str) -> dict[str, Any]:
        project = self.projects.get_project(project_id)
        self._measurement_service(project_id).reject(batch_id, reason=reason)
        self._log(project, "measurement_rejected", batch_id=batch_id)
        return next(x for x in self._measurement_service(project_id).list_batches() if x["batch_id"] == batch_id)

    def export_measurements_csv(self, project_id: str) -> dict[str, Any]:
        project = self.projects.get_project(project_id)
        path = project.path / "reports" / "measurements.csv"
        batches = self._measurement_service(project_id).store.load()
        write_measurement_csv(path, batches)
        return {"csv_path": str(path), "batch_count": len(batches)}

    def start_measurement_financial_report(self, project_id: str) -> dict[str, Any]:
        project = self.projects.get_project(project_id)
        budgets = sorted((project.path / "reports").glob("budget-*.json"), key=lambda p: p.stat().st_mtime)
        if not budgets:
            raise ValueError("Gere o Orçamento 5D antes da medição financeira")
        batches = self._measurement_service(project_id).store.load()
        if not any(b.status == "approved" for b in batches):
            raise ValueError("Aprove pelo menos uma medição física antes do relatório financeiro")
        schedule = self._schedule_service(project_id).store.load()
        budget_path = budgets[-1]
        manager = self._manager(project)

        def handler(ctx: JobContext, payload: dict[str, Any]) -> dict[str, Any]:
            ctx.progress(10, "valorizando medições aprovadas")
            budget = json.loads(budget_path.read_text(encoding="utf-8"))
            report = FinancialMeasurementEngine().calculate(batches, budget, schedule=schedule)
            ctx.check_cancelled()
            json_out = project.path / "reports" / f"measurement-financial-{ctx.job_id}.json"
            csv_out = project.path / "reports" / f"measurement-financial-{ctx.job_id}.csv"
            pdf_out = project.path / "reports" / f"measurement-financial-{ctx.job_id}.pdf"
            write_financial_measurement_json(json_out, report)
            write_financial_measurement_csv(csv_out, report)
            write_financial_measurement_pdf(pdf_out, report)
            self._log(project, "measurement_financial_completed", job_id=ctx.job_id, total_measured=report.get("total_measured"))
            return {"report_path": str(json_out), "csv_path": str(csv_out), "pdf_path": str(pdf_out), "total_measured": report.get("total_measured"), "remaining_budget": report.get("remaining_budget"), "measured_percent_of_budget": report.get("measured_percent_of_budget"), "unmatched_line_count": report.get("unmatched_line_count")}

        record = manager.submit("measurement_financial", {"budget_report": budget_path.name}, handler)
        self._log(project, "job_submitted", job_id=record.job_id, job_type="measurement_financial")
        return self._job_json(record)

    def list_jobs(self, project_id: str) -> list[dict[str, Any]]:
        return [self._job_json(job) for job in self._manager(self.projects.get_project(project_id)).list()]

    def get_job(self, project_id: str, job_id: str) -> dict[str, Any]:
        return self._job_json(self._manager(self.projects.get_project(project_id)).get(job_id))

    def cancel_job(self, project_id: str, job_id: str) -> dict[str, Any]:
        project = self.projects.get_project(project_id)
        record = self._manager(project).cancel(job_id)
        self._log(project, "job_cancel_requested", job_id=job_id)
        return self._job_json(record)

    def read_logs(self, project_id: str, *, limit: int = 200) -> list[dict[str, Any]]:
        project = self.projects.get_project(project_id)
        path = project.path / "logs" / "app.jsonl"
        if not path.is_file():
            return []
        rows: list[dict[str, Any]] = []
        for line in path.read_text(encoding="utf-8").splitlines()[-max(1, limit) :]:
            try:
                value = json.loads(line)
            except json.JSONDecodeError:
                continue
            if isinstance(value, dict):
                rows.append(value)
        return rows

    def _manager(self, project: Project) -> JobManager:
        with self._lock:
            manager = self._managers.get(project.project_id)
            if manager is None:
                manager = JobManager(JobStore(project.path / "jobs.json"))
                self._managers[project.project_id] = manager
            return manager

    def _log(self, project: Project, event: str, **fields: Any) -> None:
        path = project.path / "logs" / "app.jsonl"
        row = {"timestamp": _utc_now(), "event": event, **fields}
        path.parent.mkdir(parents=True, exist_ok=True)
        with self._lock:
            with path.open("a", encoding="utf-8") as handle:
                handle.write(json.dumps(row, ensure_ascii=False, separators=(",", ":")) + "\n")

    @staticmethod
    def _default_preflight_runner(paths: Sequence[Path], out: Path, tolerance: float, ctx: JobContext) -> dict[str, Any]:
        ctx.check_cancelled()
        report = PreflightEngine(IfcOpenShellBackend()).run(paths, alignment_tolerance_m=tolerance)
        ctx.progress(90, "gravando relatório")
        write_preflight_json(out, report)
        return {"aligned": report.aligned, "model_count": len(report.models), "warning_count": len(report.warnings)}

    @staticmethod
    def _default_rules_runner(file_a: Path, file_b: Path, preset: str, out: Path, ctx: JobContext) -> dict[str, Any]:
        ctx.check_cancelled()
        rules = get_preset(preset)
        report = RuleEngine(IfcOpenShellBackend()).run(file_a, file_b, rules)
        ctx.progress(90, "gravando clashes")
        write_rule_report_json(out, report, preset=preset)
        return {
            "preset": preset,
            "rule_count": len(report.rules),
            "raw_clash_count": report.raw_clash_count,
            "unique_clash_count": report.unique_clash_count,
        }

    @staticmethod
    def _default_viewer_runner(paths: Sequence[Path], max_elements: int | None, ctx: JobContext) -> dict[str, Any]:
        ctx.check_cancelled()
        session = ViewerEngine(IfcOpenShellBackend()).build(paths, max_elements=max_elements)
        ctx.progress(85, "serializando malhas")
        return viewer_manifest(session)

    @staticmethod
    def _default_quantities_runner(paths: Sequence[Path], json_out: Path, csv_out: Path, geometry_fallback: bool, ctx: JobContext) -> dict[str, Any]:
        ctx.check_cancelled()
        rows = QuantityEngine(IfcOpenShellBackend()).extract(paths, geometry_fallback=geometry_fallback)
        ctx.progress(85, "agrupando quantitativos")
        report = quantity_report(rows, model_files=[path.name for path in paths])
        write_quantity_json(json_out, report)
        write_quantity_csv(csv_out, report)
        return {"record_count": report["record_count"], "group_count": report["group_count"]}

    @staticmethod
    def _default_budget_runner(quantity_path: Path, pricebook_path: Path, json_out: Path, csv_out: Path, pdf_out: Path, ctx: JobContext) -> dict[str, Any]:
        ctx.check_cancelled()
        qreport = json.loads(quantity_path.read_text(encoding="utf-8"))
        book = PriceBookStore(pricebook_path).load()
        report = BudgetEngine().calculate(qreport, book)
        ctx.progress(85, "gerando orçamento 5D")
        write_budget_json(json_out, report)
        write_budget_csv(csv_out, report)
        write_budget_pdf(pdf_out, report)
        return {
            "total_cost": report["total_cost"],
            "matched_group_count": report["matched_group_count"],
            "unmatched_group_count": report["unmatched_group_count"],
            "currency": report["currency"],
        }

    @staticmethod
    def _project_json(project: Project) -> dict[str, Any]:
        return {
            "project_id": project.project_id,
            "name": project.name,
            "obra_id": project.obra_id,
            "created_at": project.created_at,
            "updated_at": project.updated_at,
            "models": [DesktopService._model_json(model) for model in project.models],
        }

    @staticmethod
    def _model_json(model: ProjectModel) -> dict[str, Any]:
        return {
            "model_id": model.model_id,
            "original_name": model.original_name,
            "stored_path": model.stored_path,
            "sha256": model.sha256,
            "size_bytes": model.size_bytes,
            "discipline": model.discipline,
            "imported_at": model.imported_at,
        }

    @staticmethod
    def _job_json(job: JobRecord) -> dict[str, Any]:
        return {
            "job_id": job.job_id,
            "job_type": job.job_type,
            "payload": job.payload,
            "status": job.status,
            "progress": job.progress,
            "message": job.message,
            "result": job.result,
            "error": job.error,
            "created_at": job.created_at,
            "updated_at": job.updated_at,
        }


def _looks_like_ifc(content: bytes) -> bool:
    head = content[:65536].decode("latin-1", errors="ignore").upper()
    return "ISO-10303-21" in head and "FILE_SCHEMA" in head
