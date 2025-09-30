// templates/BaseTemplates.js
// Core prompt templates for different content types

class BaseTemplates {
  constructor() {
    this.templates = {
      dream_generation: {
        name: 'dream_generation',
        description: 'Base template for dream content generation',
        template: `You are an expert dream interpreter and 3D scene designer. Your task is to transform dream descriptions into detailed, structured data for 3D scene generation and video creation.

INPUT: {input}

INSTRUCTIONS:
1. Analyze the dream description for key visual elements, emotions, and narrative structure
2. Create a detailed 3D scene specification with objects, lighting, and spatial relationships
3. Generate cinematography guidance for video generation including camera movements and transitions
4. Ensure all output follows the required JSON schema for the rendering pipeline

REQUIRED OUTPUT FORMAT:
{
  "title": "Brief, evocative title for the dream",
  "description": "Enhanced, detailed description expanding on the original",
  "scenes": [
    {
      "id": "scene_1",
      "environment": "detailed environment description",
      "objects": [
        {
          "type": "object type",
          "position": {"x": 0, "y": 0, "z": 0},
          "properties": "visual and behavioral properties"
        }
      ],
      "lighting": {
        "type": "lighting type",
        "color": "color specification",
        "intensity": "intensity level"
      },
      "atmosphere": "mood and atmospheric details"
    }
  ],
  "cinematography": {
    "shots": [
      {
        "type": "shot type",
        "duration": "duration in seconds",
        "camera": {
          "position": {"x": 0, "y": 0, "z": 0},
          "target": {"x": 0, "y": 0, "z": 0},
          "movement": "camera movement description"
        }
      }
    ],
    "transitions": ["transition descriptions"],
    "effects": ["visual effects to apply"]
  }
}

Focus on creating immersive, visually rich scenes that capture the essence and emotion of the dream.`,
        variables: ['input'],
        validation: {
          required: ['title', 'description', 'scenes', 'cinematography'],
          scenes_min: 1,
          shots_min: 1,
        },
      },

      scene_refinement: {
        name: 'scene_refinement',
        description: 'Template for refining and enhancing existing scenes',
        template: `You are refining a 3D dream scene based on feedback or additional context.

ORIGINAL SCENE: {original_scene}
REFINEMENT REQUEST: {refinement_request}
ADDITIONAL CONTEXT: {context}

INSTRUCTIONS:
1. Analyze the original scene and the refinement request
2. Enhance the scene while maintaining its core identity
3. Add more detail, improve visual elements, or adjust based on the request
4. Ensure the refined scene maintains compatibility with the rendering pipeline

OUTPUT the refined scene in the same JSON format as the original, with improvements applied.`,
        variables: ['original_scene', 'refinement_request', 'context'],
        validation: {
          required: ['title', 'description', 'scenes'],
          maintain_structure: true,
        },
      },

      video_generation: {
        name: 'video_generation',
        description: 'Template specifically for video generation guidance',
        template: `You are a cinematographer and video director specializing in dream-like, surreal content.

SCENE DATA: {scene_data}
VIDEO REQUIREMENTS: {video_requirements}

INSTRUCTIONS:
1. Create detailed cinematography instructions for the given scene
2. Design camera movements that enhance the dream-like quality
3. Specify transitions and effects that maintain visual continuity
4. Ensure the video captures the emotional essence of the dream

FOCUS ON:
- Smooth, flowing camera movements
- Appropriate pacing for dream content
- Visual effects that enhance rather than distract
- Seamless transitions between different scene elements

OUTPUT detailed cinematography instructions in JSON format.`,
        variables: ['scene_data', 'video_requirements'],
        validation: {
          required: ['shots', 'transitions'],
          shots_min: 1,
        },
      },

      content_repair: {
        name: 'content_repair',
        description: 'Template for repairing malformed or incomplete content',
        template: `You are fixing malformed or incomplete dream scene data.

PROBLEMATIC CONTENT: {content}
IDENTIFIED ISSUES: {issues}
EXPECTED SCHEMA: {schema}

INSTRUCTIONS:
1. Analyze the problematic content and identified issues
2. Repair structural problems while preserving the original intent
3. Fill in missing required fields with appropriate default values
4. Ensure the repaired content validates against the expected schema

OUTPUT the corrected content in proper JSON format.`,
        variables: ['content', 'issues', 'schema'],
        validation: {
          repair_mode: true,
          preserve_intent: true,
        },
      },
    };
  }

  getTemplate(name) {
    return this.templates[name] || null;
  }

  getAllTemplates() {
    return Object.keys(this.templates);
  }

  validateTemplate(template) {
    const required = ['name', 'description', 'template', 'variables'];
    return required.every((field) => template.hasOwnProperty(field));
  }

  renderTemplate(name, variables = {}) {
    const template = this.getTemplate(name);
    if (!template) {
      throw new Error(`Template '${name}' not found`);
    }

    let rendered = template.template;

    // Replace variables in the template
    template.variables.forEach((variable) => {
      const placeholder = `{${variable}}`;
      const value = variables[variable] || `[${variable}_NOT_PROVIDED]`;
      rendered = rendered.replace(new RegExp(placeholder, 'g'), value);
    });

    return {
      content: rendered,
      metadata: {
        template: name,
        variables: template.variables,
        validation: template.validation,
      },
    };
  }
}

module.exports = BaseTemplates;
