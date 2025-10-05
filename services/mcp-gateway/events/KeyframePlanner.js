/**
 * Keyframe Planner
 * Plans and distributes events across the scene timeline
 */

class KeyframePlanner {
  constructor() {
    this.defaultDuration = 30; // seconds
  }

  /**
   * Plan events for a scene
   * @param {Object} sceneData - Scene data with entities and animations
   * @param {number} duration - Scene duration in seconds
   * @returns {Object} - Event timeline
   */
  planEvents(sceneData, duration = this.defaultDuration) {
    const timeline = {
      duration,
      events: [],
      keyframes: [],
      phases: this.definePhases(duration),
    };

    // Extract event verbs from scene
    const eventVerbs = this.extractEventVerbs(sceneData);

    // Detect collisions from motion paths
    const collisions = this.detectCollisions(sceneData, duration);

    // Create events from verbs
    eventVerbs.forEach((eventVerb) => {
      const event = this.createEventFromVerb(eventVerb, duration);
      if (event) {
        timeline.events.push(event);
      }
    });

    // Add collision events
    collisions.forEach((collision) => {
      timeline.events.push(collision);
    });

    // Distribute events across timeline
    timeline.events = this.distributeEvents(timeline.events, duration);

    // Create keyframes
    timeline.keyframes = this.createKeyframes(timeline.events, duration);

    // Sequence events
    timeline.events = this.sequenceEvents(timeline.events);

    return timeline;
  }

  /**
   * Define timeline phases
   * @param {number} duration - Total duration
   * @returns {Object} - Phase definitions
   */
  definePhases(duration) {
    return {
      setup: {
        start: 0,
        end: duration * 0.2,
        description: 'Scene establishment',
      },
      action: {
        start: duration * 0.2,
        end: duration * 0.7,
        description: 'Main action and events',
      },
      resolution: {
        start: duration * 0.7,
        end: duration,
        description: 'Scene resolution',
      },
    };
  }

  /**
   * Extract event verbs from scene data
   * @param {Object} sceneData - Scene data
   * @returns {Array} - Array of event verbs
   */
  extractEventVerbs(sceneData) {
    const eventVerbs = [];

    if (sceneData.verbs) {
      sceneData.verbs.forEach((verb) => {
        if (verb.isEventVerb) {
          eventVerbs.push({
            verb: verb.text,
            entity: sceneData.entities?.[0], // Associate with first entity
            category: verb.category,
          });
        }
      });
    }

    return eventVerbs;
  }

  /**
   * Create event from verb
   * @param {Object} eventVerb - Event verb data
   * @param {number} duration - Scene duration
   * @returns {Object} - Event object
   */
  createEventFromVerb(eventVerb, duration) {
    const eventTypes = {
      exploding: 'explosion',
      erupting: 'eruption',
      colliding: 'collision',
      bursting: 'burst',
      shattering: 'shatter',
      crashing: 'crash',
    };

    const eventType = eventTypes[eventVerb.verb] || 'generic';

    // Determine timing based on event type
    let timing;
    if (eventType === 'eruption') {
      timing = duration * 0.1; // Early
    } else if (eventType === 'explosion' || eventType === 'collision') {
      timing = duration * 0.5; // Mid
    } else {
      timing = duration * 0.6; // Late mid
    }

    return {
      id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: eventType,
      time: timing,
      entity: eventVerb.entity,
      verb: eventVerb.verb,
      phase: this.getPhaseForTime(timing, duration),
    };
  }

  /**
   * Detect collisions between entities
   * @param {Object} sceneData - Scene data
   * @param {number} duration - Scene duration
   * @returns {Array} - Array of collision events
   */
  detectCollisions(sceneData, duration) {
    const collisions = [];

    if (!sceneData.animations || sceneData.animations.length < 2) {
      return collisions;
    }

    // Check each pair of animated entities
    for (let i = 0; i < sceneData.animations.length; i++) {
      for (let j = i + 1; j < sceneData.animations.length; j++) {
        const anim1 = sceneData.animations[i];
        const anim2 = sceneData.animations[j];

        // Only check path-based animations
        if (anim1.type === 'path' && anim2.type === 'path') {
          const collision = this.checkPathIntersection(anim1, anim2, duration);
          if (collision) {
            collisions.push({
              id: `collision_${Date.now()}_${Math.random()
                .toString(36)
                .substr(2, 9)}`,
              type: 'collision',
              time: collision.time,
              entities: [anim1.entity, anim2.entity],
              position: collision.position,
              phase: this.getPhaseForTime(collision.time, duration),
            });
          }
        }
      }
    }

    return collisions;
  }

  /**
   * Check if two paths intersect
   * @param {Object} anim1 - First animation
   * @param {Object} anim2 - Second animation
   * @param {number} duration - Scene duration
   * @returns {Object|null} - Collision data or null
   */
  checkPathIntersection(anim1, anim2, duration) {
    if (!anim1.path?.waypoints || !anim2.path?.waypoints) {
      return null;
    }

    const path1 = anim1.path.waypoints;
    const path2 = anim2.path.waypoints;

    // Simple proximity check at various time points
    const checkPoints = 20;
    const threshold = 5; // Distance threshold for collision

    for (let i = 0; i < checkPoints; i++) {
      const t = i / checkPoints;
      const time = t * duration;

      const idx1 = Math.floor(t * (path1.length - 1));
      const idx2 = Math.floor(t * (path2.length - 1));

      if (idx1 < path1.length && idx2 < path2.length) {
        const pos1 = path1[idx1];
        const pos2 = path2[idx2];

        const distance = this.calculateDistance(pos1, pos2);

        if (distance < threshold) {
          return {
            time,
            position: {
              x: (pos1.x + pos2.x) / 2,
              y: (pos1.y + pos2.y) / 2,
              z: (pos1.z + pos2.z) / 2,
            },
          };
        }
      }
    }

    return null;
  }

  /**
   * Calculate distance between two points
   * @param {Object} pos1 - First position
   * @param {Object} pos2 - Second position
   * @returns {number} - Distance
   */
  calculateDistance(pos1, pos2) {
    const dx = pos2.x - pos1.x;
    const dy = pos2.y - pos1.y;
    const dz = pos2.z - pos1.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  /**
   * Distribute events across timeline
   * @param {Array} events - Array of events
   * @param {number} duration - Scene duration
   * @returns {Array} - Distributed events
   */
  distributeEvents(events, duration) {
    if (events.length === 0) {
      return events;
    }

    // Sort events by time
    events.sort((a, b) => a.time - b.time);

    // Ensure minimum spacing between events
    const minSpacing = 2; // seconds

    for (let i = 1; i < events.length; i++) {
      if (events[i].time - events[i - 1].time < minSpacing) {
        events[i].time = events[i - 1].time + minSpacing;
      }
    }

    // Ensure events don't exceed duration
    events.forEach((event) => {
      if (event.time > duration - 2) {
        event.time = duration - 2;
      }
    });

    return events;
  }

  /**
   * Create keyframes from events
   * @param {Array} events - Array of events
   * @param {number} duration - Scene duration
   * @returns {Array} - Array of keyframes
   */
  createKeyframes(events, duration) {
    const keyframes = [{ time: 0, type: 'start', description: 'Scene start' }];

    // Add event keyframes
    events.forEach((event) => {
      keyframes.push({
        time: event.time,
        type: 'event',
        event: event,
        description: `${event.type} event`,
      });
    });

    // Add end keyframe
    keyframes.push({
      time: duration,
      type: 'end',
      description: 'Scene end',
    });

    return keyframes.sort((a, b) => a.time - b.time);
  }

  /**
   * Sequence events with dependencies
   * @param {Array} events - Array of events
   * @returns {Array} - Sequenced events
   */
  sequenceEvents(events) {
    // Add sequence numbers
    return events.map((event, index) => ({
      ...event,
      sequence: index,
      dependencies: this.findDependencies(event, events, index),
    }));
  }

  /**
   * Find event dependencies
   * @param {Object} event - Current event
   * @param {Array} events - All events
   * @param {number} index - Current index
   * @returns {Array} - Array of dependency indices
   */
  findDependencies(event, events, index) {
    const dependencies = [];

    // Events depend on previous events in the same phase
    for (let i = 0; i < index; i++) {
      if (events[i].phase === event.phase) {
        dependencies.push(i);
      }
    }

    return dependencies;
  }

  /**
   * Get phase for a given time
   * @param {number} time - Time in seconds
   * @param {number} duration - Total duration
   * @returns {string} - Phase name
   */
  getPhaseForTime(time, duration) {
    const phases = this.definePhases(duration);

    if (time < phases.setup.end) {
      return 'setup';
    } else if (time < phases.action.end) {
      return 'action';
    } else {
      return 'resolution';
    }
  }

  /**
   * Get events in a specific phase
   * @param {Object} timeline - Timeline object
   * @param {string} phase - Phase name
   * @returns {Array} - Events in phase
   */
  getEventsInPhase(timeline, phase) {
    return timeline.events.filter((event) => event.phase === phase);
  }

  /**
   * Get event count
   * @param {Object} timeline - Timeline object
   * @returns {number} - Total event count
   */
  getEventCount(timeline) {
    return timeline.events.length;
  }
}

module.exports = KeyframePlanner;
