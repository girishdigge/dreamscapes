# services/llama-stylist/utils/style_mapper.py
"""
Deterministic style mapper: transforms a base dream to match target style
by adjusting environment, entity colors, and glow multipliers.
"""

from typing import Dict, Any
import copy

STYLE_CONFIGS = {
    "ethereal": {
        "environment": {
            "preset": "dusk",
            "fog": 0.4,
            "skyColor": "#a6d8ff",
            "ambientLight": 0.9,
        },
        "entityDefaults": {"speed": 1.0, "glow": 0.7, "color": "#ffffff"},
    },
    "cyberpunk": {
        "environment": {
            "preset": "night",
            "fog": 0.2,
            "skyColor": "#001133",
            "ambientLight": 0.4,
        },
        "entityDefaults": {"speed": 2.0, "glow": 1.0, "color": "#00ffff"},
    },
    "surreal": {
        "environment": {
            "preset": "void",
            "fog": 0.6,
            "skyColor": "#2d1a4a",
            "ambientLight": 0.6,
        },
        "entityDefaults": {"speed": 1.5, "glow": 0.9, "color": "#ff0080"},
    },
    "fantasy": {
        "environment": {
            "preset": "dawn",
            "fog": 0.3,
            "skyColor": "#ffb347",
            "ambientLight": 1.1,
        },
        "entityDefaults": {"speed": 0.8, "glow": 0.6, "color": "#ffd700"},
    },
    "nightmare": {
        "environment": {
            "preset": "night",
            "fog": 0.7,
            "skyColor": "#1a0d1a",
            "ambientLight": 0.2,
        },
        "entityDefaults": {"speed": 0.6, "glow": 0.3, "color": "#800020"},
    },
}


def get_style_config(style: str):
    return STYLE_CONFIGS.get(style.lower(), STYLE_CONFIGS["ethereal"])


def apply_style(base: Dict[str, Any], style: str) -> Dict[str, Any]:
    out = copy.deepcopy(base)
    cfg = get_style_config(style)

    out.setdefault("environment", {})
    out["environment"].update(cfg["environment"])
    out["style"] = style

    for entity in out.get("entities", []):
        params = entity.setdefault("params", {})
        params["color"] = cfg["entityDefaults"]["color"]
        params["glow"] = min(
            1.0, (params.get("glow", 0.5) * (cfg["entityDefaults"].get("glow", 1.0)))
        )
        params["speed"] = params.get("speed", cfg["entityDefaults"]["speed"])

    out.setdefault("assumptions", []).append(
        f"Deterministic style mapping applied -> {style}"
    )
    return out
