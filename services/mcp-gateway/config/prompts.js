// services/mcp-gateway/config/prompts.js
// Centralized prompt templates used by promptBuilder.js
// This way you can tweak style across all services without touching core logic.

const SCHEMA_REQUIREMENTS = `
Return only valid JSON that matches the Dream Scene schema:
{
  "id": "string",
  "title": "string",
  "style": "ethereal|noir|cyberpunk|fantasy|dreamlike|other",
  "seed": "integer",
  "environment": {
    "preset": "forest|desert|ocean|space|urban|dreamscape|custom",
    "lighting": "soft|harsh|glowing|dynamic",
    "time": "dawn|day|dusk|night|timeless"
  },
  "structures": [ { "id": "string", "template": "pyramid|tower|bridge|tree|temple|portal|other",
                    "pos": [x,y,z], "scale": "float", "rotation": "float?", "features": {} } ],
  "entities": [ { "id": "string", "type": "bird|fish|spirit|human|creature|other",
                  "count": "int", "params": {} } ],
  "cinematography": {
    "durationSec": "int",
    "shots": [ { "type": "pan|zoom|orbit|track|cut|dolly",
                 "target": "structureId|entityId?",
                 "duration": "int",
                 "startPos": [x,y,z]?,
                 "endPos": [x,y,z]? } ]
  },
  "render": {
    "res": [width, height],
    "fps": "int",
    "quality": "draft|medium|high"
  }
}
`;

const PROMPTS = {
  parse: `
You are a Dream-to-3D-scene generator.
Convert the user's dream description into a Dream Scene JSON.
${SCHEMA_REQUIREMENTS}
Respond with ONLY JSON.
`,

  patch: `
You are an assistant that modifies an existing Dream Scene JSON.
You will be given a base JSON and an edit instruction.
Apply minimal necessary changes, keep schema valid.
${SCHEMA_REQUIREMENTS}
Respond with ONLY JSON.
`,

  styleEnrich: `
You are a style-enrichment assistant.
Adjust environment, lighting, and entity parameters to match a requested style.
Preserve IDs and cinematography where possible.
${SCHEMA_REQUIREMENTS}
Respond with ONLY JSON.
`,
};

module.exports = PROMPTS;
