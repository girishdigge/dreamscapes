/**
 * Event Timeline
 * Main class for managing event timelines
 */

const KeyframePlanner = require('./KeyframePlanner');
const PhysicsEventGenerator = require('./PhysicsEventGenerator');

class EventTimeline {
  constructor() {
    this.planner = new KeyframePlanner();
    this.physicsGen = new PhysicsEventGenerator();
  }

  /**
   * Generate complete event timeline for a scene
   * @param {Object} sceneData - Scene data with entities, verbs, animations
   * @param {number} duration - Scene duration in seconds
   * @returns {Object} - Complete timeline with events
   */
  generateTimeline(sceneData, duration = 30) {
    // Plan the timeline structure
    const timeline = this.planner.planEvents(sceneData, duration);

    // Generate physics data for each event
    timeline.events = timeline.events.map((event) => {
      return this.enrichEvent(event, sceneData);
    });

    // Add transformation events if needed
    const transformations = this.generateTransformations(sceneData, duration);
    timeline.events.push(...transformations);

    // Re-sort and re-sequence
    timeline.events.sort((a, b) => a.time - b.time);
    timeline.events = this.planner.sequenceEvents(timeline.events);

    // Update keyframes
    timeline.keyframes = this.planner.createKeyframes(
      timeline.events,
      duration
    );

    return timeline;
  }

  /**
   * Enrich event with physics data
   * @param {Object} event - Basic event
   * @param {Object} sceneData - Scene data
   * @returns {Object} - Enriched event
   */
  enrichEvent(event, sceneData) {
    const config = {
      position: event.position || { x: 0, y: 0, z: 0 },
      time: event.time,
      entity: event.entity,
      intensity: 1.0,
    };

    let physicsData;

    switch (event.type) {
      case 'explosion':
        physicsData = this.physicsGen.generateExplosion(config);
        break;

      case 'eruption':
        physicsData = this.physicsGen.generateEruption(config);
        break;

      case 'collision':
        config.entities = event.entities;
        physicsData = this.physicsGen.generateCollision(config);
        break;

      case 'burst':
        physicsData = this.physicsGen.generateBurst(config);
        break;

      case 'shatter':
        physicsData = this.physicsGen.generateShatter(config);
        break;

      default:
        physicsData = this.physicsGen.generateBurst(config);
    }

    return {
      ...event,
      ...physicsData,
    };
  }

  /**
   * Generate transformation events
   * @param {Object} sceneData - Scene data
   * @param {number} duration - Scene duration
   * @returns {Array} - Array of transformation events
   */
  generateTransformations(sceneData, duration) {
    const transformations = [];

    // Check for transformation verbs
    if (sceneData.verbs) {
      sceneData.verbs.forEach((verb) => {
        if (verb.text.includes('transform') || verb.text.includes('morph')) {
          const entity = sceneData.entities?.[0];

          transformations.push(
            this.physicsGen.generateTransformation({
              entity,
              time: duration * 0.4,
              duration: 2.0,
              transformType: 'scale',
              startValue: 1.0,
              endValue: 1.5,
            })
          );
        }
      });
    }

    return transformations;
  }

  /**
   * Get events at a specific time
   * @param {Object} timeline - Timeline object
   * @param {number} time - Time in seconds
   * @param {number} tolerance - Time tolerance
   * @returns {Array} - Events at that time
   */
  getEventsAtTime(timeline, time, tolerance = 0.1) {
    return timeline.events.filter(
      (event) => Math.abs(event.time - time) <= tolerance
    );
  }

  /**
   * Get active events at a specific time
   * @param {Object} timeline - Timeline object
   * @param {number} time - Time in seconds
   * @returns {Array} - Active events
   */
  getActiveEvents(timeline, time) {
    return timeline.events.filter(
      (event) =>
        time >= event.time && time <= event.time + (event.duration || 0)
    );
  }

  /**
   * Get next event after a given time
   * @param {Object} timeline - Timeline object
   * @param {number} time - Time in seconds
   * @returns {Object|null} - Next event or null
   */
  getNextEvent(timeline, time) {
    const futureEvents = timeline.events.filter((event) => event.time > time);
    return futureEvents.length > 0 ? futureEvents[0] : null;
  }

  /**
   * Get events in a time range
   * @param {Object} timeline - Timeline object
   * @param {number} startTime - Start time
   * @param {number} endTime - End time
   * @returns {Array} - Events in range
   */
  getEventsInRange(timeline, startTime, endTime) {
    return timeline.events.filter(
      (event) => event.time >= startTime && event.time <= endTime
    );
  }

  /**
   * Get timeline statistics
   * @param {Object} timeline - Timeline object
   * @returns {Object} - Statistics
   */
  getStatistics(timeline) {
    const eventTypes = {};

    timeline.events.forEach((event) => {
      eventTypes[event.type] = (eventTypes[event.type] || 0) + 1;
    });

    return {
      totalEvents: timeline.events.length,
      totalKeyframes: timeline.keyframes.length,
      duration: timeline.duration,
      eventTypes,
      phases: {
        setup: this.planner.getEventsInPhase(timeline, 'setup').length,
        action: this.planner.getEventsInPhase(timeline, 'action').length,
        resolution: this.planner.getEventsInPhase(timeline, 'resolution')
          .length,
      },
      averageEventSpacing:
        timeline.events.length > 1
          ? timeline.duration / (timeline.events.length - 1)
          : timeline.duration,
    };
  }

  /**
   * Validate timeline
   * @param {Object} timeline - Timeline object
   * @returns {Object} - Validation result
   */
  validateTimeline(timeline) {
    const issues = [];

    // Check for events outside duration
    timeline.events.forEach((event) => {
      if (event.time < 0 || event.time > timeline.duration) {
        issues.push({
          type: 'timing',
          event: event.id,
          message: `Event time ${event.time} outside duration ${timeline.duration}`,
        });
      }
    });

    // Check for overlapping events
    for (let i = 0; i < timeline.events.length - 1; i++) {
      const event1 = timeline.events[i];
      const event2 = timeline.events[i + 1];

      if (event2.time - event1.time < 0.5) {
        issues.push({
          type: 'spacing',
          events: [event1.id, event2.id],
          message: 'Events too close together',
        });
      }
    }

    return {
      valid: issues.length === 0,
      issues,
    };
  }

  /**
   * Export timeline to JSON
   * @param {Object} timeline - Timeline object
   * @returns {string} - JSON string
   */
  exportToJSON(timeline) {
    return JSON.stringify(timeline, null, 2);
  }

  /**
   * Import timeline from JSON
   * @param {string} json - JSON string
   * @returns {Object} - Timeline object
   */
  importFromJSON(json) {
    return JSON.parse(json);
  }
}

module.exports = EventTimeline;
