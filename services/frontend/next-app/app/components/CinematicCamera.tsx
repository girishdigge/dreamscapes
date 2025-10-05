// services/frontend/next-app/app/components/CinematicCamera.tsx
'use client';

import { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Dream, CameraShot } from '../types/dream';

interface CinematicCameraProps {
  dream: Dream;
  isPlaying: boolean;
  currentTime: number;
  onTimeUpdate: (time: number) => void;
}

// Cinematic FOV range constants
const CINEMATIC_FOV_MIN = 35;
const CINEMATIC_FOV_MAX = 45;
const CINEMATIC_FOV_DEFAULT = 40;

// Shot transition configuration
const DEFAULT_TRANSITION_DURATION = 1.0; // seconds

interface ShotTransitionState {
  fromShot: CameraShot | null;
  toShot: CameraShot | null;
  transitionStartTime: number;
  transitionDuration: number;
  isTransitioning: boolean;
}

// Rule of thirds composition offsets
interface RuleOfThirdsOffset {
  horizontal: number; // -1 (left), 0 (center), 1 (right)
  vertical: number; // -1 (bottom), 0 (center), 1 (top)
}

// Target tracking state for look-ahead
interface TargetTrackingState {
  lastPosition: THREE.Vector3;
  velocity: THREE.Vector3;
  predictedPosition: THREE.Vector3;
}

export default function CinematicCamera({
  dream,
  isPlaying,
  currentTime,
  onTimeUpdate,
}: CinematicCameraProps) {
  const { camera, scene } = useThree();
  const lastTimeRef = useRef<number>(0);
  const transitionStateRef = useRef<ShotTransitionState>({
    fromShot: null,
    toShot: null,
    transitionStartTime: 0,
    transitionDuration: DEFAULT_TRANSITION_DURATION,
    isTransitioning: false,
  });
  const previousShotIndexRef = useRef<number>(-1);
  const targetTrackingRef = useRef<Map<string, TargetTrackingState>>(new Map());

  // Get camera shots from new schema or fallback to legacy
  const cameraShots = dream.camera || [];

  // Initialize camera position
  useEffect(() => {
    if (cameraShots.length > 0) {
      const firstShot = cameraShots[0];
      camera.position.set(...firstShot.position);

      if (firstShot.lookAt) {
        camera.lookAt(new THREE.Vector3(...firstShot.lookAt));
      } else if (firstShot.target) {
        // Look at target structure
        const targetObj = scene.getObjectByName(firstShot.target);
        if (targetObj) {
          camera.lookAt(targetObj.position);
        }
      }

      // Apply cinematic FOV (clamp to 35-45 range)
      if (camera instanceof THREE.PerspectiveCamera) {
        const fov = firstShot.fov || CINEMATIC_FOV_DEFAULT;
        camera.fov = THREE.MathUtils.clamp(
          fov,
          CINEMATIC_FOV_MIN,
          CINEMATIC_FOV_MAX
        );
        camera.updateProjectionMatrix();
      }
    } else {
      // No shots defined, ensure default cinematic FOV
      if (camera instanceof THREE.PerspectiveCamera) {
        camera.fov = CINEMATIC_FOV_DEFAULT;
        camera.updateProjectionMatrix();
      }
    }
  }, [camera, scene, cameraShots]);

  // Animation loop with shot transition blending
  useFrame((_state, delta) => {
    if (!isPlaying || cameraShots.length === 0) return;

    // Update time
    const newTime = currentTime + delta;
    onTimeUpdate(newTime);
    lastTimeRef.current = newTime;

    // Find current camera shot
    let currentShotIndex = -1;
    let currentShot: CameraShot | null = null;
    let shotProgress = 0;

    for (let i = 0; i < cameraShots.length; i++) {
      const shot = cameraShots[i];
      const shotEnd = shot.startTime + shot.duration;

      if (newTime >= shot.startTime && newTime < shotEnd) {
        currentShotIndex = i;
        currentShot = shot;
        shotProgress = (newTime - shot.startTime) / shot.duration;
        break;
      }
    }

    if (!currentShot) {
      // Use last shot if we're past the end
      currentShotIndex = cameraShots.length - 1;
      currentShot = cameraShots[currentShotIndex];
      shotProgress = 1;
    }

    // Detect shot change and initiate transition
    if (
      currentShotIndex !== previousShotIndexRef.current &&
      previousShotIndexRef.current !== -1
    ) {
      const previousShot = cameraShots[previousShotIndexRef.current];
      const transitionDuration =
        parseFloat(currentShot.transition) || DEFAULT_TRANSITION_DURATION;

      transitionStateRef.current = {
        fromShot: previousShot,
        toShot: currentShot,
        transitionStartTime: newTime,
        transitionDuration: transitionDuration,
        isTransitioning: true,
      };
    }
    previousShotIndexRef.current = currentShotIndex;

    // Handle shot transition blending
    const transitionState = transitionStateRef.current;
    if (
      transitionState.isTransitioning &&
      transitionState.fromShot &&
      transitionState.toShot
    ) {
      const transitionElapsed = newTime - transitionState.transitionStartTime;
      const transitionProgress = Math.min(
        transitionElapsed / transitionState.transitionDuration,
        1
      );

      if (transitionProgress >= 1) {
        // Transition complete
        transitionState.isTransitioning = false;
      } else {
        // Blend between shots
        const blendFactor = applyEasing(
          transitionProgress,
          'ease-in-out-cubic'
        );
        blendCameraShots(
          camera,
          scene,
          transitionState.fromShot,
          transitionState.toShot,
          blendFactor
        );

        // Blend FOV
        if (camera instanceof THREE.PerspectiveCamera) {
          const fromFov = transitionState.fromShot.fov || CINEMATIC_FOV_DEFAULT;
          const toFov = transitionState.toShot.fov || CINEMATIC_FOV_DEFAULT;
          const clampedFromFov = THREE.MathUtils.clamp(
            fromFov,
            CINEMATIC_FOV_MIN,
            CINEMATIC_FOV_MAX
          );
          const clampedToFov = THREE.MathUtils.clamp(
            toFov,
            CINEMATIC_FOV_MIN,
            CINEMATIC_FOV_MAX
          );
          camera.fov = THREE.MathUtils.lerp(
            clampedFromFov,
            clampedToFov,
            blendFactor
          );
          camera.updateProjectionMatrix();
        }
        return; // Skip normal shot update during transition
      }
    }

    // Apply easing to shot progress
    const easedProgress = applyEasing(
      shotProgress,
      currentShot.easing || 'ease-in-out'
    );

    // Update camera position based on movement type with tracking
    updateCameraPosition(
      camera,
      scene,
      currentShot,
      easedProgress,
      targetTrackingRef.current,
      delta
    );

    // Update FOV with cinematic range clamping
    if (camera instanceof THREE.PerspectiveCamera) {
      const targetFov = currentShot.fov || CINEMATIC_FOV_DEFAULT;
      const clampedFov = THREE.MathUtils.clamp(
        targetFov,
        CINEMATIC_FOV_MIN,
        CINEMATIC_FOV_MAX
      );
      camera.fov = THREE.MathUtils.lerp(camera.fov, clampedFov, 0.1);
      camera.updateProjectionMatrix();
    }
  });

  return null;
}

// Calculate rule-of-thirds offset for composition
function calculateRuleOfThirdsOffset(
  camera: THREE.Camera,
  targetPosition: THREE.Vector3,
  offset?: RuleOfThirdsOffset
): THREE.Vector3 {
  if (!offset || (offset.horizontal === 0 && offset.vertical === 0)) {
    return targetPosition;
  }

  // Get camera's right and up vectors
  const cameraDirection = new THREE.Vector3();
  camera.getWorldDirection(cameraDirection);

  const cameraRight = new THREE.Vector3();
  cameraRight
    .crossVectors(cameraDirection, new THREE.Vector3(0, 1, 0))
    .normalize();

  const cameraUp = new THREE.Vector3();
  cameraUp.crossVectors(cameraRight, cameraDirection).normalize();

  // Calculate distance to target for proportional offset
  const distance = camera.position.distanceTo(targetPosition);
  const offsetScale = distance * 0.15; // 15% of distance for rule-of-thirds

  // Apply offsets
  const offsetPosition = targetPosition.clone();
  offsetPosition.add(
    cameraRight.multiplyScalar(offset.horizontal * offsetScale)
  );
  offsetPosition.add(cameraUp.multiplyScalar(offset.vertical * offsetScale));

  return offsetPosition;
}

// Track target with velocity prediction for look-ahead
function trackTargetWithLookAhead(
  targetId: string,
  currentPosition: THREE.Vector3,
  trackingState: Map<string, TargetTrackingState>,
  delta: number,
  lookAheadFactor: number = 0.3
): THREE.Vector3 {
  let state = trackingState.get(targetId);

  if (!state) {
    // Initialize tracking state
    state = {
      lastPosition: currentPosition.clone(),
      velocity: new THREE.Vector3(0, 0, 0),
      predictedPosition: currentPosition.clone(),
    };
    trackingState.set(targetId, state);
    return currentPosition;
  }

  // Calculate velocity
  const displacement = new THREE.Vector3().subVectors(
    currentPosition,
    state.lastPosition
  );
  const velocity = displacement.divideScalar(delta);

  // Smooth velocity with exponential moving average
  state.velocity.lerp(velocity, 0.3);

  // Predict future position based on velocity
  const lookAheadTime = lookAheadFactor; // seconds
  state.predictedPosition = currentPosition
    .clone()
    .add(state.velocity.clone().multiplyScalar(lookAheadTime));

  // Update last position
  state.lastPosition.copy(currentPosition);

  return state.predictedPosition;
}

// Get target position with tracking and composition
function getTargetPositionWithComposition(
  scene: THREE.Scene,
  shot: CameraShot,
  trackingState: Map<string, TargetTrackingState>,
  camera: THREE.Camera,
  delta: number
): THREE.Vector3 {
  let targetPosition: THREE.Vector3;

  if (shot.target) {
    // Track dynamic target
    const targetObj = scene.getObjectByName(shot.target);
    if (targetObj) {
      const currentPos = targetObj.position.clone();
      // Apply look-ahead for moving targets
      targetPosition = trackTargetWithLookAhead(
        shot.target,
        currentPos,
        trackingState,
        delta,
        0.3
      );
    } else {
      targetPosition = new THREE.Vector3(0, 0, 0);
    }
  } else if (shot.lookAt) {
    // Static look-at position
    targetPosition = new THREE.Vector3(...shot.lookAt);
  } else {
    targetPosition = new THREE.Vector3(0, 0, 0);
  }

  // Apply rule-of-thirds composition if specified
  // This would be extended in the future to support custom offsets per shot
  // For now, we apply a default offset for tracking shots
  if (shot.movement === 'tracking' && shot.target) {
    const ruleOfThirdsOffset: RuleOfThirdsOffset = {
      horizontal: 0.33, // Place target slightly off-center
      vertical: 0.2, // Slightly above center
    };
    targetPosition = calculateRuleOfThirdsOffset(
      camera,
      targetPosition,
      ruleOfThirdsOffset
    );
  }

  return targetPosition;
}

// Blend between two camera shots for smooth transitions
function blendCameraShots(
  camera: THREE.Camera,
  scene: THREE.Scene,
  fromShot: CameraShot,
  toShot: CameraShot,
  blendFactor: number
) {
  // Blend positions
  const fromPos = new THREE.Vector3(...fromShot.position);
  const toPos = new THREE.Vector3(...toShot.position);
  camera.position.lerpVectors(fromPos, toPos, blendFactor);

  // Blend look-at targets
  let fromLookAt: THREE.Vector3;
  let toLookAt: THREE.Vector3;

  // Determine fromShot look-at target
  if (fromShot.lookAt) {
    fromLookAt = new THREE.Vector3(...fromShot.lookAt);
  } else if (fromShot.target) {
    const targetObj = scene.getObjectByName(fromShot.target);
    fromLookAt = targetObj
      ? targetObj.position.clone()
      : new THREE.Vector3(0, 0, 0);
  } else {
    fromLookAt = new THREE.Vector3(0, 0, 0);
  }

  // Determine toShot look-at target
  if (toShot.lookAt) {
    toLookAt = new THREE.Vector3(...toShot.lookAt);
  } else if (toShot.target) {
    const targetObj = scene.getObjectByName(toShot.target);
    toLookAt = targetObj
      ? targetObj.position.clone()
      : new THREE.Vector3(0, 0, 0);
  } else {
    toLookAt = new THREE.Vector3(0, 0, 0);
  }

  // Blend and apply look-at
  const blendedLookAt = new THREE.Vector3().lerpVectors(
    fromLookAt,
    toLookAt,
    blendFactor
  );
  camera.lookAt(blendedLookAt);
}

// Update camera position based on shot type with smooth easing
function updateCameraPosition(
  camera: THREE.Camera,
  scene: THREE.Scene,
  shot: CameraShot,
  progress: number,
  trackingState?: Map<string, TargetTrackingState>,
  delta: number = 0.016
) {
  const targetPos = new THREE.Vector3(...shot.position);

  switch (shot.movement) {
    case 'static':
      // Fixed camera position with subtle drift
      camera.position.lerp(targetPos, 0.1);
      if (shot.lookAt) {
        const lookTarget = new THREE.Vector3(...shot.lookAt);
        const currentTarget = new THREE.Vector3();
        camera.getWorldDirection(currentTarget);
        currentTarget.add(camera.position);
        currentTarget.lerp(lookTarget, 0.05);
        camera.lookAt(currentTarget);
      }
      break;

    case 'tracking':
      // Follow a target with smooth damping and rule-of-thirds composition
      camera.position.lerp(targetPos, 0.08);

      if (trackingState) {
        // Use advanced tracking with look-ahead and composition
        const composedTarget = getTargetPositionWithComposition(
          scene,
          shot,
          trackingState,
          camera,
          delta
        );

        const currentTarget = new THREE.Vector3();
        camera.getWorldDirection(currentTarget);
        currentTarget.add(camera.position);
        currentTarget.lerp(composedTarget, 0.1);
        camera.lookAt(currentTarget);
      } else {
        // Fallback to simple tracking
        if (shot.target) {
          const targetObj = scene.getObjectByName(shot.target);
          if (targetObj) {
            const currentTarget = new THREE.Vector3();
            camera.getWorldDirection(currentTarget);
            currentTarget.add(camera.position);
            currentTarget.lerp(targetObj.position, 0.1);
            camera.lookAt(currentTarget);
          }
        } else if (shot.lookAt) {
          const lookTarget = new THREE.Vector3(...shot.lookAt);
          const currentTarget = new THREE.Vector3();
          camera.getWorldDirection(currentTarget);
          currentTarget.add(camera.position);
          currentTarget.lerp(lookTarget, 0.08);
          camera.lookAt(currentTarget);
        }
      }
      break;

    case 'dolly_in':
      // Move closer to target with eased progress and optional dolly zoom
      const startPos = new THREE.Vector3(...shot.position);
      const targetObj = shot.target ? scene.getObjectByName(shot.target) : null;
      const targetPoint = shot.lookAt
        ? new THREE.Vector3(...shot.lookAt)
        : targetObj?.position || new THREE.Vector3(0, 0, 0);

      const direction = new THREE.Vector3()
        .subVectors(targetPoint, startPos)
        .normalize();
      const distance = startPos.distanceTo(targetPoint);
      const currentDistance = distance * (1 - progress * 0.5);

      camera.position
        .copy(startPos)
        .add(direction.multiplyScalar(distance - currentDistance));

      // Optional dolly zoom effect (Hitchcock zoom)
      // As camera moves in, slightly widen FOV to create unsettling effect
      if (camera instanceof THREE.PerspectiveCamera && progress > 0.2) {
        const initialFov = shot.fov || CINEMATIC_FOV_DEFAULT;
        const dollyZoomFactor = (progress - 0.2) * 3; // Subtle zoom effect
        const dollyFov = THREE.MathUtils.clamp(
          initialFov + dollyZoomFactor,
          CINEMATIC_FOV_MIN,
          CINEMATIC_FOV_MAX
        );
        camera.fov = THREE.MathUtils.lerp(camera.fov, dollyFov, 0.03);
        camera.updateProjectionMatrix();
      }

      // Smooth look-at
      const currentLookAt = new THREE.Vector3();
      camera.getWorldDirection(currentLookAt);
      currentLookAt.add(camera.position);
      currentLookAt.lerp(targetPoint, 0.1);
      camera.lookAt(currentLookAt);
      break;

    case 'pull_back':
      // Move away from target with eased progress
      const pullStartPos = new THREE.Vector3(...shot.position);
      const pullEndPos = pullStartPos.clone().multiplyScalar(1.5);
      camera.position.lerpVectors(pullStartPos, pullEndPos, progress);

      if (shot.lookAt) {
        const lookTarget = new THREE.Vector3(...shot.lookAt);
        const currentTarget = new THREE.Vector3();
        camera.getWorldDirection(currentTarget);
        currentTarget.add(camera.position);
        currentTarget.lerp(lookTarget, 0.08);
        camera.lookAt(currentTarget);
      }
      break;

    case 'orbit':
      // Orbit around target with smooth circular motion
      const center = shot.lookAt
        ? new THREE.Vector3(...shot.lookAt)
        : new THREE.Vector3(0, 0, 0);
      const radius = new THREE.Vector3(...shot.position).distanceTo(center);
      const angle = progress * Math.PI * 2;

      const newPos = new THREE.Vector3(
        center.x + Math.cos(angle) * radius,
        shot.position[1],
        center.z + Math.sin(angle) * radius
      );

      camera.position.lerp(newPos, 0.1);

      // Smooth look-at center
      const currentOrbitTarget = new THREE.Vector3();
      camera.getWorldDirection(currentOrbitTarget);
      currentOrbitTarget.add(camera.position);
      currentOrbitTarget.lerp(center, 0.1);
      camera.lookAt(currentOrbitTarget);
      break;

    case 'establish':
      // Slow establishing shot with very gradual movement
      camera.position.lerp(targetPos, progress * 0.3);
      if (shot.lookAt) {
        const lookTarget = new THREE.Vector3(...shot.lookAt);
        const currentTarget = new THREE.Vector3();
        camera.getWorldDirection(currentTarget);
        currentTarget.add(camera.position);
        currentTarget.lerp(lookTarget, 0.05);
        camera.lookAt(currentTarget);
      }
      break;

    case 'flythrough':
      // Dynamic flythrough with smooth interpolation
      camera.position.lerp(targetPos, progress);
      if (shot.lookAt) {
        const lookTarget = new THREE.Vector3(...shot.lookAt);
        const currentTarget = new THREE.Vector3();
        camera.getWorldDirection(currentTarget);
        currentTarget.add(camera.position);
        currentTarget.lerp(lookTarget, 0.15);
        camera.lookAt(currentTarget);
      }
      break;

    case 'cinematic_pan':
      // Smooth panning shot
      camera.position.lerp(targetPos, progress * 0.5);
      if (shot.lookAt) {
        const panTarget = new THREE.Vector3(...shot.lookAt);
        const currentTarget = new THREE.Vector3();
        camera.getWorldDirection(currentTarget);
        currentTarget.add(camera.position);
        currentTarget.lerp(panTarget, 0.08);
        camera.lookAt(currentTarget);
      }
      break;

    case 'crane':
      // Crane movement (vertical + horizontal combined)
      const craneStartPos = new THREE.Vector3(...shot.position);
      const craneCenter = shot.lookAt
        ? new THREE.Vector3(...shot.lookAt)
        : new THREE.Vector3(0, 0, 0);

      // Calculate crane arc (rising or descending while moving)
      const craneRadius = craneStartPos.distanceTo(craneCenter);
      const craneAngle = progress * Math.PI * 0.5; // 90 degree arc

      // Vertical movement (crane up/down)
      const verticalOffset = Math.sin(craneAngle) * craneRadius * 0.5;

      // Horizontal circular movement
      const horizontalAngle = progress * Math.PI * 0.3; // 54 degree horizontal sweep

      const cranePos = new THREE.Vector3(
        craneCenter.x + Math.cos(horizontalAngle) * craneRadius,
        craneStartPos.y + verticalOffset,
        craneCenter.z + Math.sin(horizontalAngle) * craneRadius
      );

      camera.position.lerp(cranePos, 0.1);

      // Look at center with smooth interpolation
      const craneTarget = new THREE.Vector3();
      camera.getWorldDirection(craneTarget);
      craneTarget.add(camera.position);
      craneTarget.lerp(craneCenter, 0.1);
      camera.lookAt(craneTarget);
      break;

    case 'handheld':
      // Handheld camera shake effect for realism
      const handheldBase = new THREE.Vector3(...shot.position);
      const shakeIntensity = 0.05; // Subtle shake
      const shakeFrequency = 8; // Hz

      // Generate procedural shake using multiple sine waves
      const time = progress * shot.duration;
      const shakeX = Math.sin(time * shakeFrequency) * shakeIntensity;
      const shakeY =
        Math.sin(time * shakeFrequency * 1.3) * shakeIntensity * 0.7;
      const shakeZ =
        Math.sin(time * shakeFrequency * 0.8) * shakeIntensity * 0.5;

      const handheldPos = handheldBase
        .clone()
        .add(new THREE.Vector3(shakeX, shakeY, shakeZ));

      camera.position.lerp(handheldPos, 0.3);

      // Add subtle rotation shake
      if (shot.lookAt) {
        const handheldTarget = new THREE.Vector3(...shot.lookAt);
        const rotShakeX = Math.sin(time * shakeFrequency * 1.1) * 0.002;
        const rotShakeY = Math.sin(time * shakeFrequency * 0.9) * 0.002;
        handheldTarget.add(new THREE.Vector3(rotShakeX, rotShakeY, 0));

        const currentTarget = new THREE.Vector3();
        camera.getWorldDirection(currentTarget);
        currentTarget.add(camera.position);
        currentTarget.lerp(handheldTarget, 0.2);
        camera.lookAt(currentTarget);
      }
      break;

    case 'close_up':
      // Close-up shot with dolly zoom effect (vertigo effect)
      const closeUpStart = new THREE.Vector3(...shot.position);
      const closeUpTarget = shot.lookAt
        ? new THREE.Vector3(...shot.lookAt)
        : shot.target
        ? scene.getObjectByName(shot.target)?.position ||
          new THREE.Vector3(0, 0, 0)
        : new THREE.Vector3(0, 0, 0);

      // Move camera closer
      const closeUpDirection = new THREE.Vector3()
        .subVectors(closeUpTarget, closeUpStart)
        .normalize();
      const closeUpDistance = closeUpStart.distanceTo(closeUpTarget);
      const closeUpProgress = progress * 0.6; // Move 60% closer

      const closeUpPos = closeUpStart
        .clone()
        .add(
          closeUpDirection.multiplyScalar(closeUpDistance * closeUpProgress)
        );

      camera.position.lerp(closeUpPos, 0.08);

      // Dolly zoom: adjust FOV to maintain subject size
      if (camera instanceof THREE.PerspectiveCamera) {
        const initialFov = shot.fov || CINEMATIC_FOV_DEFAULT;
        // As we move closer, widen FOV slightly to maintain framing
        const fovAdjustment = closeUpProgress * 5; // Up to 5 degrees wider
        const adjustedFov = THREE.MathUtils.clamp(
          initialFov + fovAdjustment,
          CINEMATIC_FOV_MIN,
          CINEMATIC_FOV_MAX
        );
        camera.fov = THREE.MathUtils.lerp(camera.fov, adjustedFov, 0.05);
        camera.updateProjectionMatrix();
      }

      // Smooth look-at
      const closeUpLookAt = new THREE.Vector3();
      camera.getWorldDirection(closeUpLookAt);
      closeUpLookAt.add(camera.position);
      closeUpLookAt.lerp(closeUpTarget, 0.1);
      camera.lookAt(closeUpLookAt);
      break;

    default:
      // Default smooth movement with damping
      camera.position.lerp(targetPos, 0.05);
      if (shot.lookAt) {
        const lookTarget = new THREE.Vector3(...shot.lookAt);
        const currentTarget = new THREE.Vector3();
        camera.getWorldDirection(currentTarget);
        currentTarget.add(camera.position);
        currentTarget.lerp(lookTarget, 0.05);
        camera.lookAt(currentTarget);
      } else if (shot.target) {
        const obj = scene.getObjectByName(shot.target);
        if (obj) {
          const currentTarget = new THREE.Vector3();
          camera.getWorldDirection(currentTarget);
          currentTarget.add(camera.position);
          currentTarget.lerp(obj.position, 0.05);
          camera.lookAt(currentTarget);
        }
      }
      break;
  }
}

// Comprehensive easing functions for smooth camera movements
function applyEasing(t: number, easing: string): number {
  // Clamp t to [0, 1]
  t = Math.max(0, Math.min(1, t));

  switch (easing) {
    case 'linear':
      return t;

    // Quadratic easing
    case 'ease-in':
    case 'ease-in-quad':
      return t * t;
    case 'ease-out':
    case 'ease-out-quad':
      return t * (2 - t);
    case 'ease-in-out':
    case 'ease-in-out-quad':
      return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

    // Cubic easing
    case 'ease-in-cubic':
      return t * t * t;
    case 'ease-out-cubic':
      return --t * t * t + 1;
    case 'ease-in-out-cubic':
      return t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;

    // Quartic easing
    case 'ease-in-quart':
      return t * t * t * t;
    case 'ease-out-quart':
      return 1 - --t * t * t * t;
    case 'ease-in-out-quart':
      return t < 0.5 ? 8 * t * t * t * t : 1 - 8 * --t * t * t * t;

    // Quintic easing
    case 'ease-in-quint':
      return t * t * t * t * t;
    case 'ease-out-quint':
      return 1 + --t * t * t * t * t;
    case 'ease-in-out-quint':
      return t < 0.5 ? 16 * t * t * t * t * t : 1 + 16 * --t * t * t * t * t;

    // Sine easing
    case 'ease-in-sine':
      return 1 - Math.cos((t * Math.PI) / 2);
    case 'ease-out-sine':
      return Math.sin((t * Math.PI) / 2);
    case 'ease-in-out-sine':
      return -(Math.cos(Math.PI * t) - 1) / 2;

    // Exponential easing
    case 'ease-in-expo':
      return t === 0 ? 0 : Math.pow(2, 10 * t - 10);
    case 'ease-out-expo':
      return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
    case 'ease-in-out-expo':
      return t === 0
        ? 0
        : t === 1
        ? 1
        : t < 0.5
        ? Math.pow(2, 20 * t - 10) / 2
        : (2 - Math.pow(2, -20 * t + 10)) / 2;

    // Circular easing
    case 'ease-in-circ':
      return 1 - Math.sqrt(1 - Math.pow(t, 2));
    case 'ease-out-circ':
      return Math.sqrt(1 - Math.pow(t - 1, 2));
    case 'ease-in-out-circ':
      return t < 0.5
        ? (1 - Math.sqrt(1 - Math.pow(2 * t, 2))) / 2
        : (Math.sqrt(1 - Math.pow(-2 * t + 2, 2)) + 1) / 2;

    // Back easing (overshoots)
    case 'ease-in-back': {
      const c1 = 1.70158;
      const c3 = c1 + 1;
      return c3 * t * t * t - c1 * t * t;
    }
    case 'ease-out-back': {
      const c1 = 1.70158;
      const c3 = c1 + 1;
      return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    }
    case 'ease-in-out-back': {
      const c1 = 1.70158;
      const c2 = c1 * 1.525;
      return t < 0.5
        ? (Math.pow(2 * t, 2) * ((c2 + 1) * 2 * t - c2)) / 2
        : (Math.pow(2 * t - 2, 2) * ((c2 + 1) * (t * 2 - 2) + c2) + 2) / 2;
    }

    // Elastic easing (spring-like)
    case 'ease-in-elastic': {
      const c4 = (2 * Math.PI) / 3;
      return t === 0
        ? 0
        : t === 1
        ? 1
        : -Math.pow(2, 10 * t - 10) * Math.sin((t * 10 - 10.75) * c4);
    }
    case 'ease-out-elastic': {
      const c4 = (2 * Math.PI) / 3;
      return t === 0
        ? 0
        : t === 1
        ? 1
        : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
    }
    case 'ease-in-out-elastic': {
      const c5 = (2 * Math.PI) / 4.5;
      return t === 0
        ? 0
        : t === 1
        ? 1
        : t < 0.5
        ? -(Math.pow(2, 20 * t - 10) * Math.sin((20 * t - 11.125) * c5)) / 2
        : (Math.pow(2, -20 * t + 10) * Math.sin((20 * t - 11.125) * c5)) / 2 +
          1;
    }

    // Bounce easing
    case 'ease-out-bounce':
      return bounceOut(t);
    case 'ease-in-bounce':
      return 1 - bounceOut(1 - t);
    case 'ease-in-out-bounce':
      return t < 0.5
        ? (1 - bounceOut(1 - 2 * t)) / 2
        : (1 + bounceOut(2 * t - 1)) / 2;

    // Cubic bezier (common presets)
    case 'cubic-bezier-smooth':
      return cubicBezier(t, 0.25, 0.1, 0.25, 1);
    case 'cubic-bezier-ease':
      return cubicBezier(t, 0.42, 0, 1, 1);
    case 'cubic-bezier-ease-in':
      return cubicBezier(t, 0.42, 0, 1, 1);
    case 'cubic-bezier-ease-out':
      return cubicBezier(t, 0, 0, 0.58, 1);
    case 'cubic-bezier-ease-in-out':
      return cubicBezier(t, 0.42, 0, 0.58, 1);

    default:
      // Default to ease-in-out for smooth cinematic feel
      return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
  }
}

// Helper function for bounce easing
function bounceOut(t: number): number {
  const n1 = 7.5625;
  const d1 = 2.75;

  if (t < 1 / d1) {
    return n1 * t * t;
  } else if (t < 2 / d1) {
    return n1 * (t -= 1.5 / d1) * t + 0.75;
  } else if (t < 2.5 / d1) {
    return n1 * (t -= 2.25 / d1) * t + 0.9375;
  } else {
    return n1 * (t -= 2.625 / d1) * t + 0.984375;
  }
}

// Helper function for cubic bezier easing
function cubicBezier(
  t: number,
  p1: number,
  p2: number,
  p3: number,
  p4: number
): number {
  // Simplified cubic bezier calculation
  const cx = 3 * p1;
  const bx = 3 * (p3 - p1) - cx;
  const ax = 1 - cx - bx;

  const cy = 3 * p2;
  const by = 3 * (p4 - p2) - cy;
  const ay = 1 - cy - by;

  const tSquared = t * t;
  const tCubed = tSquared * t;

  return ay * tCubed + by * tSquared + cy * t;
}
