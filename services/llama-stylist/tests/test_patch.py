# services/llama-stylist/tests/test_patch.py
import pytest
from services.patch_service import apply_patch


def make_base():
    return {
        "id": "test1",
        "title": "Test Dream",
        "style": "ethereal",
        "seed": 42,
        "environment": {
            "preset": "dusk",
            "fog": 0.3,
            "skyColor": "#a6d8ff",
            "ambientLight": 0.8,
        },
        "structures": [
            {"id": "s1", "template": "floating_library", "pos": [0, 20, 0], "scale": 1}
        ],
        "entities": [
            {
                "id": "e1",
                "type": "book_swarm",
                "count": 20,
                "params": {"color": "#ffffff", "speed": 1.0, "glow": 0.7},
            }
        ],
        "cinematography": {
            "durationSec": 30,
            "shots": [{"type": "establish", "target": "s1", "duration": 30}],
        },
        "render": {"res": [1280, 720], "fps": 30, "quality": "draft"},
    }


def test_color_patch_applies():
    base = make_base()
    patched = apply_patch(base, "make the books blue and add an island")
    # color changed
    assert any(
        e.get("params", {}).get("color") == "#0000ff"
        for e in patched.get("entities", [])
    )
    # island added
    assert any(
        s.get("template") == "floating_island" for s in patched.get("structures", [])
    )


def test_recorded_assumption_if_no_change():
    base = make_base()
    patched = apply_patch(base, "this is a weird request that cannot be applied easily")
    # safe fallback should record assumption
    assert any(
        "Requested edit" in a or "safe_patch_applied" in a
        for a in patched.get("assumptions", [])
    )
