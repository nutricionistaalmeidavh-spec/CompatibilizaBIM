from pathlib import Path

from scripts.download_public_samples import PUBLIC_SAMPLES, download_public_samples


def test_public_sample_manifest_has_three_disciplines():
    assert set(PUBLIC_SAMPLES) == {"architecture", "structure", "mep"}
    assert all(item.filename.endswith(".ifc") for item in PUBLIC_SAMPLES.values())
    assert all(item.url.startswith("https://raw.githubusercontent.com/") for item in PUBLIC_SAMPLES.values())


def test_download_public_samples_uses_manifest_and_skips_existing(tmp_path):
    calls: list[tuple[str, Path]] = []

    def fake_download(url: str, destination: Path) -> None:
        calls.append((url, destination))
        destination.write_text("ISO-10303-21;", encoding="utf-8")

    existing = tmp_path / PUBLIC_SAMPLES["architecture"].filename
    existing.write_text("already here", encoding="utf-8")

    paths = download_public_samples(tmp_path, downloader=fake_download)

    assert len(paths) == 3
    assert existing.read_text(encoding="utf-8") == "already here"
    assert len(calls) == 2
    assert {path.name for path in paths} == {
        sample.filename for sample in PUBLIC_SAMPLES.values()
    }
