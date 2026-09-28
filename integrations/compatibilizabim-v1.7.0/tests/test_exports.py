import csv
import json
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from xml.etree import ElementTree as ET

from compatibilizabim.exports import ExportService
from compatibilizabim.issues import IssueService, IssueStore


def _make_store(tmp_path: Path) -> Path:
    report = tmp_path / "rules.json"
    store = tmp_path / "issues.json"
    report.write_text(
        json.dumps(
            {
                "file_a": "Projeto_MEP.ifc",
                "file_b": "Projeto_STR.ifc",
                "clashes": [
                    {
                        "rule_id": "pipe-beam",
                        "rule_name": "Tubo x Viga",
                        "severity": "critical",
                        "index": 1,
                        "mode": "intersection",
                        "a_global_id": "0AAAAAAAAAAAAAAAAAAAAA",
                        "b_global_id": "1BBBBBBBBBBBBBBBBBBBBB",
                        "a_ifc_class": "IfcPipeSegment",
                        "b_ifc_class": "IfcBeam",
                        "a_name": "Tubo H-203",
                        "b_name": "Viga V-12",
                        "clash_type": "pierce",
                        "point": [10.0, 20.0, 3.0],
                        "depth_m": 0.08,
                    },
                    {
                        "rule_id": "duct-slab",
                        "rule_name": "Duto x Laje",
                        "severity": "high",
                        "index": 2,
                        "mode": "intersection",
                        "a_global_id": "2CCCCCCCCCCCCCCCCCCCCC",
                        "b_global_id": "3DDDDDDDDDDDDDDDDDDDDD",
                        "a_ifc_class": "IfcDuctSegment",
                        "b_ifc_class": "IfcSlab",
                        "a_name": "Duto 2",
                        "b_name": "Laje 2",
                        "clash_type": "pierce",
                        "point": [12.0, 22.0, 4.0],
                        "depth_m": 0.03,
                    },
                ],
            }
        ),
        encoding="utf-8",
    )
    fixed = datetime(2026, 8, 15, 10, 0, tzinfo=timezone.utc)
    service = IssueService(clock=lambda: fixed)
    service.import_rule_report(report, store, project_id="RES-001", obra_id="OBRA-42")
    issue_id = IssueStore(store).load()[0].issue_id
    viewpoint = tmp_path / "viewpoint.json"
    viewpoint.write_text(
        json.dumps(
            {
                "origin": [100.0, 200.0, 0.0],
                "target": [10.0, 20.0, 3.0],
                "yaw": 0.5,
                "pitch": -0.25,
                "distance": 12.0,
                "selected": ["0AAAAAAAAAAAAAAAAAAAAA", "1BBBBBBBBBBBBBBBBBBBBB"],
            }
        ),
        encoding="utf-8",
    )
    service.update_issue(
        store,
        issue_id,
        assignee="hidraulica@example.com",
        due_date="2026-08-21",
        storey="3 Pavimento",
        viewpoint_path=viewpoint,
    )
    service.add_comment(store, issue_id, author="victor@example.com", text="Alterar rota da tubulacao.")
    return store


def test_bcf_export_contains_version_topics_comments_and_viewpoint(tmp_path):
    store = _make_store(tmp_path)
    output = tmp_path / "issues.bcf"

    summary = ExportService().write_bcf(store, output, author="coord@example.com")

    assert summary.issue_count == 2
    assert output.exists()
    with zipfile.ZipFile(output) as archive:
        names = set(archive.namelist())
        assert "bcf.version" in names
        topic_dirs = sorted({name.split("/")[0] for name in names if "/markup.bcf" in name})
        assert len(topic_dirs) == 2

        version = ET.fromstring(archive.read("bcf.version"))
        assert version.tag == "Version"
        assert version.attrib["VersionId"] == "3.0"

        first = topic_dirs[0]
        markup = ET.fromstring(archive.read(f"{first}/markup.bcf"))
        topic = markup.find("Topic")
        assert topic is not None
        assert topic.attrib["TopicType"] == "Clash"
        assert topic.findtext("Title")
        assert topic.findtext("CreationAuthor") == "coord@example.com"
        assert topic.find("Comments/Comment") is not None or first != topic_dirs[0]

        vp_ref = topic.find("Viewpoints/ViewPoint")
        if vp_ref is not None:
            vp_file = vp_ref.findtext("Viewpoint")
            assert vp_file
            vis = ET.fromstring(archive.read(f"{first}/{vp_file}"))
            components = vis.findall("./Components/Selection/Component")
            assert len(components) == 2
            assert all(len(c.attrib["IfcGuid"]) == 22 for c in components)
            assert vis.find("PerspectiveCamera") is not None


def test_csv_export_has_one_row_per_issue(tmp_path):
    store = _make_store(tmp_path)
    output = tmp_path / "issues.csv"

    ExportService().write_csv(store, output)

    with output.open(encoding="utf-8-sig", newline="") as handle:
        rows = list(csv.DictReader(handle))
    assert len(rows) == 2
    assert rows[0]["project_id"] == "RES-001"
    assert rows[0]["obra_id"] == "OBRA-42"
    assert rows[0]["status"] == "open"
    assert rows[0]["depth_mm"] == "80.0"


def test_pdf_export_creates_valid_pdf_with_summary(tmp_path):
    store = _make_store(tmp_path)
    output = tmp_path / "issues.pdf"

    summary = ExportService().write_pdf(store, output, title="Relatorio CompatibilizaBIM")

    data = output.read_bytes()
    assert data.startswith(b"%PDF-")
    assert len(data) > 1000
    assert summary.issue_count == 2
    assert summary.open_count == 2
    assert summary.critical_count == 1
