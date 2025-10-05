# CameraController Guide

## Overview

The CameraController manages cinematic camera movements for the 3D renderer. It supports multiple shot types, smooth transitions, and deterministic rendering for video generation.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   CameraController                       │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌────────────────────────────────────────────────┐    │
│  │         Shot Registry & Timing                 │    │
│  │  - shots[]                                     │    │
│  │  - currentShotIndex                            │    │
│  │  - useDefaultOrbital                           │    │
│  └────────────────────────────────────────────────┘    │
│                        │                                 │
│                        ▼                                 │
│  ┌────────────────────────────────────────────────┐    │
│  │         update(time)                           │    │
│  │  1. Find current shot                          │    │
│  │  2. Calculate progress (0-1)                   │    │
│  │  3. Apply shot type                            │    │
│  └────────────────────────────────────────────────┘    │
│                        │                                 │
│         ┌──────────────┴──────────────┐                │
│         ▼                              ▼                 │
│  ┌─────────────┐              ┌──────────────┐         │
│  │ Shot Types  │              │  Utilities   │         │
│  │             │              │              │         │
│  │ • Orbital   │              │ • lookAt()   │         │
│  │ • Flythrough│              │ • interpolate│         │
│  │ • Establish │              │ • easing     │         │
│  │ • Close-up  │              │ • resolve    │         │
│  │ • Pull-back │              │   target     │         │
│  └─────────────┘              └──────────────┘         │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

## Shot Types

### 1. Orbital Shot

Circles camera around a target point.

```
     Camera Path (top view)

    ↗ ─ ─ ─ ─ ─ ─ ↖
   ↗               ↖
  ↗                 ↖
 ↗                   ↖
→        Target       ←  (distance)
 ↘                   ↗
  ↘                 ↗
   ↘               ↗
    ↘ ─ ─ ─ ─ ─ ─ ↙
```

**Parameters:**

- `target`: Center point [x, y, z]
- `distance`: Radius of orbit
- `speed`: Rotation speed multiplier
- `height`: Camera height above target

**Use Cases:**

- Showcasing objects from all angles
- Creating dynamic establishing shots
- Continuous scene exploration

### 2. Flythrough Shot

Moves camera along a defined path.

```
    Path Waypoints

    Start → P1 → P2 → P3 → End
      ●─────●─────●─────●─────●

    Camera smoothly interpolates
    between waypoints with easing
```

**Parameters:**

- `target`: Point to look at
- `path`: Array of waypoints [{x,y,z}, ...]
- Default path if not specified

**Use Cases:**

- Guided tours through scenes
- Dramatic camera movements
- Revealing scene elements sequentially

### 3. Establish Shot

Static wide-angle view of the scene.

```
    Camera (static)
         ●
          \
           \  (distance)
            \
             ▼
          Target
```

**Parameters:**

- `target`: Point to look at
- `distance`: Distance from target
- `angle`: Viewing angle (radians)
- `height`: Camera height

**Use Cases:**

- Scene-setting shots
- Showing full context
- Stable reference frames

### 4. Close-up Shot

Focuses tightly on a specific object.

```
    Camera (close)
       ●
        \
         \ (small distance)
          ▼
       Target
```

**Parameters:**

- `target`: Object to focus on
- `distance`: Close distance (default 15)
- `angle`: Viewing angle
- `heightOffset`: Height above target

**Use Cases:**

- Detail shots
- Focusing on specific elements
- Dramatic emphasis

### 5. Pull-back Shot

Zooms out from close to wide view.

```
    Time: 0%          50%          100%

    Camera:  ●  →  →  →  ●  →  →  →  ●
            close    mid       wide
             |        |         |
             ▼        ▼         ▼
                   Target
```

**Parameters:**

- `target`: Point to look at
- `startDistance`: Initial close distance
- `endDistance`: Final wide distance
- `angle`: Viewing angle

**Use Cases:**

- Dramatic reveals
- Showing context after detail
- Transition shots

## Timing and Transitions

### Shot Sequence

```
Timeline (seconds):
0────5────10───15───20───25───30
│    │    │    │    │    │    │
Shot1│    Shot2│    Shot3│    Shot4
     │         │         │
     └─────────┴─────────┴─── Smooth transitions
```

Each shot has:

- `startTime`: When shot begins
- `duration`: How long shot lasts
- Automatic transition to next shot

### Progress Calculation

```javascript
// For a shot from t=10 to t=20 (duration=10)
// At time t=15:

localTime = 15 - 10 = 5
progress = 5 / 10 = 0.5  // 50% through shot

// Progress is used for:
// - Interpolation in flythrough
// - Distance in pull-back
// - Easing calculations
```

### Easing Functions

```
Linear:           Ease In:         Ease Out:        Ease In-Out:

│                 │                │                │
│    /            │      /         │  /             │    ___/
│   /             │     /          │ /              │   /
│  /              │    /           │/               │  /
│ /               │   /            /                │ /
│/                │  /            /│                │/
└─────            └─────          └─────            └─────
0    1            0    1          0    1            0    1
```

## Target Resolution

The controller supports multiple target formats:

```javascript
// 1. Array format
target: [10, 20, 30]  // x, y, z

// 2. Object format
target: { x: 10, y: 20, z: 30 }

// 3. Structure ID (string)
target: "main_building"  // Looks up in scene

// 4. Default (if not specified)
target: null  // Uses {x: 0, y: 0, z: 0}
```

## Usage Examples

### Single Orbital Shot

```javascript
const cameraController = new CameraController(camera, scene);

cameraController.setupShots([
  {
    type: 'orbital',
    startTime: 0,
    duration: 30,
    target: [0, 10, 0],
    distance: 80,
    speed: 1.0,
  },
]);

// Update for specific time
cameraController.update(15.0); // Halfway through orbit
```

### Multiple Shot Sequence

```javascript
cameraController.setupShots([
  // Start with wide establishing shot
  {
    type: 'establish',
    startTime: 0,
    duration: 5,
    target: [0, 10, 0],
    distance: 150,
  },
  // Orbit around the scene
  {
    type: 'orbital',
    startTime: 5,
    duration: 10,
    target: [0, 10, 0],
    distance: 60,
    speed: 1.5,
  },
  // Close up on main object
  {
    type: 'close_up',
    startTime: 15,
    duration: 5,
    target: 'main_structure',
    distance: 20,
  },
  // Pull back to reveal
  {
    type: 'pull_back',
    startTime: 20,
    duration: 10,
    target: [0, 10, 0],
    startDistance: 20,
    endDistance: 100,
  },
]);
```

### Default Orbital View

```javascript
// No cinematography specified
cameraController.setupShots([]);

// Automatically uses slow orbital around origin
cameraController.update(10.0);
```

### Flythrough with Custom Path

```javascript
cameraController.setupShots([
  {
    type: 'flythrough',
    startTime: 0,
    duration: 30,
    target: [0, 10, 0],
    path: [
      { x: -100, y: 50, z: -100 }, // Start far away
      { x: -50, y: 30, z: 0 }, // Approach
      { x: 0, y: 20, z: 50 }, // Pass through
      { x: 50, y: 30, z: 0 }, // Continue
      { x: 100, y: 50, z: -100 }, // End far away
    ],
  },
]);
```

## Integration with SceneRenderer

```javascript
// In SceneRenderer.loadScene()
if (dreamData.cinematography) {
  this.setupCinematography(dreamData.cinematography);
}

// In SceneRenderer.setupCinematography()
if (!this.cameraController) {
  this.cameraController = new CameraController(this.camera, this.scene);
}
this.cameraController.setupShots(cinematography.shots);

// In SceneRenderer.seek() and _updateSubsystems()
if (this.cameraController) {
  this.cameraController.update(time);
}
```

## Dream JSON Schema

```json
{
  "cinematography": {
    "durationSec": 30,
    "shots": [
      {
        "type": "orbital",
        "startTime": 0,
        "duration": 10,
        "target": [0, 10, 0],
        "distance": 80,
        "speed": 1.0,
        "height": 40
      },
      {
        "type": "close_up",
        "startTime": 10,
        "duration": 5,
        "target": "structure_id",
        "distance": 20,
        "angle": 0.785,
        "heightOffset": 5
      }
    ]
  }
}
```

## Best Practices

### 1. Shot Duration

- Establish shots: 3-5 seconds
- Orbital shots: 8-15 seconds
- Close-ups: 3-5 seconds
- Pull-backs: 5-10 seconds
- Flythroughs: 10-20 seconds

### 2. Shot Sequencing

- Start with establish shot to set context
- Use orbital for exploration
- Close-ups for emphasis
- Pull-backs for reveals
- End with wide shot

### 3. Target Selection

- Use structure IDs for dynamic targets
- Use coordinates for fixed points
- Ensure targets are visible in shot
- Consider target height

### 4. Distance Guidelines

- Establish: 100-200 units
- Orbital: 50-100 units
- Close-up: 10-30 units
- Pull-back: 10 → 100 units

### 5. Performance

- Keep shot count reasonable (< 20)
- Avoid very short shots (< 1 second)
- Use appropriate easing for smooth motion
- Test with time scrubbing

## Troubleshooting

### Camera Not Moving

- Check if shots array is empty
- Verify startTime and duration
- Ensure update() is being called
- Check if time is within shot range

### Jerky Camera Movement

- Use easing functions
- Increase shot duration
- Check frame rate
- Verify smooth time progression

### Camera Looking Wrong Direction

- Verify target coordinates
- Check if structure ID exists
- Ensure lookAt() is called
- Verify target is not at camera position

### Shots Not Transitioning

- Check shot startTime values
- Ensure shots don't overlap
- Verify duration is positive
- Check time progression

## Testing

Use `test-camera-controller.html` to:

- Visually verify all shot types
- Test shot transitions
- Scrub through time
- Verify deterministic rendering
- Test multiple shot sequences

## Performance Characteristics

- **Shot Lookup**: O(n) where n = number of shots
- **Update Time**: < 1ms per frame
- **Memory**: Minimal (shot array + state)
- **Deterministic**: Yes (same time = same position)

## Future Enhancements

Possible additions:

- Bezier curve paths for flythrough
- Camera shake effects
- Focus pulling (depth of field)
- Motion blur parameters
- Camera roll/tilt
- Spline-based paths
- Keyframe animation
