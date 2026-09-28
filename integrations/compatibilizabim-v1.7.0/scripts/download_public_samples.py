from __future__ import annotations

import shutil
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Callable
from urllib.request import urlopen


@dataclass(frozen=True, slots=True)
class PublicSample:
    discipline: str
    filename: str
    url: str


_BASE = "https://raw.githubusercontent.com/youshengCode/IfcSampleFiles/main"

PUBLIC_SAMPLES: dict[str, PublicSample] = {
    "architecture": PublicSample(
        discipline="architecture",
        filename="Ifc4_Revit_ARC.ifc",
        url=f"{_BASE}/Ifc4_Revit_ARC.ifc",
    ),
    "structure": PublicSample(
        discipline="structure",
        filename="Ifc4_Revit_STR.ifc",
        url=f"{_BASE}/Ifc4_Revit_STR.ifc",
    ),
    "mep": PublicSample(
        discipline="mep",
        filename="Ifc4_Revit_MEP.ifc",
        url=f"{_BASE}/Ifc4_Revit_MEP.ifc",
    ),
}


def _download(url: str, destination: Path) -> None:
    with urlopen(url, timeout=120) as response, destination.open("wb") as output:
        shutil.copyfileobj(response, output)


def download_public_samples(
    destination_dir: Path,
    downloader: Callable[[str, Path], None] = _download,
) -> list[Path]:
    destination_dir.mkdir(parents=True, exist_ok=True)
    paths: list[Path] = []

    for sample in PUBLIC_SAMPLES.values():
        destination = destination_dir / sample.filename
        if not destination.exists():
            downloader(sample.url, destination)
        paths.append(destination)

    return paths


def main(argv: list[str] | None = None) -> int:
    args = list(sys.argv[1:] if argv is None else argv)
    destination = Path(args[0]) if args else Path("samples/public/revit")
    try:
        paths = download_public_samples(destination)
    except Exception as exc:  # network errors should be visible to the operator
        print(f"Falha ao baixar modelos públicos: {exc}")
        return 2

    print("Modelos públicos disponíveis:")
    for path in paths:
        print(path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
