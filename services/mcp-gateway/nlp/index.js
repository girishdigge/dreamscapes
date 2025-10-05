/**
 * NLP Module Entry Point
 * Exports NLP utilities for the Creative Dream Pipeline
 */

const NLPWrapper = require('./NLPWrapper');
const TextPreprocessor = require('./TextPreprocessor');
const EntityExtractor = require('./EntityExtractor');
const VerbExtractor = require('./VerbExtractor');
const ModifierExtractor = require('./ModifierExtractor');
const SemanticAnalyzer = require('./SemanticAnalyzer');

module.exports = {
  NLPWrapper,
  TextPreprocessor,
  EntityExtractor,
  VerbExtractor,
  ModifierExtractor,
  SemanticAnalyzer,
};
