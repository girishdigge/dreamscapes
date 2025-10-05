/**
 * Motion Module Entry Point
 * Exports motion mapping utilities for the Creative Dream Pipeline
 */

const VerbDictionary = require('./VerbDictionary');
const PathGenerator = require('./PathGenerator');
const MotionMapper = require('./MotionMapper');

module.exports = {
  VerbDictionary,
  PathGenerator,
  MotionMapper,
};
