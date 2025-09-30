// templates/StyleTemplates.js
// Style-specific template enhancements for different visual styles

class StyleTemplates {
  constructor() {
    this.styles = {
      ethereal: {
        name: 'ethereal',
        description: 'Ethereal, otherworldly dream style',
        enhancements: {
          lighting:
            'Soft, diffused lighting with gentle glows and subtle color gradients. Use cool blues, purples, and whites.',
          atmosphere:
            'Misty, floating elements with translucent materials and gentle particle effects.',
          camera:
            'Slow, floating camera movements with gentle drifts and smooth transitions.',
          effects: 'Bloom effects, soft focus, and ethereal particle systems.',
          objects:
            'Translucent, glowing objects with soft edges and flowing forms.',
        },
        prompt_additions: `
ETHEREAL STYLE REQUIREMENTS:
- Use soft, diffused lighting with cool color palettes (blues, purples, whites)
- Create floating, translucent elements with gentle glows
- Implement smooth, drifting camera movements
- Add misty atmospheres and particle effects
- Focus on dreamlike, otherworldly qualities`,
      },

      cyberpunk: {
        name: 'cyberpunk',
        description: 'Futuristic cyberpunk dream style',
        enhancements: {
          lighting:
            'Neon lighting with sharp contrasts, electric blues, hot pinks, and acid greens.',
          atmosphere:
            'Urban, technological environments with holographic elements and digital artifacts.',
          camera:
            'Dynamic, angular camera movements with quick cuts and dramatic angles.',
          effects:
            'Glitch effects, holographic displays, and neon light trails.',
          objects:
            'High-tech, angular objects with metallic and glass materials.',
        },
        prompt_additions: `
CYBERPUNK STYLE REQUIREMENTS:
- Use neon lighting with electric blues, hot pinks, and acid greens
- Create high-tech, urban environments with holographic elements
- Implement dynamic, angular camera movements
- Add glitch effects and digital artifacts
- Focus on futuristic, technological aesthetics`,
      },

      surreal: {
        name: 'surreal',
        description: 'Surreal, abstract dream style',
        enhancements: {
          lighting:
            'Impossible lighting scenarios with multiple colored light sources and dramatic shadows.',
          atmosphere:
            'Reality-bending environments with impossible geometries and floating elements.',
          camera:
            'Unconventional camera angles and movements that defy physics.',
          effects:
            'Reality distortion effects, impossible reflections, and gravity-defying elements.',
          objects:
            'Abstract, morphing objects that change form and defy conventional physics.',
        },
        prompt_additions: `
SURREAL STYLE REQUIREMENTS:
- Create impossible lighting scenarios and dramatic contrasts
- Design reality-bending environments with impossible geometries
- Use unconventional camera angles and physics-defying movements
- Add reality distortion effects and impossible elements
- Focus on abstract, mind-bending visual experiences`,
      },

      natural: {
        name: 'natural',
        description: 'Natural, organic dream style',
        enhancements: {
          lighting:
            'Natural lighting with warm, golden hour tones and organic shadows.',
          atmosphere:
            'Organic environments with natural textures, flowing water, and living elements.',
          camera:
            'Organic, flowing camera movements that follow natural rhythms.',
          effects:
            'Natural particle effects like falling leaves, flowing water, and wind.',
          objects:
            'Organic shapes and natural materials with realistic textures.',
        },
        prompt_additions: `
NATURAL STYLE REQUIREMENTS:
- Use natural lighting with warm, golden tones
- Create organic environments with natural textures and living elements
- Implement flowing, organic camera movements
- Add natural particle effects and environmental elements
- Focus on realistic, nature-inspired aesthetics`,
      },

      minimalist: {
        name: 'minimalist',
        description: 'Clean, minimalist dream style',
        enhancements: {
          lighting:
            'Clean, even lighting with subtle shadows and neutral tones.',
          atmosphere:
            'Simple, uncluttered environments with focus on essential elements.',
          camera:
            'Steady, purposeful camera movements with clean compositions.',
          effects:
            'Minimal effects focusing on clean lines and simple transitions.',
          objects:
            'Simple geometric forms with clean materials and neutral colors.',
        },
        prompt_additions: `
MINIMALIST STYLE REQUIREMENTS:
- Use clean, even lighting with neutral tones
- Create simple, uncluttered environments
- Implement steady, purposeful camera movements
- Use minimal effects with clean transitions
- Focus on essential elements and geometric simplicity`,
      },

      dark_fantasy: {
        name: 'dark_fantasy',
        description: 'Dark, gothic fantasy dream style',
        enhancements: {
          lighting:
            'Dramatic, moody lighting with deep shadows and warm accent lights.',
          atmosphere:
            'Gothic, mysterious environments with ancient architecture and mystical elements.',
          camera: 'Dramatic camera angles with slow, deliberate movements.',
          effects: 'Mystical effects, fog, and dramatic lighting transitions.',
          objects:
            'Gothic architecture, mystical artifacts, and weathered materials.',
        },
        prompt_additions: `
DARK FANTASY STYLE REQUIREMENTS:
- Use dramatic, moody lighting with deep shadows
- Create gothic, mysterious environments with ancient elements
- Implement dramatic camera angles and deliberate movements
- Add mystical effects and atmospheric fog
- Focus on dark, fantasy aesthetics with rich textures`,
      },
    };
  }

  getStyle(name) {
    return this.styles[name] || null;
  }

  getAllStyles() {
    return Object.keys(this.styles);
  }

  applyStyleToTemplate(templateContent, styleName) {
    const style = this.getStyle(styleName);
    if (!style) {
      return templateContent;
    }

    // Add style-specific instructions to the template
    const styledContent = templateContent + '\n\n' + style.prompt_additions;

    return {
      content: styledContent,
      style: styleName,
      enhancements: style.enhancements,
    };
  }

  getStyleEnhancements(styleName) {
    const style = this.getStyle(styleName);
    return style ? style.enhancements : {};
  }

  combineStyles(primaryStyle, secondaryStyle, blendRatio = 0.7) {
    const primary = this.getStyle(primaryStyle);
    const secondary = this.getStyle(secondaryStyle);

    if (!primary || !secondary) {
      return primary || secondary || null;
    }

    return {
      name: `${primaryStyle}_${secondaryStyle}_blend`,
      description: `Blend of ${primary.description} and ${secondary.description}`,
      prompt_additions: `
BLENDED STYLE REQUIREMENTS (${Math.round(
        blendRatio * 100
      )}% ${primaryStyle}, ${Math.round(
        (1 - blendRatio) * 100
      )}% ${secondaryStyle}):
PRIMARY STYLE (${primaryStyle}):
${primary.prompt_additions}

SECONDARY STYLE (${secondaryStyle}):
${secondary.prompt_additions}

Blend these styles with emphasis on the primary style while incorporating elements from the secondary style.`,
    };
  }

  validateStyle(styleName) {
    return this.styles.hasOwnProperty(styleName);
  }
}

module.exports = StyleTemplates;
