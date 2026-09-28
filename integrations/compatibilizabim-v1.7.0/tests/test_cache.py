from __future__ import annotations

from pathlib import Path

from compatibilizabim.cache import ContentCache, cache_key


def test_content_cache_round_trips_json_and_uses_stable_key(tmp_path: Path) -> None:
    one = cache_key("mesh", "abc", {"world_coords": True, "quality": 1})
    two = cache_key("mesh", "abc", {"quality": 1, "world_coords": True})
    assert one == two

    cache = ContentCache(tmp_path / "cache")
    path = cache.put_json(one, {"vertices": [1, 2, 3]})

    assert path.exists()
    assert cache.get_json(one) == {"vertices": [1, 2, 3]}
    assert cache.has(one)
