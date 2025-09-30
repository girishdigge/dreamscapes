// services/mcp-gateway/utils/responseParser.js
// Convert raw LLM responses into usable JSON scene objects.
// Attempts multiple strategies: direct JSON, choices[].message.content, extracting JSON substring.

function _extractJsonString(text) {
  if (!text || typeof text !== 'string') return null;

  // Try to find the first { ... } block with balanced braces
  const firstBrace = text.indexOf('{');
  if (firstBrace === -1) return null;

  // Attempt to find balanced closing brace
  let depth = 0;
  let start = -1;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '{') {
      if (start === -1) start = i;
      depth++;
    } else if (text[i] === '}') {
      depth--;
      if (depth === 0 && start !== -1) {
        const candidate = text.slice(start, i + 1);
        return candidate;
      }
    }
  }

  // Fallback: regex try to match {...}
  const regexMatch = text.match(/(\{[\s\S]*\})/);
  return regexMatch ? regexMatch[1] : null;
}

function _normalizeRawResponse(raw) {
  // raw could be object (API full response) or a string
  if (!raw) return null;

  // If OpenAI / Cerebras style: { choices: [{ message: { content } }] }
  if (typeof raw === 'object') {
    // OpenAI style
    if (raw.choices && Array.isArray(raw.choices) && raw.choices.length > 0) {
      const choice = raw.choices[0];
      // Chat-style
      if (choice.message && choice.message.content) {
        return choice.message.content;
      }
      // old style
      if (choice.text) return choice.text;
    }

    // Cerebras or other API might put text in `output_text` or similar
    if (raw.output && typeof raw.output === 'string') return raw.output;
    if (raw.data && typeof raw.data === 'string') return raw.data;
    if (raw.text && typeof raw.text === 'string') return raw.text;

    // If it's already a JSON scene (object) — return as stringified
    // So parse functions can accept object directly
    try {
      return JSON.stringify(raw);
    } catch (e) {
      // ignore
    }
  }

  // If string, return directly
  if (typeof raw === 'string') {
    return raw;
  }

  return null;
}

function parseDreamResponse(raw, source = 'unknown') {
  try {
    // Try to normalize to a string we can parse
    const normalized = _normalizeRawResponse(raw);

    if (!normalized) return null;

    // If normalized is already a JSON string representing full object
    // Attempt JSON.parse directly
    try {
      const maybeObj = JSON.parse(normalized);
      // If it's the full API wrapper, try to drill down again
      if (
        maybeObj &&
        (maybeObj.structures || maybeObj.entities || maybeObj.cinematography)
      ) {
        return maybeObj;
      }
      // If not a scene object, continue extracting
    } catch (err) {
      // not direct JSON, try extracting JSON block
    }

    // Try to extract a JSON substring and parse
    const jsonStr = _extractJsonString(normalized);
    if (jsonStr) {
      try {
        const parsed = JSON.parse(jsonStr);
        return parsed;
      } catch (parseErr) {
        // attempt tiny fixes (replace trailing commas)
        const tidy = jsonStr.replace(/,\s*([}\]])/g, '$1');
        try {
          return JSON.parse(tidy);
        } catch (err2) {
          // give up
        }
      }
    }

    // As last resort, if the normalized content is likely YAML-like, attempt naive conversion (not implemented)
    return null;
  } catch (err) {
    return null;
  }
}

function parsePatchResponse(raw, baseJson, source = 'unknown') {
  // Similar strategy to parseDreamResponse, produce full patched JSON.
  const parsed = parseDreamResponse(raw, source);
  if (!parsed) {
    return null;
  }

  // If parsed doesn't contain expected top-level fields, try to merge
  if (!parsed.id && baseJson && baseJson.id) {
    parsed.id = parsed.id || baseJson.id;
  }
  return parsed;
}

function parseStyleResponse(raw, baseJson, source = 'unknown') {
  const parsed = parseDreamResponse(raw, source);
  if (!parsed) return null;

  // If server returns only modifications, merge with baseJson
  if (
    !parsed.structures &&
    baseJson &&
    (baseJson.structures || parsed.structures)
  ) {
    // naive merge: overlay parsed onto baseJson
    return { ...baseJson, ...parsed };
  }

  return parsed;
}

module.exports = {
  parseDreamResponse,
  parsePatchResponse,
  parseStyleResponse,
};
