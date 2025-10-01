# services/llama-stylist/utils/json_parser.py
"""
Helpers for building prompts and extracting JSON from LLM responses.
"""

import re
import json
from typing import Optional, Dict, Any


def _extract_first_json_block(text: str) -> Optional[str]:
    if not text or not isinstance(text, str):
        return None

    first = text.find("{")
    if first == -1:
        return None

    depth = 0
    start = -1
    for i, ch in enumerate(text):
        if ch == "{":
            if start == -1:
                start = i
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0 and start != -1:
                return text[start : i + 1]
    # fallback: regex
    m = re.search(r"(\{[\s\S]*\})", text)
    return m.group(1) if m else None


def extract_json_from_text(text: str) -> Optional[Dict[str, Any]]:
    """
    Try to find and parse the first JSON object in the given text.
    Returns the parsed dict or None.
    """
    block = _extract_first_json_block(text)
    if not block:
        return None
    try:
        return json.loads(block)
    except Exception:
        # try to tidy trailing commas
        tidy = re.sub(r",\s*([}\]])", r"\1", block)
        try:
            return json.loads(tidy)
        except Exception:
            return None


def parse_json_or_none(text: str) -> Optional[Dict[str, Any]]:
    if not text:
        return None
    try:
        return json.loads(text)
    except Exception:
        return None


# Prompt builders used by LlamaClient local stub and by services
def build_patch_prompt(
    base_json: Dict[str, Any], edit_text: str, options: Dict = None
) -> str:
    options = options or {}
    header = (
        "You are an assistant that modifies an existing Dream Scene JSON. Return ONLY the full patched "
        "JSON object with no commentary.\n\n"
    )
    payload = (
        f'Base Dream JSON:\n{json.dumps(base_json, indent=2)}\n\nEdit Instruction:\n"{edit_text}"\n\nOptions:\n'
        + json.dumps(options or {})
    )
    return header + payload


def build_style_prompt(
    base_json: Dict[str, Any], target_style: str, options: Dict = None
) -> str:
    options = options or {}
    header = (
        "You are a style-enrichment assistant. Given a Dream Scene JSON, return the full JSON adjusted to match the requested style.\n"
        "Respond with ONLY valid JSON (no commentary).\n\n"
    )
    payload = (
        f"Base Dream JSON:\n{json.dumps(base_json, indent=2)}\n\nRequested Style:\n{target_style}\n\nOptions:\n"
        + json.dumps(options or {})
    )
    return header + payload
