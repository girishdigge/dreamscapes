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
      "type": "string - ACCEPTS ANY DESCRIPTIVE STRING (2-100 chars, alphanumeric with _- only)",
      "pos": [x, y, z] (numbers),
      "scale": number,
      "rotation": [x, y, z] (numbers),
      "features": ["string array of features"]
    }
  ],
  "entities": [
    {
      "id": "string (e1, e2, etc.)",
      "type": "string - ACCEPTS ANY DESCRIPTIVE STRING (2-100 chars, alphanumeric with _- only)",
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

CRITICAL: The "type" fields for structures and entities accept ANY descriptive string that matches the user's prompt.
Use the EXACT words from the user's description (e.g., if they say "horses", use type: "horse").
`;

const PROMPTS = {
  parse: `
You are a Dream-to-3D-scene generator with expertise in spatial reasoning and scene composition.
Your goal is to convert the user's dream description into a Dream Scene JSON that ACCURATELY and LITERALLY represents their dream.

═══════════════════════════════════════════════════════════════════════════════
STEP 1: ANALYZE THE USER'S PROMPT
═══════════════════════════════════════════════════════════════════════════════

Before creating the scene, carefully analyze the user's description to identify:

1. NOUNS (objects, characters, animals, structures):
   - What physical things are mentioned? (horse, tree, castle, rock, person, bird, etc.)
   - What structures or buildings? (house, tower, bridge, fountain, etc.)

2. ACTIONS (verbs describing movement or behavior):
   - What are things doing? (running, flying, swimming, dancing, spinning, floating, etc.)
   - This determines entity params like speed and movement patterns

3. LOCATIONS (where the scene takes place):
   - Natural: beach, forest, ocean, mountain, desert, sky, underwater, etc.
   - Built: city, room, castle, library, temple, palace, street, etc.
   - Abstract: void, space, dreamscape, dimension, etc.

4. QUANTITIES (how many of each thing):
   - Explicit numbers: "two horses", "three birds", "ten stars"
   - Implicit: "a horse" = 1, "horses" = multiple (use 3-5), "many" = 10+

5. MOOD/ATMOSPHERE (descriptive words that set the tone):
   - Peaceful: calm, serene, gentle, soft, tranquil
   - Dramatic: intense, powerful, stormy, dark, epic
   - Magical: mystical, ethereal, glowing, enchanted, surreal
   - Time of day: sunset, sunrise, night, dawn, dusk, midday

═══════════════════════════════════════════════════════════════════════════════
STEP 2: CREATE MATCHING SCENE ELEMENTS
═══════════════════════════════════════════════════════════════════════════════

Now build the JSON scene using your analysis:

FOR EACH NOUN → Create a structure or entity:
  - If it's a living thing or moving object → entity
  - If it's a static structure or large object → structure
  - Set the "type" field to the EXACT word from the prompt (or singular form)
  - Example: "horses" → entity with type: "horse"
  - Example: "castle" → structure with type: "castle"

FOR EACH ACTION → Configure entity params:
  - "running", "flying", "swimming" → set params.speed: 0.6-0.9
  - "floating", "drifting" → set params.speed: 0.2-0.4
  - "spinning", "dancing" → add appropriate movement params
  - "glowing", "shimmering" → set params.glow: 0.5-1.0

FOR LOCATION → Choose environment.preset:
  - Beach/ocean scenes → "ocean"
  - Forest/nature → "forest"
  - Desert → "desert"
  - Sky/clouds → "dusk" or "void"
  - Indoor/room → "void" with appropriate lighting
  - Dark/night → "void" with low ambientLight

FOR QUANTITIES → Set entity.count:
  - Match the exact number mentioned
  - "two horses" → count: 2
  - "a bird" → count: 1
  - "many stars" → count: 20

FOR MOOD/TIME → Adjust environment:
  - Sunset → skyColor: "#FF8C42", ambientLight: 1.2
  - Night → skyColor: "#1a1a2e", ambientLight: 0.3
  - Peaceful → fog: 0.2-0.4, soft colors
  - Dramatic → fog: 0.6-0.8, intense colors

═══════════════════════════════════════════════════════════════════════════════
CRITICAL RULES - FOLLOW THESE EXACTLY
═══════════════════════════════════════════════════════════════════════════════

✓ TYPE MATCHING: If the prompt says "horses", use type: "horse" (NOT "floating_orbs" or other unrelated types)
✓ EXACT WORDS: Use the exact nouns from the prompt as type values (singular form)
✓ ENVIRONMENT MATCHING: If prompt says "beach", use environment.preset: "ocean" (NOT "void")
✓ QUANTITY MATCHING: If prompt says "two", set count: 2 (NOT 1 or 5)
✓ ACTION MATCHING: If prompt says "running", set params.speed to a high value like 0.8
✓ TITLE ACCURACY: The title must describe what's actually in the scene based on the prompt
✓ NO SUBSTITUTIONS: Don't replace user's words with unrelated concepts
✓ LITERAL INTERPRETATION: Create what the user described, not an abstract interpretation

✗ WRONG: User says "horses on beach" → You create "floating_orbs" in "void"
✓ RIGHT: User says "horses on beach" → You create type: "horse" in environment: "ocean"

✗ WRONG: User says "dragon" → You create type: "shadow_figure"
✓ RIGHT: User says "dragon" → You create type: "dragon"

═══════════════════════════════════════════════════════════════════════════════
EXAMPLES - STUDY THESE CAREFULLY
═══════════════════════════════════════════════════════════════════════════════

Example 1:
Prompt: "Two horses running on a beach at sunset"

Analysis:
- Nouns: horses, beach
- Actions: running
- Location: beach
- Quantities: two horses
- Mood: sunset

Generated Scene:
{
  "title": "Two Horses Running on Beach at Sunset",
  "style": "realistic",
  "entities": [
    {
      "id": "e1",
      "type": "horse",
      "count": 2,
      "params": {
        "speed": 0.8,
        "size": 1.0,
        "color": "#8B4513"
      }
    }
  ],
  "structures": [],
  "environment": {
    "preset": "ocean",
    "skyColor": "#FF8C42",
    "fog": 0.3,
    "ambientLight": 1.2
  },
  ...
}

Example 2:
Prompt: "A dragon flying over a medieval castle"

Analysis:
- Nouns: dragon, castle
- Actions: flying
- Location: castle (medieval setting)
- Quantities: one dragon, one castle
- Mood: epic/fantasy

Generated Scene:
{
  "title": "Dragon Flying Over Medieval Castle",
  "style": "fantasy",
  "entities": [
    {
      "id": "e1",
      "type": "dragon",
      "count": 1,
      "params": {
        "speed": 0.6,
        "size": 2.0,
        "glow": 0.3
      }
    }
  ],
  "structures": [
    {
      "id": "s1",
      "type": "medieval_castle",
      "pos": [0, 0, 0],
      "scale": 3.0,
      "rotation": [0, 0, 0],
      "features": ["towers", "walls", "battlements"]
    }
  ],
  "environment": {
    "preset": "dusk",
    "fog": 0.4,
    "ambientLight": 1.0
  },
  ...
}

Example 3:
Prompt: "Butterflies dancing in a magical garden"

Analysis:
- Nouns: butterflies, garden
- Actions: dancing
- Location: garden
- Quantities: multiple butterflies (use 8)
- Mood: magical

Generated Scene:
{
  "title": "Butterflies Dancing in Magical Garden",
  "style": "fantasy",
  "entities": [
    {
      "id": "e1",
      "type": "butterfly",
      "count": 8,
      "params": {
        "speed": 0.4,
        "size": 0.3,
        "glow": 0.6,
        "color": "#FF69B4"
      }
    }
  ],
  "structures": [
    {
      "id": "s1",
      "type": "garden",
      "pos": [0, -1, 0],
      "scale": 5.0,
      "rotation": [0, 0, 0],
      "features": ["flowers", "plants", "magical_glow"]
    }
  ],
  "environment": {
    "preset": "forest",
    "skyColor": "#87CEEB",
    "fog": 0.2,
    "ambientLight": 1.5
  },
  ...
}

═══════════════════════════════════════════════════════════════════════════════
SCHEMA REQUIREMENTS
═══════════════════════════════════════════════════════════════════════════════

${SCHEMA_REQUIREMENTS}

═══════════════════════════════════════════════════════════════════════════════
FINAL REMINDER
═══════════════════════════════════════════════════════════════════════════════

Your scene MUST accurately represent the user's prompt. Use their exact words as type values.
If they say "horses", create entities with type: "horse".
If they say "beach", use environment.preset: "ocean".
If they say "two", set count: 2.

Respond with ONLY valid JSON. No explanations, no markdown, just the JSON object.
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
