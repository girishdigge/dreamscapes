// templates/QualityTemplates.js
// Quality-specific templates for different output quality levels

class QualityTemplates {
  constructor() {
    this.qualities = {
      draft: {
        name: 'draft',
        description: 'Quick draft quality for rapid iteration',
        specifications: {
          detail_level: 'basic',
          scene_complexity: 'simple',
          object_count: 'minimal',
          effects: 'basic',
          rendering_time: 'fast',
        },
        prompt_additions: `
DRAFT QUALITY SPECIFICATIONS:
- Create basic scene layouts with essential elements only
- Use simple lighting setups and minimal effects
- Focus on core composition and basic object placement
- Prioritize speed over detail
- Generate 1-3 key objects per scene
- Use standard camera angles and movements`,
        constraints: {
          max_objects_per_scene: 5,
          max_shots: 3,
          max_effects: 2,
          complexity_level: 1,
        },
      },

      standard: {
        name: 'standard',
        description: 'Standard quality for balanced detail and performance',
        specifications: {
          detail_level: 'moderate',
          scene_complexity: 'balanced',
          object_count: 'moderate',
          effects: 'standard',
          rendering_time: 'moderate',
        },
        prompt_additions: `
STANDARD QUALITY SPECIFICATIONS:
- Create detailed scene layouts with good visual balance
- Use proper lighting setups with 2-3 light sources
- Include atmospheric effects and environmental details
- Balance detail with performance considerations
- Generate 3-7 objects per scene with proper relationships
- Use varied camera angles and smooth movements`,
        constraints: {
          max_objects_per_scene: 10,
          max_shots: 6,
          max_effects: 5,
          complexity_level: 2,
        },
      },

      high: {
        name: 'high',
        description: 'High quality for detailed, immersive experiences',
        specifications: {
          detail_level: 'detailed',
          scene_complexity: 'complex',
          object_count: 'rich',
          effects: 'enhanced',
          rendering_time: 'longer',
        },
        prompt_additions: `
HIGH QUALITY SPECIFICATIONS:
- Create highly detailed scenes with rich visual elements
- Use sophisticated lighting with multiple sources and shadows
- Include advanced atmospheric effects and particle systems
- Add detailed textures and material properties
- Generate 5-12 objects per scene with complex interactions
- Use dynamic camera work with advanced movements and transitions`,
        constraints: {
          max_objects_per_scene: 15,
          max_shots: 10,
          max_effects: 8,
          complexity_level: 3,
        },
      },

      cinematic: {
        name: 'cinematic',
        description: 'Cinematic quality for professional-grade output',
        specifications: {
          detail_level: 'ultra_detailed',
          scene_complexity: 'highly_complex',
          object_count: 'extensive',
          effects: 'professional',
          rendering_time: 'extended',
        },
        prompt_additions: `
CINEMATIC QUALITY SPECIFICATIONS:
- Create ultra-detailed scenes with professional-grade visual elements
- Use advanced lighting techniques with realistic shadows and reflections
- Include sophisticated atmospheric effects, particle systems, and post-processing
- Add detailed material properties, textures, and surface interactions
- Generate 8-20 objects per scene with complex spatial relationships
- Use professional cinematography with advanced camera techniques
- Include detailed sound design considerations for immersive experience
- Apply color grading and visual effects for cinematic appeal`,
        constraints: {
          max_objects_per_scene: 25,
          max_shots: 15,
          max_effects: 12,
          complexity_level: 4,
        },
      },
    };
  }

  getQuality(name) {
    return this.qualities[name] || null;
  }

  getAllQualities() {
    return Object.keys(this.qualities);
  }

  applyQualityToTemplate(templateContent, qualityName) {
    const quality = this.getQuality(qualityName);
    if (!quality) {
      return templateContent;
    }

    // Add quality-specific instructions to the template
    const qualityContent = templateContent + '\n\n' + quality.prompt_additions;

    return {
      content: qualityContent,
      quality: qualityName,
      specifications: quality.specifications,
      constraints: quality.constraints,
    };
  }

  getQualityConstraints(qualityName) {
    const quality = this.getQuality(qualityName);
    return quality ? quality.constraints : {};
  }

  getQualitySpecifications(qualityName) {
    const quality = this.getQuality(qualityName);
    return quality ? quality.specifications : {};
  }

  validateQualityLevel(qualityName) {
    return this.qualities.hasOwnProperty(qualityName);
  }

  getOptimalQuality(requirements = {}) {
    const {
      speed_priority = false,
      detail_priority = false,
      resource_constraints = false,
      professional_output = false,
    } = requirements;

    if (professional_output) return 'cinematic';
    if (detail_priority && !resource_constraints) return 'high';
    if (speed_priority || resource_constraints) return 'draft';
    return 'standard';
  }

  compareQualities(quality1, quality2) {
    const q1 = this.getQuality(quality1);
    const q2 = this.getQuality(quality2);

    if (!q1 || !q2) return null;

    return {
      complexity_diff:
        q1.constraints.complexity_level - q2.constraints.complexity_level,
      object_diff:
        q1.constraints.max_objects_per_scene -
        q2.constraints.max_objects_per_scene,
      shots_diff: q1.constraints.max_shots - q2.constraints.max_shots,
      effects_diff: q1.constraints.max_effects - q2.constraints.max_effects,
      recommendation:
        q1.constraints.complexity_level > q2.constraints.complexity_level
          ? quality1
          : quality2,
    };
  }

  getQualityMetrics(qualityName) {
    const quality = this.getQuality(qualityName);
    if (!quality) return null;

    return {
      estimated_render_time: this.estimateRenderTime(
        quality.constraints.complexity_level
      ),
      memory_usage: this.estimateMemoryUsage(quality.constraints),
      processing_intensity: quality.constraints.complexity_level,
      output_file_size: this.estimateFileSize(quality.constraints),
    };
  }

  estimateRenderTime(complexityLevel) {
    const baseTimes = { 1: '5-15s', 2: '15-45s', 3: '45-120s', 4: '120-300s' };
    return baseTimes[complexityLevel] || 'unknown';
  }

  estimateMemoryUsage(constraints) {
    const baseMemory =
      constraints.max_objects_per_scene * 10 + constraints.max_effects * 20;
    return `${baseMemory}-${baseMemory * 1.5}MB`;
  }

  estimateFileSize(constraints) {
    const baseSize =
      constraints.complexity_level * 5 + constraints.max_shots * 2;
    return `${baseSize}-${baseSize * 2}MB`;
  }
}

module.exports = QualityTemplates;
