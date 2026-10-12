from pathlib import Path

import pytest

from compatibilizabim.cli import build_parser, validate_args


def test_parser_defaults_to_intersection_and_ifcelement():
    parser = build_parser()
    args = parser.parse_args(["a.ifc", "b.ifc"])
    assert args.mode == "intersection"
    assert args.class_a == "IfcElement"
    assert args.class_b == "IfcElement"
    assert args.tolerance == 0.002
    assert args.clearance == 0.05


def test_validate_args_rejects_missing_ifc_file(tmp_path):
    parser = build_parser()
    existing = tmp_path / "a.ifc"
    existing.write_text("dummy")
    args = parser.parse_args([str(existing), str(tmp_path / "missing.ifc")])

    with pytest.raises(ValueError, match="não encontrado"):
        validate_args(args)


def test_validate_args_rejects_negative_clearance(tmp_path):
    a = tmp_path / "a.ifc"
    b = tmp_path / "b.ifc"
    a.write_text("dummy")
    b.write_text("dummy")
    parser = build_parser()
    args = parser.parse_args([str(a), str(b), "--clearance", "-0.1"])

    with pytest.raises(ValueError, match="clearance"):
        validate_args(args)
