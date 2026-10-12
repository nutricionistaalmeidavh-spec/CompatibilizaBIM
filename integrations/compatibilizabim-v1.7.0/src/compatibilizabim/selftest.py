from __future__ import annotations

import argparse
from dataclasses import dataclass
from pathlib import Path

from .engine import ClashBackend, ClashEngine
from .ifc_backend import IfcOpenShellBackend, IfcOpenShellUnavailable
from .models import ClashRequest


@dataclass(frozen=True, slots=True)
class SyntheticValidationResult:
    overlap_count: int
    clear_count: int
    passed: bool


def default_sample_dir() -> Path:
    return Path(__file__).resolve().parent / "data" / "synthetic"


def run_synthetic_validation(
    backend: ClashBackend | None = None,
    sample_dir: Path | None = None,
) -> SyntheticValidationResult:
    samples = Path(sample_dir) if sample_dir is not None else default_sample_dir()
    file_a = samples / "sphere_a.ifc"
    file_overlap = samples / "sphere_b_overlap.ifc"
    file_clear = samples / "sphere_b_clear.ifc"

    missing = [path.name for path in (file_a, file_overlap, file_clear) if not path.exists()]
    if missing:
        raise RuntimeError(f"Autoteste não encontrou os fixtures IFC: {', '.join(missing)}")

    engine = ClashEngine(backend or IfcOpenShellBackend())
    common = {
        "class_a": "IfcProxy",
        "class_b": "IfcProxy",
        "mode": "collision",
        "check_all": True,
    }

    overlap_results = engine.run(ClashRequest(file_a=file_a, file_b=file_overlap, **common))
    if not overlap_results:
        raise RuntimeError("Autoteste falhou: sobreposição esperada não foi detectada")

    clear_results = engine.run(ClashRequest(file_a=file_a, file_b=file_clear, **common))
    if clear_results:
        raise RuntimeError(
            f"Autoteste falhou: caso sem sobreposição gerou {len(clear_results)} conflito(s)"
        )

    return SyntheticValidationResult(
        overlap_count=len(overlap_results),
        clear_count=len(clear_results),
        passed=True,
    )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="compatibilizabim-selftest",
        description="Valida o motor de clash com fixtures IFC de resposta conhecida.",
    )
    parser.parse_args(argv)
    try:
        result = run_synthetic_validation()
    except (IfcOpenShellUnavailable, RuntimeError) as exc:
        print(f"FALHA: {exc}")
        return 2

    print("CompatibilizaBIM - autoteste sintético")
    print(f"Sobreposição detectada: {result.overlap_count}")
    print(f"Caso sem colisão: {result.clear_count}")
    print("Resultado: PASSOU")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
