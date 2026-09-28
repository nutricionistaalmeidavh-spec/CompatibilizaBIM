from __future__ import annotations

import io
import json
import time
from pathlib import Path
from zipfile import ZipFile

from openpyxl import Workbook

from compatibilizabim.budget import BudgetEngine, PriceBookStore, write_budget_json
from compatibilizabim.desktop_service import DesktopService
from compatibilizabim.sinapi import DownloadedSinapiArchive


def _archive(path: Path, price: float = 84.0) -> None:
    xlsx = io.BytesIO(); wb = Workbook(); ws = wb.active; ws.title = 'Composicoes'
    ws.append(['Código','Descrição','Unidade','SP']); ws.append([103328,'ALVENARIA CERAMICA 14CM','M2',price]); wb.save(xlsx)
    with ZipFile(path, 'w') as zf: zf.writestr('composicoes.xlsx', xlsx.getvalue())


class FakeOfficialDownloader:
    def download(self, competence: str, destination_dir: Path):
        destination_dir.mkdir(parents=True, exist_ok=True)
        path = destination_dir / f'SINAPI-{competence}-formato-xlsx.zip'
        _archive(path)
        return DownloadedSinapiArchive(
            path=path, competence=competence,
            source_url=f'https://www.caixa.gov.br/Downloads/sinapi-proposta-formato-divulgacao-mensal/SINAPI-{competence}-formato-xlsx.zip',
            sha256='fakehash', fetched_at='2026-08-15T10:00:00+00:00', xlsx_members=('composicoes.xlsx',),
        )


def _wait(s: DesktopService, pid: str, jid: str):
    for _ in range(200):
        row = s.get_job(pid, jid)
        if row['status'] in {'completed','failed','cancelled','interrupted'}:
            return row
        time.sleep(.01)
    raise AssertionError('timeout')


def test_desktop_official_update_imports_audited_release(tmp_path: Path):
    s = DesktopService(tmp_path/'data', sinapi_downloader=FakeOfficialDownloader())
    p = s.create_project('P'); pid = p['project_id']
    job = s.start_official_sinapi_update(pid)
    done = _wait(s, pid, job['job_id'])
    assert done['status'] == 'completed'
    assert done['result']['competence'] == '2026-07'
    releases = s.list_sinapi_releases(pid)
    assert releases[0]['source_provider'] == 'CAIXA'
    assert releases[0]['published_on'] == '2026-08-11'
    assert releases[0]['source_url'].startswith('https://www.caixa.gov.br/')


def test_desktop_phase2_readiness_uses_active_release_and_latest_reports(tmp_path: Path):
    s = DesktopService(tmp_path/'data', sinapi_downloader=FakeOfficialDownloader())
    p = s.create_project('P'); pid = p['project_id']
    done = _wait(s, pid, s.start_official_sinapi_update(pid)['job_id'])
    rid = done['result']['release_id']
    mappings = [{'composition_code':'103328','ifc_class':'IfcWall','quantity_kind':'area','quantity_name_contains':'NetArea'}]
    s.activate_sinapi_pricebook(pid, rid, uf='SP', bdi_percent=0, mappings=mappings)
    project = s.projects.get_project(pid); reports = project.path/'reports'
    quantities = {'groups':[{'discipline':'Architecture','source':'ifc_qto','storey':'T','ifc_class':'IfcWall','type_name':'14cm','material':None,'quantity_name':'NetArea','kind':'area','unit':'m2','value':100,'element_count':10}]}
    qpath = reports/'quantities-JOB-READY.json'; qpath.write_text(json.dumps(quantities), encoding='utf-8')
    book = PriceBookStore(project.path/'costs'/'pricebook.json').load()
    budget = BudgetEngine().calculate(quantities, book)
    write_budget_json(reports/'budget-JOB-READY.json', budget)
    ready = s.get_phase2_readiness(pid)
    assert ready['ready_for_reference_budget'] is True
    assert ready['coverage_percent'] == 100.0
    assert ready['provenance']['competence'] == '2026-07'
    assert ready['provenance']['uf'] == 'SP'
