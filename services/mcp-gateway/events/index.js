/**
 * Events Module Entry Point
 * Exports event generation utilities for the Creative Dream Pipeline
 */

const KeyframePlanner = require('./KeyframePlanner');
const PhysicsEventGenerator = require('./PhysicsEventGenerator');
const EventTimeline = require('./EventTimeline');

module.exports = {
  KeyframePlanner,
  PhysicsEventGenerator,
  EventTimeline,
};
