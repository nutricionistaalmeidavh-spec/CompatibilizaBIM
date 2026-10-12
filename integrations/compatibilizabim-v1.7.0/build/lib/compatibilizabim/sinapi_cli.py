from __future__ import annotations

import argparse
import json
import sys
from dataclasses import asdict
from pathlib import Path

from .budget import pricebook_to_json
from .sinapi import (
    LATEST_VERIFIED_SINAPI,
    OfficialSinapiDownloader,
    SinapiDatabase,
    SinapiImporter,
    SinapiService,
    official_xlsx_url,
)


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="compatibilizabim-sinapi", description="Importa, atualiza, pesquisa e compara bases SINAPI.")
    sub = p.add_subparsers(dest="command", required=True)
    sub.add_parser("latest", help="Mostra a referência SINAPI oficial mais recente verificada no release do CompatibilizaBIM.")
    upd = sub.add_parser("update", help="Baixa o ZIP XLSX oficial da CAIXA, valida e importa no banco local.")
    upd.add_argument("db", type=Path); upd.add_argument("--competence", default=LATEST_VERIFIED_SINAPI.competence); upd.add_argument("--download-dir", type=Path, default=Path("sinapi-downloads")); upd.add_argument("--timeout", type=float, default=90.0)
    imp = sub.add_parser("import"); imp.add_argument("db", type=Path); imp.add_argument("archive", type=Path); imp.add_argument("--competence", required=True)
    ls = sub.add_parser("list"); ls.add_argument("db", type=Path)
    sea = sub.add_parser("search"); sea.add_argument("db", type=Path); sea.add_argument("release_id"); sea.add_argument("--uf", required=True); sea.add_argument("--query", default=""); sea.add_argument("--limit", type=int, default=20)
    pb = sub.add_parser("pricebook"); pb.add_argument("db", type=Path); pb.add_argument("release_id"); pb.add_argument("--uf", required=True); pb.add_argument("--mappings", type=Path, required=True); pb.add_argument("--bdi", type=float, default=0.0); pb.add_argument("--output", type=Path, required=True)
    cmp = sub.add_parser("compare"); cmp.add_argument("db", type=Path); cmp.add_argument("old_release_id"); cmp.add_argument("new_release_id"); cmp.add_argument("--uf", required=True); cmp.add_argument("--codes", nargs="*")
    return p


def _release_json(release) -> dict:
    return asdict(release)


def main(argv=None) -> int:
    a = build_parser().parse_args(argv)
    if a.command == "latest":
        payload = asdict(LATEST_VERIFIED_SINAPI) | {"xlsx_url": official_xlsx_url(LATEST_VERIFIED_SINAPI.competence)}
        print(json.dumps(payload, ensure_ascii=False, indent=2)); return 0
    if a.command == "update":
        try:
            db = SinapiDatabase(a.db)
            downloaded = OfficialSinapiDownloader(timeout=a.timeout).download(a.competence, a.download_dir)
            published_on = LATEST_VERIFIED_SINAPI.published_on if a.competence == LATEST_VERIFIED_SINAPI.competence else None
            release = SinapiImporter(db).import_archive(
                downloaded.path, competence=a.competence, source_url=downloaded.source_url,
                source_provider="CAIXA", published_on=published_on, fetched_at=downloaded.fetched_at,
            )
        except (OSError, ValueError) as exc:
            print(f"Falha ao baixar/importar SINAPI oficial: {exc}", file=sys.stderr)
            return 1
        print(json.dumps(_release_json(release) | {"download_path": str(downloaded.path), "xlsx_members": list(downloaded.xlsx_members)}, ensure_ascii=False, indent=2)); return 0

    db = SinapiDatabase(a.db); service = SinapiService(db)
    if a.command == "import":
        release = SinapiImporter(db).import_archive(a.archive, competence=a.competence)
        print(json.dumps(_release_json(release), ensure_ascii=False)); return 0
    if a.command == "list":
        print(json.dumps(service.list_releases(), ensure_ascii=False, indent=2)); return 0
    if a.command == "search":
        print(json.dumps(service.search_compositions(a.release_id, uf=a.uf, query=a.query, limit=a.limit), ensure_ascii=False, indent=2)); return 0
    if a.command == "pricebook":
        mappings = json.loads(a.mappings.read_text(encoding="utf-8"))
        if not isinstance(mappings, list): raise ValueError("Arquivo de mapeamentos deve conter uma lista JSON")
        book = service.build_pricebook(a.release_id, uf=a.uf, bdi_percent=a.bdi, mappings=mappings)
        payload = pricebook_to_json(book); a.output.parent.mkdir(parents=True, exist_ok=True); a.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        print(json.dumps({"output": str(a.output), "composition_count": len(book.compositions), "mapping_count": len(book.mappings)}, ensure_ascii=False)); return 0
    if a.command == "compare":
        print(json.dumps(service.compare_releases(a.old_release_id, a.new_release_id, uf=a.uf, codes=a.codes), ensure_ascii=False, indent=2)); return 0
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
