# services/llama-stylist/tests/test_style.py
from services.style_service import enrich_style


def make_base():
    return {
        "id": "style_test",
        "title": "Style Dream",
        "style": "ethereal",
        "seed": 99,
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


def test_cyberpunk_enrichment():
    base = make_base()
    enriched = enrich_style(base, "cyberpunk")
    # style set
    assert enriched.get("style") == "cyberpunk"
    # environment skyColor changed to cyberpunk default
    assert enriched.get("environment", {}).get("skyColor") == "#001133"
    # entity color updated
    assert any(
        e.get("params", {}).get("color") == "#00ffff"
        for e in enriched.get("entities", [])
    )
