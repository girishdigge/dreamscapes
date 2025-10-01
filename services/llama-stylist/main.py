# services/llama-stylist/main.py
"""
LLaMA Stylist - FastAPI microservice
Provides endpoints:
  - GET  /health
  - POST /patch        (body: { baseJson, editText, options? })
  - POST /style        (body: { baseJson, targetStyle, options? })

This file will try to import real implementations from services/*.py.
If the import is missing (not yet implemented), it falls back to small deterministic
rule-based stub functions so the service remains usable for development / healthchecks.
"""

import os
import time
import logging
from typing import Optional, Dict, Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Import structured logger
from utils.logger import logger, create_logging_middleware, log_startup, log_exception

app = FastAPI(title="LLaMA Stylist", version="1.0.0")

# CORS - allow frontend origin or all in dev
FRONTEND_URL = os.environ.get("FRONTEND_URL", "*")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL] if FRONTEND_URL != "*" else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add request logging middleware
app.middleware("http")(create_logging_middleware())


# Pydantic request models
class PatchRequest(BaseModel):
    baseJson: Dict[str, Any]
    editText: str
    options: Optional[Dict[str, Any]] = None


class StyleRequest(BaseModel):
    baseJson: Dict[str, Any]
    targetStyle: str
    options: Optional[Dict[str, Any]] = None


# Try to import the real implementations (will be generated later).
# If they're missing, provide lightweight local fallbacks so the service can start.
try:
    from services.patch_service import apply_patch as real_apply_patch  # type: ignore
    from services.style_service import enrich_style as real_enrich_style  # type: ignore
    from services.llama_wrapper import LlamaClient  # type: ignore

    _HAVE_REAL_IMPL = True
    logger.info("Loaded real patch/style services")
except Exception as e:
    logger.warning("Real services not available; using local stubs", {"error": str(e)})
    _HAVE_REAL_IMPL = False

    # --- Minimal stub implementations (rule-based) -----------------------
    import copy
    import random

    def _ensure_lists(d):
        if "structures" not in d or not isinstance(d["structures"], list):
            d["structures"] = []
        if "entities" not in d or not isinstance(d["entities"], list):
            d["entities"] = []
        if "assumptions" not in d or not isinstance(d["assumptions"], list):
            d["assumptions"] = []

    def stub_apply_patch(
        base_json: Dict[str, Any],
        edit_text: str,
        options: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Very small rule-based patch fallback:
         - looks for color keywords and applies them to entities/environment
         - supports 'add island' or 'add tower'
         - otherwise records the edit in assumptions (safe)
        """
        patched = copy.deepcopy(base_json)
        _ensure_lists(patched)
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

        # Color changes
        for name, hexv in color_map.items():
            if name in edit:
                # update all entity params.color if present
                for e in patched.get("entities", []):
                    e.setdefault("params", {})
                    e["params"]["color"] = hexv
                if patched.get("environment"):
                    patched.setdefault("environment", {})
                    patched["environment"]["skyColor"] = hexv
                applied.append(f"color -> {name}")

        # Add structures
        if "add island" in edit or ("add" in edit and "island" in edit):
            patched["structures"].append(
                {
                    "id": f"added_island_{int(time.time())}",
                    "template": "floating_island",
                    "pos": [
                        random.uniform(-30, 30),
                        15 + random.uniform(0, 5),
                        random.uniform(-30, 30),
                    ],
                    "scale": 0.8,
                    "features": [],
                }
            )
            applied.append("added floating_island")

        if "add tower" in edit or ("add" in edit and "tower" in edit):
            patched["structures"].append(
                {
                    "id": f"added_tower_{int(time.time())}",
                    "template": "crystal_tower",
                    "pos": [
                        random.uniform(-20, 20),
                        10 + random.uniform(0, 20),
                        random.uniform(-20, 20),
                    ],
                    "scale": 1.1,
                    "features": [],
                }
            )
            applied.append("added crystal_tower")

        # Speed modifications
        if any(k in edit for k in ["faster", "speed up", "quick"]):
            for e in patched.get("entities", []):
                p = e.setdefault("params", {})
                p["speed"] = min(10, (p.get("speed", 1.0) * 1.5))
            applied.append("increased speed")

        if any(k in edit for k in ["slower", "calm", "gentle"]):
            for e in patched.get("entities", []):
                p = e.setdefault("params", {})
                p["speed"] = max(0.01, (p.get("speed", 1.0) * 0.7))
            applied.append("decreased speed")

        # If nothing applied, record the edit as assumption (safe)
        if not applied:
            patched.setdefault("assumptions", []).append(
                f'Requested edit recorded: "{edit_text}"'
            )
            applied.append("recorded as assumption")

        patched.setdefault("patchHistory", []).append(
            {
                "editText": edit_text,
                "appliedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "source": "stub",
            }
        )

        patched.setdefault("assumptions", []).append(
            f"Stub patch applied: {', '.join(applied)}"
        )
        return patched

    def stub_enrich_style(
        base_json: Dict[str, Any],
        target_style: str,
        options: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Very small style enrichment fallback: change ambientLight and entity colors depending on style.
        """
        enriched = copy.deepcopy(base_json)
        _ensure_lists(enriched)
        style = (target_style or enriched.get("style") or "ethereal").lower()

        style_map = {
            "ethereal": {
                "ambientLight": 0.9,
                "skyColor": "#a6d8ff",
                "entityColor": "#ffffff",
                "glowMult": 1.1,
            },
            "cyberpunk": {
                "ambientLight": 0.4,
                "skyColor": "#001133",
                "entityColor": "#00ffff",
                "glowMult": 1.6,
            },
            "surreal": {
                "ambientLight": 0.6,
                "skyColor": "#2d1a4a",
                "entityColor": "#ff0080",
                "glowMult": 1.2,
            },
            "fantasy": {
                "ambientLight": 1.1,
                "skyColor": "#ffb347",
                "entityColor": "#ffd700",
                "glowMult": 1.0,
            },
            "nightmare": {
                "ambientLight": 0.25,
                "skyColor": "#1a0d1a",
                "entityColor": "#800020",
                "glowMult": 0.6,
            },
        }

        cfg = style_map.get(style, style_map["ethereal"])

        enriched.setdefault("environment", {})
        enriched["environment"]["ambientLight"] = cfg["ambientLight"]
        enriched["environment"]["skyColor"] = cfg["skyColor"]
        enriched["style"] = style

        for e in enriched.get("entities", []):
            p = e.setdefault("params", {})
            p["color"] = cfg["entityColor"]
            p["glow"] = min(1.0, (p.get("glow", 0.5) * cfg["glowMult"]))

        enriched.setdefault("assumptions", []).append(
            f"Applied stub style enrichment -> {style}"
        )
        return enriched

    # bind to fallback names used below
    real_apply_patch = stub_apply_patch
    real_enrich_style = stub_enrich_style
    # --------------------------------------------------------------------


@app.get("/health")
async def health():
    """
    Basic health endpoint used by docker-compose healthcheck.
    """
    logger.debug("Health check requested")
    info = {
        "service": "llama-stylist",
        "status": "healthy",
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "version": "1.0.0",
        "environment": os.environ.get("NODE_ENV", "development"),
        "impl": "real" if _HAVE_REAL_IMPL else "stub",
    }
    return info


@app.post("/patch")
async def patch_endpoint(req: PatchRequest):
    """
    Apply AI-driven patch to an existing dream JSON.
    """
    start = time.time()

    logger.info(
        "Patch request received",
        {
            "editTextLength": len(req.editText),
            "hasOptions": bool(req.options),
            "impl": "real" if _HAVE_REAL_IMPL else "stub",
        },
    )

    try:
        patched = real_apply_patch(req.baseJson, req.editText, req.options)
        elapsed = int((time.time() - start) * 1000)

        logger.log_ai_operation(
            "patch",
            elapsed,
            True,
            {
                "editText": (
                    req.editText[:100] + "..."
                    if len(req.editText) > 100
                    else req.editText
                ),
                "impl": "real" if _HAVE_REAL_IMPL else "stub",
            },
        )

        return {
            "success": True,
            "data": patched,
            "metadata": {
                "source": "llama-stylist",
                "processingTimeMs": elapsed,
            },
        }
    except Exception as e:
        elapsed = int((time.time() - start) * 1000)
        logger.log_ai_operation(
            "patch",
            elapsed,
            False,
            {
                "error": str(e),
                "editText": (
                    req.editText[:100] + "..."
                    if len(req.editText) > 100
                    else req.editText
                ),
            },
        )
        log_exception(e, {"operation": "patch", "editText": req.editText})
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/style")
async def style_endpoint(req: StyleRequest):
    """
    Enrich an existing dream JSON with a style (colors/lighting/entity params).
    """
    start = time.time()

    logger.info(
        "Style enrichment request received",
        {
            "targetStyle": req.targetStyle,
            "hasOptions": bool(req.options),
            "impl": "real" if _HAVE_REAL_IMPL else "stub",
        },
    )

    try:
        enriched = real_enrich_style(req.baseJson, req.targetStyle, req.options)
        elapsed = int((time.time() - start) * 1000)

        logger.log_ai_operation(
            "style_enrichment",
            elapsed,
            True,
            {
                "targetStyle": req.targetStyle,
                "impl": "real" if _HAVE_REAL_IMPL else "stub",
            },
        )

        return {
            "success": True,
            "data": enriched,
            "metadata": {
                "source": "llama-stylist",
                "processingTimeMs": elapsed,
                "targetStyle": req.targetStyle,
            },
        }
    except Exception as e:
        elapsed = int((time.time() - start) * 1000)
        logger.log_ai_operation(
            "style_enrichment",
            elapsed,
            False,
            {"error": str(e), "targetStyle": req.targetStyle},
        )
        log_exception(
            e, {"operation": "style_enrichment", "targetStyle": req.targetStyle}
        )
        raise HTTPException(status_code=500, detail=str(e))


# If run directly (useful in local development)
if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", 8002))
    environment = os.environ.get("NODE_ENV", "development")

    log_startup(
        port=port,
        environment=environment,
        impl="real" if _HAVE_REAL_IMPL else "stub",
        reload=os.environ.get("DEV_RELOAD", "true").lower() in ("1", "true"),
    )

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        reload=os.environ.get("DEV_RELOAD", "true").lower() in ("1", "true"),
    )
