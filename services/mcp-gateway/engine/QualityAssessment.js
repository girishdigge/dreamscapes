// engine/QualityAssessment.js
// Advanced content quality assessment algorithms

const _ = require('lodash');
const winston = require('winston');

class QualityAssessment {
  constructor(config = {}) {
    this.config = config;
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({
          filename: 'logs/quality-assessment.log',
        }),
      ],
    });

    // Initialize assessment algorithms
    this.algorithms = this.initializeAlgorithms();
  }

  /**
   * Initialize quality assessment algorithms
   */
  initializeAlgorithms() {
    return {
      // Assess title relevance to original prompt
      titleRelevance: {
        weight: 0.15,
        assess: (content, context = {}) => {
          const title = content.data?.title;
          const originalPrompt = context.originalPrompt;

          if (!title || !originalPrompt) {
            return { score: 0.5, details: 'Missing title or original prompt' };
          }

          const titleWords = this.extractKeywords(title.toLowerCase());
          const promptWords = this.extractKeywords(
            originalPrompt.toLowerCase()
          );

          // Calculate semantic similarity
          const commonWords = titleWords.filter((word) =>
            promptWords.some(
              (pWord) => this.calculateSimilarity(word, pWord) > 0.7
            )
          );

          const relevanceScore =
            commonWords.length / Math.max(titleWords.length, 1);

          // Bonus for creative but relevant titles
          const creativityBonus = this.assessCreativity(title) * 0.2;

          const finalScore = Math.min(relevanceScore + creativityBonus, 1);

          return {
            score: finalScore,
            details: {
              commonWords: commonWords.length,
              totalTitleWords: titleWords.length,
              relevanceScore,
              creativityBonus,
            },
          };
        },
      },

      // Assess description quality and richness
      descriptionQuality: {
        weight: 0.2,
        assess: (content, context = {}) => {
          const description = content.data?.description;

          if (!description) {
            return { score: 0, details: 'Missing description' };
          }

          let score = 0;
          const details = {};

          // Length assessment
          const lengthScore = this.assessDescriptionLength(description);
          score += lengthScore.score * 0.3;
          details.length = lengthScore;

          // Descriptive richness
          const richnessScore = this.assessDescriptiveRichness(description);
          score += richnessScore.score * 0.3;
          details.richness = richnessScore;

          // Sentence structure and flow
          const structureScore = this.assessSentenceStructure(description);
          score += structureScore.score * 0.2;
          details.structure = structureScore;

          // Imagery and visual language
          const imageryScore = this.assessImagery(description);
          score += imageryScore.score * 0.2;
          details.imagery = imageryScore;

          return {
            score: Math.min(score, 1),
            details,
          };
        },
      },

      // Assess scene consistency and completeness
      sceneConsistency: {
        weight: 0.25,
        assess: (content, context = {}) => {
          const scenes = content.data?.scenes;

          if (!scenes || !Array.isArray(scenes)) {
            return { score: 0, details: 'Missing or invalid scenes array' };
          }

          let score = 0;
          const details = {
            totalScenes: scenes.length,
            validScenes: 0,
            issues: [],
          };

          // Scene completeness check
          const completenessScore = this.assessSceneCompleteness(scenes);
          score += completenessScore.score * 0.4;
          details.completeness = completenessScore;

          // Scene consistency check
          const consistencyScore = this.assessSceneConsistency(scenes);
          score += consistencyScore.score * 0.3;
          details.consistency = consistencyScore;

          // Object validity check
          const objectScore = this.assessSceneObjects(scenes);
          score += objectScore.score * 0.3;
          details.objects = objectScore;

          return {
            score: Math.min(score, 1),
            details,
          };
        },
      },

      // Assess cinematography quality
      cinematographyQuality: {
        weight: 0.2,
        assess: (content, context = {}) => {
          const cinematography = content.data?.cinematography;

          if (!cinematography) {
            return { score: 0.3, details: 'No cinematography data (optional)' };
          }

          let score = 0;
          const details = {};

          // Shot composition assessment
          const shotScore = this.assessShotComposition(cinematography);
          score += shotScore.score * 0.5;
          details.shots = shotScore;

          // Duration and pacing assessment
          const pacingScore = this.assessPacing(cinematography);
          score += pacingScore.score * 0.3;
          details.pacing = pacingScore;

          // Technical validity
          const technicalScore =
            this.assessCinematographyTechnical(cinematography);
          score += technicalScore.score * 0.2;
          details.technical = technicalScore;

          return {
            score: Math.min(score, 1),
            details,
          };
        },
      },

      // Assess technical validity and metadata
      technicalValidity: {
        weight: 0.2,
        assess: (content, context = {}) => {
          let score = 0;
          const details = {};

          // Metadata completeness
          const metadataScore = this.assessMetadata(content.metadata);
          score += metadataScore.score * 0.5;
          details.metadata = metadataScore;

          // Data structure validity
          const structureScore = this.assessDataStructure(content.data);
          score += structureScore.score * 0.3;
          details.structure = structureScore;

          // Response format compliance
          const formatScore = this.assessResponseFormat(content);
          score += formatScore.score * 0.2;
          details.format = formatScore;

          return {
            score: Math.min(score, 1),
            details,
          };
        },
      },
    };
  }

  /**
   * Run comprehensive quality assessment
   */
  async assessQuality(content, context = {}) {
    const startTime = Date.now();
    const result = {
      overallScore: 0,
      passed: false,
      breakdown: {},
      issues: [],
      recommendations: [],
      processingTime: 0,
    };

    try {
      let totalScore = 0;
      let totalWeight = 0;

      // Run each assessment algorithm
      for (const [algorithmName, algorithm] of Object.entries(
        this.algorithms
      )) {
        try {
          const assessment = algorithm.assess(content, context);
          const weightedScore = assessment.score * algorithm.weight;

          totalScore += weightedScore;
          totalWeight += algorithm.weight;

          result.breakdown[algorithmName] = {
            score: assessment.score,
            weight: algorithm.weight,
            weightedScore: weightedScore,
            details: assessment.details,
          };

          // Generate issues and recommendations
          if (assessment.score < 0.5) {
            result.issues.push({
              algorithm: algorithmName,
              score: assessment.score,
              severity: assessment.score < 0.3 ? 'high' : 'medium',
              message: `${algorithmName} scored ${(
                assessment.score * 100
              ).toFixed(1)}%`,
              details: assessment.details,
            });
          }

          // Generate recommendations
          const recommendations = this.generateRecommendations(
            algorithmName,
            assessment
          );
          result.recommendations.push(...recommendations);
        } catch (error) {
          this.logger.warn(
            `Quality assessment algorithm ${algorithmName} failed`,
            {
              error: error.message,
            }
          );

          result.issues.push({
            algorithm: algorithmName,
            score: 0,
            severity: 'high',
            message: `Assessment failed: ${error.message}`,
          });
        }
      }

      // Calculate overall score
      result.overallScore = totalWeight > 0 ? totalScore / totalWeight : 0;

      // Determine if quality check passed
      const minScore = context.minScore || 0.7;
      result.passed = result.overallScore >= minScore;

      result.processingTime = Date.now() - startTime;

      this.logger.info('Quality assessment completed', {
        overallScore: result.overallScore,
        passed: result.passed,
        issueCount: result.issues.length,
        processingTime: result.processingTime,
      });

      return result;
    } catch (error) {
      result.issues.push({
        algorithm: 'quality_system',
        score: 0,
        severity: 'high',
        message: `Quality assessment failed: ${error.message}`,
      });

      result.processingTime = Date.now() - startTime;

      this.logger.error('Quality assessment system error', {
        error: error.message,
        stack: error.stack,
      });

      return result;
    }
  }

  /**
   * Extract meaningful keywords from text
   */
  extractKeywords(text) {
    // Remove common stop words and extract meaningful terms
    const stopWords = new Set([
      'the',
      'a',
      'an',
      'and',
      'or',
      'but',
      'in',
      'on',
      'at',
      'to',
      'for',
      'of',
      'with',
      'by',
      'is',
      'are',
      'was',
      'were',
      'be',
      'been',
      'being',
      'have',
      'has',
      'had',
      'do',
      'does',
      'did',
      'will',
      'would',
      'could',
      'should',
      'may',
      'might',
      'must',
      'can',
      'this',
      'that',
      'these',
      'those',
    ]);

    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length > 2 && !stopWords.has(word));
  }

  /**
   * Calculate similarity between two words
   */
  calculateSimilarity(word1, word2) {
    if (word1 === word2) return 1;
    if (word1.includes(word2) || word2.includes(word1)) return 0.8;

    // Simple Levenshtein distance-based similarity
    const maxLength = Math.max(word1.length, word2.length);
    const distance = this.levenshteinDistance(word1, word2);
    return 1 - distance / maxLength;
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  levenshteinDistance(str1, str2) {
    const matrix = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Assess creativity of title
   */
  assessCreativity(title) {
    const creativityIndicators = [
      'dream',
      'ethereal',
      'mystical',
      'surreal',
      'floating',
      'infinite',
      'crystal',
      'shadow',
      'whisper',
      'echo',
      'shimmer',
      'glow',
      'dance',
      'spiral',
      'cascade',
      'weave',
      'drift',
      'soar',
      'emerge',
      'transform',
    ];

    const titleLower = title.toLowerCase();
    const creativeWords = creativityIndicators.filter((word) =>
      titleLower.includes(word)
    );

    return Math.min(creativeWords.length / 3, 1);
  }

  /**
   * Assess description length appropriateness
   */
  assessDescriptionLength(description) {
    const length = description.length;
    let score = 0;

    if (length >= 50) score += 0.3;
    if (length >= 100) score += 0.3;
    if (length >= 150) score += 0.2;
    if (length >= 200) score += 0.2;

    // Penalty for overly long descriptions
    if (length > 1000) score -= 0.2;

    return {
      score: Math.max(0, Math.min(score, 1)),
      length,
      category:
        length < 50 ? 'too_short' : length > 500 ? 'very_long' : 'appropriate',
    };
  }

  /**
   * Assess descriptive richness
   */
  assessDescriptiveRichness(description) {
    const descriptiveWords = [
      'vivid',
      'ethereal',
      'mysterious',
      'glowing',
      'floating',
      'shimmering',
      'ancient',
      'crystalline',
      'luminous',
      'translucent',
      'iridescent',
      'haunting',
      'serene',
      'majestic',
      'delicate',
      'intricate',
      'ornate',
    ];

    const sensoryWords = [
      'whisper',
      'echo',
      'gleam',
      'sparkle',
      'rustle',
      'hum',
      'chime',
      'soft',
      'smooth',
      'rough',
      'warm',
      'cool',
      'bright',
      'dim',
    ];

    const descriptionLower = description.toLowerCase();

    const descriptiveCount = descriptiveWords.filter((word) =>
      descriptionLower.includes(word)
    ).length;

    const sensoryCount = sensoryWords.filter((word) =>
      descriptionLower.includes(word)
    ).length;

    const totalRichness = descriptiveCount + sensoryCount;
    const score = Math.min(totalRichness / 5, 1);

    return {
      score,
      descriptiveWords: descriptiveCount,
      sensoryWords: sensoryCount,
      totalRichness,
    };
  }

  /**
   * Assess sentence structure and flow
   */
  assessSentenceStructure(description) {
    const sentences = description
      .split(/[.!?]+/)
      .filter((s) => s.trim().length > 0);
    let score = 0;

    // Multiple sentences bonus
    if (sentences.length >= 2) score += 0.4;
    if (sentences.length >= 3) score += 0.2;

    // Sentence length variety
    const lengths = sentences.map((s) => s.trim().split(/\s+/).length);
    const avgLength =
      lengths.reduce((sum, len) => sum + len, 0) / lengths.length;

    if (avgLength >= 8 && avgLength <= 20) score += 0.2;

    // Variety in sentence structure
    const hasVariety =
      lengths.some((len) => len < avgLength * 0.7) &&
      lengths.some((len) => len > avgLength * 1.3);
    if (hasVariety) score += 0.2;

    return {
      score: Math.min(score, 1),
      sentenceCount: sentences.length,
      averageLength: avgLength,
      hasVariety,
    };
  }

  /**
   * Assess imagery and visual language
   */
  assessImagery(description) {
    const visualWords = [
      'see',
      'look',
      'appear',
      'visible',
      'bright',
      'dark',
      'color',
      'light',
      'shadow',
      'reflection',
      'mirror',
      'transparent',
      'opaque',
      'shine',
    ];

    const spatialWords = [
      'above',
      'below',
      'around',
      'through',
      'across',
      'beyond',
      'within',
      'floating',
      'suspended',
      'towering',
      'sprawling',
      'winding',
    ];

    const descriptionLower = description.toLowerCase();

    const visualCount = visualWords.filter((word) =>
      descriptionLower.includes(word)
    ).length;

    const spatialCount = spatialWords.filter((word) =>
      descriptionLower.includes(word)
    ).length;

    const totalImagery = visualCount + spatialCount;
    const score = Math.min(totalImagery / 4, 1);

    return {
      score,
      visualWords: visualCount,
      spatialWords: spatialCount,
      totalImagery,
    };
  }

  /**
   * Assess scene completeness
   */
  assessSceneCompleteness(scenes) {
    let score = 0;
    let validScenes = 0;
    const issues = [];

    for (const [index, scene] of scenes.entries()) {
      let sceneScore = 0;

      // Required fields check
      if (scene.id) sceneScore += 0.25;
      else issues.push(`Scene ${index}: Missing ID`);

      if (scene.description && scene.description.length >= 10)
        sceneScore += 0.25;
      else issues.push(`Scene ${index}: Missing or short description`);

      if (
        scene.objects &&
        Array.isArray(scene.objects) &&
        scene.objects.length > 0
      ) {
        sceneScore += 0.25;
      } else {
        issues.push(`Scene ${index}: Missing or empty objects array`);
      }

      // Optional but valuable fields
      if (scene.lighting) sceneScore += 0.125;
      if (scene.camera) sceneScore += 0.125;

      if (sceneScore >= 0.75) validScenes++;
      score += sceneScore;
    }

    const finalScore = scenes.length > 0 ? score / scenes.length : 0;

    return {
      score: finalScore,
      validScenes,
      totalScenes: scenes.length,
      issues,
    };
  }

  /**
   * Assess scene consistency
   */
  assessSceneConsistency(scenes) {
    let score = 1;
    const issues = [];

    // Check for duplicate IDs
    const ids = scenes.map((scene) => scene.id).filter(Boolean);
    const uniqueIds = new Set(ids);
    if (ids.length !== uniqueIds.size) {
      score -= 0.3;
      issues.push('Duplicate scene IDs found');
    }

    // Check description quality consistency
    const descriptions = scenes
      .map((scene) => scene.description)
      .filter(Boolean);
    const avgDescLength =
      descriptions.reduce((sum, desc) => sum + desc.length, 0) /
      descriptions.length;

    const inconsistentDescs = descriptions.filter(
      (desc) =>
        desc.length < avgDescLength * 0.5 || desc.length > avgDescLength * 2
    );

    if (inconsistentDescs.length > scenes.length * 0.3) {
      score -= 0.2;
      issues.push('Inconsistent description lengths across scenes');
    }

    return {
      score: Math.max(0, score),
      issues,
      averageDescriptionLength: avgDescLength,
    };
  }

  /**
   * Assess scene objects quality
   */
  assessSceneObjects(scenes) {
    let score = 0;
    let totalObjects = 0;
    const issues = [];

    for (const [index, scene] of scenes.entries()) {
      if (!scene.objects || !Array.isArray(scene.objects)) {
        issues.push(`Scene ${index}: Invalid objects array`);
        continue;
      }

      totalObjects += scene.objects.length;

      // Check object structure
      const validObjects = scene.objects.filter(
        (obj) => obj && typeof obj === 'object' && Object.keys(obj).length > 0
      );

      const objectScore =
        scene.objects.length > 0
          ? validObjects.length / scene.objects.length
          : 0;

      score += objectScore;

      if (objectScore < 0.8) {
        issues.push(`Scene ${index}: Some objects have invalid structure`);
      }
    }

    const finalScore = scenes.length > 0 ? score / scenes.length : 0;

    return {
      score: finalScore,
      totalObjects,
      averageObjectsPerScene:
        scenes.length > 0 ? totalObjects / scenes.length : 0,
      issues,
    };
  }

  /**
   * Assess shot composition
   */
  assessShotComposition(cinematography) {
    if (!cinematography.shots || !Array.isArray(cinematography.shots)) {
      return { score: 0, details: 'No shots array found' };
    }

    let score = 0;
    const shots = cinematography.shots;

    // Shot count assessment
    if (shots.length >= 1) score += 0.3;
    if (shots.length >= 3) score += 0.2;
    if (shots.length >= 5) score += 0.1;

    // Shot type variety
    const shotTypes = new Set(shots.map((shot) => shot.type).filter(Boolean));
    const varietyScore = Math.min(shotTypes.size / 3, 0.3);
    score += varietyScore;

    // Shot duration appropriateness
    const validDurations = shots.filter(
      (shot) => shot.duration && shot.duration >= 2 && shot.duration <= 30
    );
    const durationScore =
      shots.length > 0 ? (validDurations.length / shots.length) * 0.1 : 0;
    score += durationScore;

    return {
      score: Math.min(score, 1),
      shotCount: shots.length,
      shotTypes: Array.from(shotTypes),
      validDurations: validDurations.length,
    };
  }

  /**
   * Assess pacing
   */
  assessPacing(cinematography) {
    if (!cinematography.shots || !cinematography.duration) {
      return { score: 0.5, details: 'Missing shots or duration data' };
    }

    const shots = cinematography.shots;
    const totalShotDuration = shots.reduce(
      (sum, shot) => sum + (shot.duration || 0),
      0
    );

    let score = 0;

    // Duration consistency check
    const durationDiff = Math.abs(totalShotDuration - cinematography.duration);
    if (durationDiff <= 2) score += 0.5;
    else if (durationDiff <= 5) score += 0.3;
    else score += 0.1;

    // Pacing variety
    const durations = shots.map((shot) => shot.duration).filter(Boolean);
    if (durations.length > 0) {
      const avgDuration =
        durations.reduce((sum, dur) => sum + dur, 0) / durations.length;
      const hasVariety =
        durations.some((dur) => dur < avgDuration * 0.7) &&
        durations.some((dur) => dur > avgDuration * 1.3);
      if (hasVariety) score += 0.3;
      else score += 0.1;
    }

    // Overall duration appropriateness
    if (cinematography.duration >= 10 && cinematography.duration <= 120) {
      score += 0.2;
    }

    return {
      score: Math.min(score, 1),
      totalShotDuration,
      declaredDuration: cinematography.duration,
      durationDifference: durationDiff,
    };
  }

  /**
   * Assess cinematography technical aspects
   */
  assessCinematographyTechnical(cinematography) {
    let score = 0;
    const issues = [];

    // Required fields check
    if (cinematography.durationSec || cinematography.duration) score += 0.4;
    else issues.push('Missing duration field');

    if (cinematography.shots && Array.isArray(cinematography.shots))
      score += 0.4;
    else issues.push('Missing or invalid shots array');

    // Optional but valuable fields
    if (cinematography.transitions) score += 0.1;
    if (cinematography.effects) score += 0.1;

    return {
      score: Math.min(score, 1),
      issues,
    };
  }

  /**
   * Assess metadata completeness and validity
   */
  assessMetadata(metadata) {
    if (!metadata) {
      return { score: 0, details: 'No metadata provided' };
    }

    let score = 0;
    const requiredFields = [
      'source',
      'model',
      'processingTime',
      'quality',
      'tokens',
      'confidence',
    ];
    const presentFields = requiredFields.filter(
      (field) => metadata[field] !== undefined
    );

    // Field presence score
    score += (presentFields.length / requiredFields.length) * 0.6;

    // Field validity score
    let validityScore = 0;

    if (metadata.confidence !== undefined) {
      if (metadata.confidence >= 0 && metadata.confidence <= 1)
        validityScore += 0.1;
    }

    if (metadata.quality !== undefined) {
      const validQualities = ['draft', 'standard', 'high', 'cinematic'];
      if (validQualities.includes(metadata.quality)) validityScore += 0.1;
    }

    if (metadata.processingTime !== undefined) {
      if (metadata.processingTime >= 0 && metadata.processingTime < 300000)
        validityScore += 0.1;
    }

    if (metadata.tokens !== undefined && typeof metadata.tokens === 'object') {
      if (metadata.tokens.input >= 0 && metadata.tokens.output >= 0)
        validityScore += 0.1;
    }

    score += validityScore;

    return {
      score: Math.min(score, 1),
      presentFields,
      requiredFields,
      fieldCompleteness: presentFields.length / requiredFields.length,
    };
  }

  /**
   * Assess data structure validity
   */
  assessDataStructure(data) {
    if (!data) {
      return { score: 0, details: 'No data provided' };
    }

    let score = 0;
    const requiredFields = ['id', 'title', 'description', 'scenes'];
    const presentFields = requiredFields.filter(
      (field) => data[field] !== undefined
    );

    score += (presentFields.length / requiredFields.length) * 0.8;

    // Additional structure checks
    if (data.scenes && Array.isArray(data.scenes) && data.scenes.length > 0) {
      score += 0.2;
    }

    return {
      score: Math.min(score, 1),
      presentFields,
      requiredFields,
    };
  }

  /**
   * Assess response format compliance
   */
  assessResponseFormat(content) {
    let score = 0;

    // Check top-level structure
    if (content.success !== undefined) score += 0.2;
    if (content.data !== undefined) score += 0.4;
    if (content.metadata !== undefined) score += 0.4;

    return {
      score: Math.min(score, 1),
      hasSuccess: content.success !== undefined,
      hasData: content.data !== undefined,
      hasMetadata: content.metadata !== undefined,
    };
  }

  /**
   * Generate recommendations based on assessment results
   */
  generateRecommendations(algorithmName, assessment) {
    const recommendations = [];

    if (assessment.score < 0.7) {
      switch (algorithmName) {
        case 'titleRelevance':
          recommendations.push({
            type: 'improvement',
            priority: 'medium',
            message:
              'Consider making the title more relevant to the original dream description',
            suggestion:
              'Include key elements or themes from the dream in the title',
          });
          break;

        case 'descriptionQuality':
          if (assessment.details.length?.length < 100) {
            recommendations.push({
              type: 'improvement',
              priority: 'high',
              message: 'Description is too short and lacks detail',
              suggestion:
                'Expand the description with more vivid imagery and sensory details',
            });
          }
          break;

        case 'sceneConsistency':
          recommendations.push({
            type: 'improvement',
            priority: 'high',
            message: 'Scenes lack consistency or completeness',
            suggestion:
              'Ensure all scenes have proper IDs, descriptions, and object arrays',
          });
          break;

        case 'cinematographyQuality':
          recommendations.push({
            type: 'improvement',
            priority: 'medium',
            message: 'Cinematography could be enhanced',
            suggestion:
              'Add more varied shot types and ensure proper shot durations',
          });
          break;

        case 'technicalValidity':
          recommendations.push({
            type: 'improvement',
            priority: 'high',
            message: 'Technical structure needs improvement',
            suggestion:
              'Ensure all required metadata fields are present and valid',
          });
          break;
      }
    }

    return recommendations;
  }
}

module.exports = QualityAssessment;
