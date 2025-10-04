// services/mcp-gateway/config/prompts.js
// Centralized prompt templates used by promptBuilder.js
// This way you can tweak style across all services without touching core logic.

const SCHEMA_REQUIREMENTS = `
Return only valid JSON that matches the Dream Scene schema:
{
  "id": "string (UUID)",
  "title": "string (describe what's in the scene)",
  "style": "string (ethereal, noir, cyberpunk, fantasy, surreal, etc.)",
  "structures": [
    {
      "id": "string (s1, s2, etc.)",
      "type": "string (describe the structure: house, tower, rock, tree, building, etc.)",
      "pos": [x, y, z] (numbers),
      "scale": number,
      "rotation": [x, y, z] (numbers),
      "features": ["string array of features"]
    }
  ],
  "entities": [
    {
      "id": "string (e1, e2, etc.)",
      "type": "string (describe the entity: horse, bird, person, creature, etc.)",
      "count": number,
      "params": {
        "speed": number,
        "glow": number,
        "size": number,
        "color": "string (hex color)"
      }
    }
  ],
  "cinematography": {
    "durationSec": number (30 recommended),
    "shots": [
      {
        "type": "string (establish, flythrough, orbit, etc.)",
        "target": "string (structure or entity id)",
        "duration": number,
        "startPos": [x, y, z],
        "endPos": [x, y, z]
      }
    ]
  },
  "environment": {
    "preset": "string (ocean, forest, desert, void, dusk, etc.)",
    "fog": number (0-1),
    "skyColor": "string (hex color)",
    "ambientLight": number (0-2)
  },
  "render": {
    "res": [1280, 720],
    "fps": 30,
    "quality": "medium"
  },
  "metadata": {
    "generatedAt": "ISO timestamp",
    "source": "cerebras",
    "version": "1.0.0",
    "originalText": "string (the user's dream text)",
    "requestedStyle": "string"
  },
  "created": "ISO timestamp",
  "source": "cerebras"
}

IMPORTANT: 
- Use descriptive "type" values that match the dream content (e.g., "horse", "beach_rock", "palm_tree")
- Choose environment.preset that matches the dream location (e.g., "ocean" for beach scenes)
- Make structures and entities represent what's actually in the dream
`;

const PROMPTS = {
  parse: `
You are a Dream-to-3D-scene generator.
Convert the user's dream description into a Dream Scene JSON that ACCURATELY represents their dream.

CRITICAL INSTRUCTIONS:
1. READ the user's dream description carefully
2. IDENTIFY the key elements (characters, objects, locations, actions)
3. CREATE structures and entities that MATCH those elements
4. If the dream mentions "horses", create horse entities
5. If the dream mentions "beach", use ocean/beach environment
6. If the dream mentions specific objects, create corresponding structures
7. The title should reflect the actual dream content
8. Make the scene visually represent what the user described

${SCHEMA_REQUIREMENTS}

IMPORTANT: Your structures and entities MUST match the user's dream description.
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
