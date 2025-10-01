# services/llama-stylist/services/llama_wrapper.py
"""
LlamaClient abstraction:
- If LLM_API_URL is set, calls the remote LLM API with JSON payload { prompt, max_tokens, temperature } and returns a text response.
- Otherwise acts as a local stub that can handle prompts produced by this service (patch/style prompts).
"""

import os
import json
import logging
import requests
import re
from typing import Optional

from ..utils.json_parser import extract_json_from_text, parse_json_or_none
from ..utils.validators import safe_patch as fallback_patch
from ..utils.style_mapper import apply_style as fallback_style

logger = logging.getLogger("llama-wrapper")
LLM_API_URL = os.environ.get("LLM_API_URL")  # e.g., http://remote-llm:9000/generate
LLM_API_KEY = os.environ.get("LLM_API_KEY")
DEFAULT_TIMEOUT = int(os.environ.get("LLM_TIMEOUT_MS", 20000)) / 1000.0


class LlamaClient:
    def __init__(self, api_url: Optional[str] = None, api_key: Optional[str] = None):
        self.api_url = api_url or LLM_API_URL
        self.api_key = api_key or LLM_API_KEY
        self.session = requests.Session()
        logger.info("LlamaClient initialized; remote=%s", bool(self.api_url))

    def _call_remote(
        self, prompt: str, max_tokens: int = 1500, temperature: float = 0.7
    ) -> str:
        if not self.api_url:
            raise RuntimeError("Remote LLM not configured")
        payload = {
            "prompt": prompt,
            "max_tokens": int(max_tokens),
            "temperature": float(temperature),
        }
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        resp = self.session.post(
            self.api_url, json=payload, headers=headers, timeout=DEFAULT_TIMEOUT
        )
        try:
            resp.raise_for_status()
        except Exception as e:
            logger.exception("Remote LLM error: %s", e)
            raise

        try:
            data = resp.json()
        except Exception:
            # return raw text if response isn't JSON
            return resp.text

        # remote API shapes vary; try common fields
        if isinstance(data, dict):
            if "text" in data:
                return data["text"]
            if "output" in data:
                return data["output"]
            if (
                "choices" in data
                and isinstance(data["choices"], list)
                and len(data["choices"]) > 0
            ):
                c = data["choices"][0]
                if isinstance(c, dict):
                    # chat-style
                    if c.get("message") and c["message"].get("content"):
                        return c["message"]["content"]
                    if c.get("text"):
                        return c["text"]
                elif isinstance(c, str):
                    return c
            # fallback: stringify
            return json.dumps(data)

        return str(data)

    def _local_stub_from_prompt(self, prompt: str) -> str:
        """
        Minimal prompt-aware local stub:
         - If prompt contains "Base Dream JSON:" and "Edit Instruction:" -> parse base JSON and apply fallback_patch
         - If prompt contains "Base Dream JSON:" and "Requested Style:" or "Target style" -> parse base and apply fallback_style
         - Otherwise return a safe fallback message (string)
        """
        # Try to find a JSON block in the prompt
        json_block = None

        # Patterns used by our json_parser.build_*_prompt (we include the literal markers)
        base_match = re.search(
            r"Base Dream JSON:\s*(\{[\s\S]*\})\s*(?:Edit Instruction:|Requested Style:)",
            prompt,
        )
        if base_match:
            json_block = base_match.group(1)
            try:
                base = json.loads(json_block)
            except Exception:
                base = parse_json_or_none(json_block)
        else:
            # alternative: detect "User dream" -> return empty
            base = None

        # Patch case
        edit_match = re.search(
            r"Edit Instruction:\s*\"?([^\n\"].*?)\"?\s*$", prompt, re.DOTALL
        )
        if edit_match and base is not None:
            edit = edit_match.group(1).strip()
            patched = fallback_patch(base, edit)
            return json.dumps(patched)

        # Style case
        style_match = re.search(
            r"Requested Style:\s*\"?([^\n\"].*?)\"?\s*$", prompt, re.DOTALL
        )
        if style_match and base is not None:
            style = style_match.group(1).strip()
            enriched = fallback_style(base, style)
            return json.dumps(enriched)

        # If prompt contains just a "User dream:" produce a simple fallback JSON scene
        user_match = re.search(r"User dream:\s*(.*)$", prompt, re.DOTALL)
        if user_match:
            # naive fallback: create a tiny scene
            text = user_match.group(1).strip()
            fallback = {
                "id": f"local_{abs(hash(text)) % 100000}",
                "title": (text[:48] + "...") if len(text) > 50 else text,
                "style": "ethereal",
                "seed": 12345,
                "environment": {
                    "preset": "dusk",
                    "fog": 0.3,
                    "skyColor": "#a6d8ff",
                    "ambientLight": 0.8,
                },
                "structures": [
                    {
                        "id": "s1",
                        "template": "floating_library",
                        "pos": [0, 20, 0],
                        "scale": 1,
                    }
                ],
                "entities": [
                    {
                        "id": "e1",
                        "type": "book_swarm",
                        "count": 20,
                        "params": {"speed": 1.0, "glow": 0.7, "color": "#ffffff"},
                    }
                ],
                "cinematography": {
                    "durationSec": 30,
                    "shots": [{"type": "establish", "target": "s1", "duration": 30}],
                },
                "render": {"res": [1280, 720], "fps": 30, "quality": "draft"},
            }
            return json.dumps(fallback)

        # As a last resort, echo back the prompt to help debugging
        return json.dumps(
            {"error": "local_stub_could_not_handle_prompt", "promptStart": prompt[:400]}
        )

    def generate(
        self, prompt: str, max_tokens: int = 1500, temperature: float = 0.7
    ) -> str:
        """
        Return text output from the selected backend (remote or local stub).
        """
        try:
            if self.api_url:
                return self._call_remote(
                    prompt, max_tokens=max_tokens, temperature=temperature
                )
            else:
                return self._local_stub_from_prompt(prompt)
        except Exception as e:
            logger.exception("LLM generate failed, falling back to local stub: %s", e)
            return self._local_stub_from_prompt(prompt)
