# services/llama-stylist/services/patch_service.py
"""
Apply AI-powered or rule-based patch to an existing dream JSON.
Exports: apply_patch(base_json, edit_text, options=None)
"""

import logging
import json
from typing import Optional, Any, Dict

from .llama_wrapper import LlamaClient
from ..utils.json_parser import (
    extract_json_from_text,
    build_patch_prompt,
    parse_json_or_none,
)
from ..utils.validators import validate_dream, repair_dream, safe_patch

logger = logging.getLogger("patch-service")
client = LlamaClient()


def apply_patch(
    base_json: Dict[str, Any], edit_text: str, options: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Attempts to apply an AI patch via LlamaClient; if parsing/validation fails, falls back to safe rule-based patch.
    """
    options = options or {}

    try:
        prompt = build_patch_prompt(base_json, edit_text, options)
        logger.debug("Patch prompt length: %d", len(prompt))
        response_text = client.generate(
            prompt,
            max_tokens=options.get("max_tokens", 1200),
            temperature=options.get("temperature", 0.7),
        )
        logger.debug(
            "LLM patch response length: %d",
            len(response_text) if isinstance(response_text, str) else 0,
        )

        # Try to parse JSON out of response
        patched = extract_json_from_text(response_text)
        if not patched:
            # maybe the remote returned a JSON string; try parse entire text
            patched = parse_json_or_none(response_text)

        if not patched or not isinstance(patched, dict):
            logger.warning("LLM did not return JSON for patch; using safe fallback")
            patched = safe_patch(base_json, edit_text)
            patched["assumptions"] = patched.get("assumptions", []) + [
                "used_safe_fallback"
            ]
            return patched

        # Validate
        valid, errors = validate_dream(patched)
        if not valid:
            logger.warning("Patched dream failed validation: %s", errors)
            # try to repair
            repaired = repair_dream(patched)
            v2, errs2 = validate_dream(repaired)
            if v2:
                repaired.setdefault("assumptions", []).append(
                    "auto-repaired after validation errors"
                )
                return repaired
            else:
                logger.warning("Repair failed, returning safe fallback")
                fallback = safe_patch(base_json, edit_text)
                fallback.setdefault("assumptions", []).append(
                    "fallback_after_failed_repair"
                )
                return fallback

        # Keep the ID of original dream if ID missing
        if "id" not in patched and "id" in base_json:
            patched["id"] = base_json["id"]

        # Add metadata about patch
        patched.setdefault("patchHistory", []).append(
            {
                "editText": edit_text,
                "appliedAt": __import__("time").strftime(
                    "%Y-%m-%dT%H:%M:%SZ", __import__("time").gmtime()
                ),
                "source": "llama-stylist",
            }
        )

        return patched

    except Exception as e:
        logger.exception("apply_patch failed: %s", e)
        # fallback
        fallback = safe_patch(base_json, edit_text)
        fallback.setdefault("assumptions", []).append("fallback_on_exception")
        return fallback
