from pathlib import Path

import pytest

from compatibilizabim.viewer_cli import build_parser


def test_viewer_cli_accepts_multiple_ifcs_and_output():
    args = build_parser().parse_args(
        ["arc.ifc", "str.ifc", "mep.ifc", "--out", "reports/viewer.html", "--max-elements", "500", "--clashes", "reports/rules.json"]
    )

    assert args.files == [Path("arc.ifc"), Path("str.ifc"), Path("mep.ifc")]
    assert args.out == Path("reports/viewer.html")
    assert args.max_elements == 500
    assert args.clashes == Path("reports/rules.json")


def test_viewer_cli_rejects_non_positive_max_elements():
    parser = build_parser()
    with pytest.raises(SystemExit):
        parser.parse_args(["arc.ifc", "--max-elements", "0"])
