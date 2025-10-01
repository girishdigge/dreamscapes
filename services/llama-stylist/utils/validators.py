# services/llama-stylist/utils/validators.py
"""
Lightweight dream schema validator and repair utilities.
Not a replacement for AJV; intended for quick sanity checks and repairs.
"""

from typing import Dict, Any, Tuple, List
import copy
import time
import re

# Minimal required fields
REQUIRED_FIELDS = ["id", "title", "style"]


def validate_dream(dream: Dict[str, Any]) -> Tuple[bool, List[str]]:
    errors = []
    if not isinstance(dream, dict):
        return False, ["dream must be an object"]

    for field in REQUIRED_FIELDS:
        if field not in dream:
            errors.append(f"missing_required:{field}")

    if "style" in dream:
        if dream["style"] not in [
            "ethereal",
            "cyberpunk",
            "surreal",
            "fantasy",
            "nightmare",
        ]:
            errors.append(f"invalid_style:{dream['style']}")

    # cinematography checks
    if "cinematography" in dream:
        c = dream["cinematography"]
        if not isinstance(c, dict):
            errors.append("cinematography_not_object")
        else:
            if "durationSec" not in c or "shots" not in c:
                errors.append("cinematography_missing_duration_or_shots")
            else:
                if not isinstance(c["shots"], list) or len(c["shots"]) == 0:
                    errors.append("cinematography_shots_invalid")

    return (len(errors) == 0), errors


def repair_dream(dream: Dict[str, Any]) -> Dict[str, Any]:
    repaired = copy.deepcopy(dream)

    # Ensure required fields
    repaired["id"] = repaired.get("id", f"repaired_{int(time.time())}")
    repaired["title"] = repaired.get("title", "Repaired Dream")
    if repaired.get("style") not in [
        "ethereal",
        "cyberpunk",
        "surreal",
        "fantasy",
        "nightmare",
    ]:
        repaired["style"] = "ethereal"

    # Ensure arrays
    repaired["structures"] = (
        repaired.get("structures", [])
        if isinstance(repaired.get("structures", []), list)
        else []
    )
    repaired["entities"] = (
        repaired.get("entities", [])
        if isinstance(repaired.get("entities", []), list)
        else []
    )

    # Cinematography defaults
    if "cinematography" not in repaired or not isinstance(
        repaired["cinematography"], dict
    ):
        repaired["cinematography"] = {
            "durationSec": 30,
            "shots": [
                {
                    "type": "establish",
                    "target": (
                        repaired["structures"][0]["id"]
                        if repaired.get("structures")
                        else "s1"
                    ),
                    "duration": 30,
                }
            ],
        }
    else:
        c = repaired["cinematography"]
        if "durationSec" not in c:
            c["durationSec"] = (
                sum([s.get("duration", 0) for s in c.get("shots", [])]) or 30
            )
        if "shots" not in c or not isinstance(c["shots"], list) or len(c["shots"]) == 0:
            c["shots"] = [
                {
                    "type": "establish",
                    "target": (
                        repaired["structures"][0]["id"]
                        if repaired.get("structures")
                        else "s1"
                    ),
                    "duration": c.get("durationSec", 30),
                }
            ]

    repaired.setdefault("assumptions", []).append("auto_repaired_missing_fields")
    return repaired


def safe_patch(base: Dict[str, Any], edit_text: str) -> Dict[str, Any]:
    """
    Non-destructive safe patch: apply conservative changes or record assumptions.
    Useful as guaranteed fallback.
    """
    patched = copy.deepcopy(base)
    patched.setdefault("assumptions", [])
    edit = edit_text.lower()

    color_map = {
        "red": "#ff0000",
        "blue": "#0000ff",
        "green": "#00ff00",
        "yellow": "#ffff00",
        "purple": "#800080",
        "pink": "#ff69b4",
        "orange": "#ffa500",
        "white": "#ffffff",
        "black": "#000000",
        "gold": "#ffd700",
        "cyan": "#00ffff",
    }

    applied = []

    # apply color keywords
    for k, v in color_map.items():
        if k in edit:
            for e in patched.get("entities", []):
                e.setdefault("params", {})["color"] = v
            if patched.get("environment"):
                patched.setdefault("environment", {})["skyColor"] = v
            applied.append(f"color:{k}")

    # add simple structures if requested
    if "add island" in edit or ("add" in edit and "island" in edit):
        patched.setdefault("structures", []).append(
            {
                "id": f"added_island_{int(time.time())}",
                "template": "floating_island",
                "pos": [0, 15, 0],
                "scale": 0.8,
                "features": [],
            }
        )
        applied.append("added_island")

    # speed changes
    if any(s in edit for s in ["faster", "speed up", "quick"]):
        for e in patched.get("entities", []):
            p = e.setdefault("params", {})
            p["speed"] = min(10, (p.get("speed", 1.0) * 1.5))
        applied.append("increased_speed")

    if not applied:
        patched["assumptions"].append(f'Requested edit recorded: "{edit_text}"')
    else:
        patched["assumptions"].append("safe_patch_applied:" + ",".join(applied))

    patched.setdefault("patchHistory", []).append(
        {
            "editText": edit_text,
            "appliedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "source": "safe_patch",
        }
    )
    return patched
