/**
 * Camera Module Entry Point
 * Exports cinematic camera utilities for the Creative Dream Pipeline
 */

const ShotSequencer = require('./ShotSequencer');
const CameraTracker = require('./CameraTracker');
const CompositionEngine = require('./CompositionEngine');
const CinematicCamera = require('./CinematicCamera');

module.exports = {
  ShotSequencer,
  CameraTracker,
  CompositionEngine,
  CinematicCamera,
};
