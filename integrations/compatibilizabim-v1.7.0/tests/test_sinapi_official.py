from __future__ import annotations

import io
import json
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from zipfile import ZipFile

from openpyxl import Workbook

from compatibilizabim.sinapi import (
    LATEST_VERIFIED_SINAPI,
    OfficialSinapiDownloader,
    SinapiDatabase,
    SinapiImporter,
    SinapiService,
    official_xlsx_url,
)
from compatibilizabim.sinapi_cli import build_parser


def _official_like_archive(price: float = 84.0) -> bytes:
    book = io.BytesIO()
    wb = Workbook()
    ws = wb.active
    ws.title = "Composicoes"
    ws.append(["Código", "Descrição", "Unidade", "SP"])
    ws.append([103328, "ALVENARIA DE VEDACAO BLOCOS CERAMICOS 14CM", "M2", price])
    wb.save(book)
    archive = io.BytesIO()
    with ZipFile(archive, "w") as zf:
        zf.writestr("SINAPI_Referencias_Composicoes_202607.xlsx", book.getvalue())
    return archive.getvalue()


def test_latest_verified_reference_and_official_url_are_explicit():
    assert LATEST_VERIFIED_SINAPI.competence == "2026-07"
    assert LATEST_VERIFIED_SINAPI.published_on == "2026-08-11"
    url = official_xlsx_url("2026-07")
    assert url.startswith("https://www.caixa.gov.br/Downloads/")
    assert "SINAPI-2026-07-formato-xlsx.zip" in url


def test_downloader_validates_zip_and_imports_with_provenance(tmp_path: Path):
    body = _official_like_archive()

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            self.send_response(200)
            self.send_header("Content-Type", "application/zip")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def log_message(self, *_args):
            return

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        base = f"http://127.0.0.1:{server.server_port}/SINAPI-{{competence}}-formato-xlsx.zip"
        downloader = OfficialSinapiDownloader(base_url_template=base, trusted_hosts={"127.0.0.1"})
        downloaded = downloader.download("2026-07", tmp_path / "downloads")
    finally:
        server.shutdown(); server.server_close(); thread.join(timeout=2)

    assert downloaded.path.is_file()
    assert downloaded.competence == "2026-07"
    assert downloaded.source_url.startswith("http://127.0.0.1:")
    assert downloaded.sha256
    assert downloaded.xlsx_members == ("SINAPI_Referencias_Composicoes_202607.xlsx",)

    db = SinapiDatabase(tmp_path / "sinapi.sqlite3")
    release = SinapiImporter(db).import_archive(
        downloaded.path,
        competence=downloaded.competence,
        source_url=downloaded.source_url,
        source_provider="CAIXA",
        published_on="2026-08-11",
        fetched_at=downloaded.fetched_at,
    )
    assert release.source_provider == "CAIXA"
    assert release.source_url == downloaded.source_url
    assert release.published_on == "2026-08-11"
    assert db.get_item(release.release_id, kind="composition", uf="SP", code="103328").price == 84.0


def test_downloader_fails_closed_and_does_not_publish_invalid_archive(tmp_path: Path):
    bad = b"not a zip"

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            self.send_response(200); self.end_headers(); self.wfile.write(bad)
        def log_message(self, *_args): return

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True); thread.start()
    try:
        base = f"http://127.0.0.1:{server.server_port}/SINAPI-{{competence}}-formato-xlsx.zip"
        downloader = OfficialSinapiDownloader(base_url_template=base, trusted_hosts={"127.0.0.1"})
        try:
            downloader.download("2026-07", tmp_path / "downloads")
        except ValueError as exc:
            assert "ZIP" in str(exc)
        else:
            raise AssertionError("download inválido deveria falhar")
    finally:
        server.shutdown(); server.server_close(); thread.join(timeout=2)

    assert not list((tmp_path / "downloads").glob("*.zip")) if (tmp_path / "downloads").exists() else True


def test_cli_has_latest_and_update_contracts(tmp_path: Path):
    p = build_parser()
    latest = p.parse_args(["latest"])
    assert latest.command == "latest"
    update = p.parse_args(["update", str(tmp_path / "db.sqlite3"), "--download-dir", str(tmp_path / "d")])
    assert update.command == "update"
    assert update.competence == "2026-07"

def test_official_release_provenance_flows_into_pricebook_and_budget(tmp_path: Path):
    archive = tmp_path / 'official.zip'
    archive.write_bytes(_official_like_archive(84.0))
    db = SinapiDatabase(tmp_path / 'db.sqlite3')
    release = SinapiImporter(db).import_archive(
        archive, competence='2026-07',
        source_url='https://www.caixa.gov.br/Downloads/sinapi-proposta-formato-divulgacao-mensal/SINAPI-2026-07-formato-xlsx.zip',
        source_provider='CAIXA', published_on='2026-08-11', fetched_at='2026-08-15T10:00:00+00:00',
    )
    book = SinapiService(db).build_pricebook(release.release_id, uf='SP', bdi_percent=0, mappings=[{
        'composition_code':'103328','ifc_class':'IfcWall','quantity_kind':'area','quantity_name_contains':'NetArea'
    }])
    from compatibilizabim.budget import BudgetEngine, pricebook_to_json
    assert book.provenance['source_sha256'] == release.source_sha256
    assert book.provenance['uf'] == 'SP'
    assert pricebook_to_json(book)['provenance']['competence'] == '2026-07'
    q={'groups':[{'discipline':'Architecture','source':'ifc_qto','storey':'T','ifc_class':'IfcWall','type_name':None,'material':None,'quantity_name':'NetArea','kind':'area','unit':'m2','value':10,'element_count':1}]}
    report=BudgetEngine().calculate(q,book)
    assert report['cost_provenance']['source_provider']=='CAIXA'
    assert report['cost_provenance']['source_sha256']==release.source_sha256


def test_cli_update_network_failure_is_short_and_fail_closed(tmp_path: Path, monkeypatch, capsys):
    from compatibilizabim.sinapi_cli import main

    def fail_download(self, competence, destination):
        raise OSError("network unavailable")

    monkeypatch.setattr(OfficialSinapiDownloader, "download", fail_download)
    code = main([
        "update", str(tmp_path / "db.sqlite3"),
        "--download-dir", str(tmp_path / "downloads"),
        "--timeout", "1",
    ])
    captured = capsys.readouterr()
    assert code == 1
    assert "Falha ao baixar/importar SINAPI oficial" in captured.err
    assert "network unavailable" in captured.err
    assert "Traceback" not in captured.err
