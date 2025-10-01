# services/llama-stylist/services/style_service.py
"""
Style enrichment service. Attempts to use LLM via LlamaClient to enrich the base dream to a target style.
Exports: enrich_style(base_json, target_style, options=None)
"""

import logging
import json
from typing import Optional, Dict, Any

from .llama_wrapper import LlamaClient
from ..utils.json_parser import (
    extract_json_from_text,
    build_style_prompt,
    parse_json_or_none,
)
from ..utils.validators import validate_dream, repair_dream
from ..utils.style_mapper import apply_style as apply_style_map
from ..utils.validators import safe_patch

logger = logging.getLogger("style-service")
client = LlamaClient()


def enrich_style(
    base_json: Dict[str, Any],
    target_style: str,
    options: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Enrich the base JSON to match target_style. Use LLM if possible; otherwise apply deterministic style mapping.
    """
    options = options or {}
    try:
        prompt = build_style_prompt(base_json, target_style, options)
        response_text = client.generate(
            prompt,
            max_tokens=options.get("max_tokens", 800),
            temperature=options.get("temperature", 0.7),
        )

        parsed = extract_json_from_text(response_text) or parse_json_or_none(
            response_text
        )

        if not parsed or not isinstance(parsed, dict):
            logger.warning(
                "LLM style enrichment did not return JSON; using deterministic mapper"
            )
            enriched = apply_style_map(base_json, target_style)
            enriched.setdefault("assumptions", []).append(
                "applied_deterministic_style_mapper"
            )
            return enriched

        valid, errors = validate_dream(parsed)
        if not valid:
            logger.warning(
                "Enriched result failed validation: %s; attempting repair", errors
            )
            repaired = repair_dream(parsed)
            v2, errs2 = validate_dream(repaired)
            if v2:
                repaired.setdefault("assumptions", []).append(
                    "repaired_enriched_result"
                )
                return repaired
            else:
                logger.warning("Repair failed - returning deterministic mapper result")
                enriched = apply_style_map(base_json, target_style)
                enriched.setdefault("assumptions", []).append(
                    "fallback_after_failed_repair"
                )
                return enriched

        # merge minimal metadata and return
        parsed.setdefault("style", target_style)
        parsed.setdefault("metadata", {}).update(
            {"enrichedBy": "llama-stylist", "targetStyle": target_style}
        )
        return parsed

    except Exception as e:
        logger.exception("enrich_style failed: %s", e)
        enriched = apply_style_map(base_json, target_style)
        enriched.setdefault("assumptions", []).append("fallback_on_exception")
        return enriched
