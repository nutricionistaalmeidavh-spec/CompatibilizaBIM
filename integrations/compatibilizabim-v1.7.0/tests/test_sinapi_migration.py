import sqlite3
from pathlib import Path
from compatibilizabim.sinapi import SinapiDatabase

def test_v1_database_migrates_provenance_columns_without_losing_release(tmp_path: Path):
    path=tmp_path/'old.sqlite3'
    with sqlite3.connect(path) as conn:
        conn.executescript('''
        CREATE TABLE metadata(key TEXT PRIMARY KEY,value TEXT NOT NULL);
        CREATE TABLE releases(release_id TEXT PRIMARY KEY,competence TEXT NOT NULL,source_filename TEXT NOT NULL,source_sha256 TEXT NOT NULL,imported_at TEXT NOT NULL,UNIQUE(competence,source_sha256));
        CREATE TABLE items(release_id TEXT NOT NULL,kind TEXT NOT NULL,uf TEXT NOT NULL,code TEXT NOT NULL,description TEXT NOT NULL,unit TEXT NOT NULL,price REAL NOT NULL,workbook TEXT NOT NULL,sheet TEXT NOT NULL,PRIMARY KEY(release_id,kind,uf,code));
        INSERT INTO metadata VALUES('schema_version','1');
        INSERT INTO releases VALUES('OLD','2026-06','old.zip','abc','2026-07-10T00:00:00Z');
        ''')
    db=SinapiDatabase(path)
    row=db.list_releases()[0]
    assert row.release_id=='OLD'
    assert row.source_url is None and row.source_provider is None
    with sqlite3.connect(path) as conn:
        assert conn.execute("SELECT value FROM metadata WHERE key='schema_version'").fetchone()[0]=='2'
        cols={r[1] for r in conn.execute('PRAGMA table_info(releases)')}
    assert {'source_url','source_provider','published_on','fetched_at'} <= cols
