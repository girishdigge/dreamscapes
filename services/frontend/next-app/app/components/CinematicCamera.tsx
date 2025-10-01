// services/frontend/next-app/app/components/CinematicCamera.tsx
'use client';

import { useRef, useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import {
  Dream,
  DreamCinematographyShot,
  DreamStructure,
  DreamEntity,
} from '../types/dream';

interface CinematicCameraProps {
  dream: Dream;
  isPlaying: boolean;
  currentTime: number;
  onTimeUpdate: (time: number) => void;
}

interface InitialCameraState {
  position: THREE.Vector3;
  target: THREE.Vector3;
  fov: number;
}

interface InitialCameraState {
  position: THREE.Vector3;
  target: THREE.Vector3;
  fov: number;
}

export default function CinematicCamera({
  dream,
  isPlaying,
  currentTime,
  onTimeUpdate,
}: CinematicCameraProps) {
  const { camera } = useThree();
  const startTimeRef = useRef<number | null>(null);
  const initialPositionRef = useRef<InitialCameraState | null>(null);
  const lookAtTargetRef = useRef(new THREE.Vector3());
  const currentShotRef = useRef<{
    type: string;
    progress: number;
    position: number[];
    lookAt: number[];
  } | null>(null);

  const cinematography = dream.cinematography || {
    durationSec: 30,
    shots: [
      {
        type: 'establish',
        target: 's1',
        duration: 30,
        startPos: [0, 30, 50],
        endPos: [0, 15, -20],
      },
    ],
  };

  // Pre-calculate shot timeline for smooth transitions
  const shotTimeline = useMemo(() => {
    let accumulatedTime = 0;
    return cinematography.shots.map((shot, index) => {
      const startTime = accumulatedTime;
      const endTime = accumulatedTime + shot.duration;
      accumulatedTime += shot.duration;

      return {
        ...shot,
        startTime,
        endTime,
        index,
      };
    });
  }, [cinematography.shots]);

  // Store initial camera state
  useEffect(() => {
    if (!initialPositionRef.current) {
      initialPositionRef.current = {
        position: camera.position.clone(),
        target: new THREE.Vector3(0, 0, 0),
        fov: (camera as THREE.PerspectiveCamera).fov || 60,
      };
    }
  }, [camera]);

  // Handle playback state changes
  useEffect(() => {
    if (isPlaying && !startTimeRef.current) {
      startTimeRef.current = Date.now() - currentTime * 1000;
    } else if (!isPlaying) {
      startTimeRef.current = null;
    }
  }, [isPlaying, currentTime]);

  // Reset camera to initial position when not playing
  useEffect(() => {
    if (!isPlaying && initialPositionRef.current) {
      camera.position.lerp(initialPositionRef.current.position, 0.1);
      camera.lookAt(initialPositionRef.current.target);
      if (camera instanceof THREE.PerspectiveCamera) {
        camera.fov = initialPositionRef.current.fov;
        camera.updateProjectionMatrix();
      }
    }
  }, [isPlaying, camera]);

  useFrame((state, delta) => {
    if (!isPlaying || !shotTimeline.length) return;

    // Update current time
    const now = Date.now();
    if (startTimeRef.current) {
      const elapsed = (now - startTimeRef.current) / 1000;
      const totalDuration = cinematography.durationSec;

      if (elapsed >= totalDuration) {
        onTimeUpdate(totalDuration);
        return;
      }

      onTimeUpdate(elapsed);
    }

    // Find current shot and next shot for smooth transitions
    const currentShot = shotTimeline.find(
      (shot) => currentTime >= shot.startTime && currentTime < shot.endTime
    );

    if (!currentShot) return;

    const shotProgress =
      (currentTime - currentShot.startTime) / currentShot.duration;

    // Get next shot for smooth transitions
    const nextShotIndex = currentShot.index + 1;
    const nextShot =
      nextShotIndex < shotTimeline.length ? shotTimeline[nextShotIndex] : null;

    // Calculate camera transform
    const { position, lookAt, fov } = calculateAdvancedCameraTransform(
      currentShot,
      shotProgress,
      nextShot,
      dream.structures || [],
      dream.entities || [],
      dream.style
    );

    // Apply smooth camera movement with easing
    const lerpFactor = Math.min(delta * 2, 0.1); // Smooth but responsive
    camera.position.lerp(position, lerpFactor);

    // Smooth lookAt transition
    lookAtTargetRef.current.lerp(lookAt, lerpFactor);
    camera.lookAt(lookAtTargetRef.current);

    // FOV animation for dramatic effect
    if (
      fov &&
      camera instanceof THREE.PerspectiveCamera &&
      Math.abs(camera.fov - fov) > 0.1
    ) {
      camera.fov = THREE.MathUtils.lerp(camera.fov, fov, lerpFactor);
      camera.updateProjectionMatrix();
    }

    // Store current shot reference for debugging
    currentShotRef.current = {
      ...currentShot,
      progress: shotProgress,
      position: position.toArray(),
      lookAt: lookAt.toArray(),
    };
  });

  return null; // This component doesn't render anything visible
}

function calculateAdvancedCameraTransform(
  shot: DreamCinematographyShot,
  progress: number,
  nextShot: DreamCinematographyShot | null,
  structures: DreamStructure[],
  entities: DreamEntity[],
  style: string
) {
  const { type, target, startPos, endPos } = shot;

  // Enhanced easing functions for smoother motion
  const easeInOutCubic = (t: number): number =>
    t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const easeInOutQuart = (t: number): number =>
    t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2;
  const easeInOutSine = (t: number): number => -(Math.cos(Math.PI * t) - 1) / 2;

  // Apply easing based on shot type
  let easedProgress;
  switch (type) {
    case 'establish':
      easedProgress = easeInOutSine(progress);
      break;
    case 'flythrough':
      easedProgress = easeInOutQuart(progress);
      break;
    case 'orbit':
      easedProgress = progress; // Linear for orbits
      break;
    default:
      easedProgress = easeInOutCubic(progress);
  }

  // Default positions with style-based variations
  const getStyleDefaults = (
    style: string
  ): {
    defaultStart: [number, number, number];
    defaultEnd: [number, number, number];
    fov: number;
  } => {
    switch (style) {
      case 'cyberpunk':
        return {
          defaultStart: [0, 20, 40],
          defaultEnd: [0, 25, -30],
          fov: 75,
        };
      case 'nightmare':
        return {
          defaultStart: [0, 10, 60],
          defaultEnd: [0, 5, -40],
          fov: 85,
        };
      case 'surreal':
        return {
          defaultStart: [30, 40, 30],
          defaultEnd: [-30, 20, -30],
          fov: 65,
        };
      case 'fantasy':
        return {
          defaultStart: [0, 35, 45],
          defaultEnd: [0, 20, -25],
          fov: 70,
        };
      default: // ethereal
        return {
          defaultStart: [0, 30, 50],
          defaultEnd: [0, 15, -20],
          fov: 60,
        };
    }
  };

  const styleDefaults = getStyleDefaults(style);
  const defaultStart = startPos || styleDefaults.defaultStart;
  const defaultEnd = endPos || styleDefaults.defaultEnd;
  const baseFov = styleDefaults.fov;

  // Find target object with enhanced search
  let targetObject = null;
  let targetPos = new THREE.Vector3(0, 20, 0); // Default target

  if (target) {
    targetObject =
      structures.find((s) => s.id === target) ||
      entities.find((e) => e.id === target);

    if (targetObject && targetObject.pos) {
      targetPos = new THREE.Vector3(...targetObject.pos);
    }
  }

  switch (type) {
    case 'establish': {
      // Wide establishing shot with smooth curve
      const start = new THREE.Vector3(...defaultStart);
      const end = new THREE.Vector3(...defaultEnd);

      // Add subtle curve for more cinematic movement
      const midPoint = start.clone().lerp(end, 0.5);
      midPoint.y += 10 * Math.sin(Math.PI * easedProgress);

      const position = start
        .clone()
        .lerp(midPoint, easedProgress * 2)
        .lerp(end, Math.max(0, easedProgress * 2 - 1));

      return {
        position,
        lookAt: targetPos,
        fov: baseFov + Math.sin(easedProgress * Math.PI) * 5, // Slight FOV breathing
      };
    }

    case 'orbit': {
      // Smooth orbital motion with height variation
      const radius = 35 + Math.sin(progress * Math.PI * 2) * 5;
      const baseHeight = 25;
      const heightVariation = Math.sin(progress * Math.PI * 4) * 8;
      const angle = progress * Math.PI * 2;

      // Add some randomness for more organic movement
      const noise = Math.sin(progress * Math.PI * 8) * 2;

      const position = new THREE.Vector3(
        targetPos.x + Math.cos(angle) * (radius + noise),
        targetPos.y + baseHeight + heightVariation,
        targetPos.z + Math.sin(angle) * (radius - noise)
      );

      return {
        position,
        lookAt: targetPos.clone().add(new THREE.Vector3(0, 5, 0)), // Look slightly above target
        fov: baseFov - 5, // Tighter FOV for orbits
      };
    }

    case 'flythrough': {
      // Dynamic flythrough with complex curved path
      const start = new THREE.Vector3(...defaultStart);
      const end = new THREE.Vector3(...defaultEnd);

      // Create multiple control points for smooth spline
      const controlPoints = [];
      controlPoints.push(start);

      // Add intermediate control points for more dynamic movement
      for (let i = 1; i < 4; i++) {
        const t = i / 4;
        const midPoint = start.clone().lerp(end, t);

        // Add vertical arc and lateral movement
        midPoint.y += 25 * Math.sin(t * Math.PI);
        midPoint.x += Math.sin(t * Math.PI * 2) * 15;
        midPoint.z += Math.cos(t * Math.PI * 2) * 10;

        controlPoints.push(midPoint);
      }

      controlPoints.push(end);

      // Catmull-Rom spline interpolation
      const position = catmullRomSpline(controlPoints, easedProgress);

      // Dynamic lookAt that leads the movement
      const futureT = Math.min(1, easedProgress + 0.1);
      const futurePos = catmullRomSpline(controlPoints, futureT);
      const direction = futurePos.clone().sub(position).normalize();
      const lookAt = position.clone().add(direction.multiplyScalar(20));

      return {
        position,
        lookAt,
        fov: baseFov + Math.sin(easedProgress * Math.PI) * 15, // Dramatic FOV changes
      };
    }

    case 'close_up': {
      // Intimate close-up with slight movement
      const distance = 12 + Math.sin(easedProgress * Math.PI) * 3;
      const angle = easedProgress * Math.PI * 0.5;
      const height = 8 + Math.sin(easedProgress * Math.PI * 2) * 4;

      const position = new THREE.Vector3(
        targetPos.x + Math.cos(angle) * distance,
        targetPos.y + height,
        targetPos.z + Math.sin(angle) * distance
      );

      return {
        position,
        lookAt: targetPos,
        fov: baseFov - 15, // Much tighter FOV for close-ups
      };
    }

    case 'pull_back': {
      // Dramatic pull-back reveal
      const startDistance = 8;
      const endDistance = 80;
      const distance =
        startDistance + (endDistance - startDistance) * easedProgress;

      // Add dramatic height increase
      const height = 5 + easedProgress * 30;

      const position = new THREE.Vector3(
        targetPos.x + Math.sin(easedProgress * Math.PI * 0.5) * distance * 0.3,
        targetPos.y + height,
        targetPos.z + distance
      );

      return {
        position,
        lookAt: targetPos,
        fov: baseFov - 10 + easedProgress * 25, // FOV opens up during pull-back
      };
    }

    case 'dolly_zoom': {
      // Hitchcock-style dolly zoom effect
      const startDistance = 30;
      const endDistance = 15;
      const distance =
        startDistance + (endDistance - startDistance) * easedProgress;

      const position = new THREE.Vector3(
        targetPos.x,
        targetPos.y + 10,
        targetPos.z + distance
      );

      // Counter-zoom: as we dolly in, we zoom out to maintain subject size
      const startFov = baseFov - 10;
      const endFov = baseFov + 20;
      const fov = startFov + (endFov - startFov) * easedProgress;

      return {
        position,
        lookAt: targetPos,
        fov,
      };
    }

    case 'spiral': {
      // Spiraling ascent or descent
      const radius = 40 - easedProgress * 20;
      const angle = easedProgress * Math.PI * 4; // Two full rotations
      const startHeight = 10;
      const endHeight = 60;
      const height = startHeight + (endHeight - startHeight) * easedProgress;

      const position = new THREE.Vector3(
        targetPos.x + Math.cos(angle) * radius,
        targetPos.y + height,
        targetPos.z + Math.sin(angle) * radius
      );

      return {
        position,
        lookAt: targetPos,
        fov: baseFov + Math.sin(angle) * 8,
      };
    }

    case 'tracking': {
      // Side-tracking shot that follows along a path
      const start = new THREE.Vector3(...defaultStart);
      const end = new THREE.Vector3(...defaultEnd);
      const position = start.clone().lerp(end, easedProgress);

      // Maintain consistent distance from target
      const directionToTarget = targetPos.clone().sub(position).normalize();
      position.add(directionToTarget.multiplyScalar(-25));

      return {
        position,
        lookAt: targetPos,
        fov: baseFov,
      };
    }

    default: {
      // Fallback with enhanced interpolation
      const start = new THREE.Vector3(...defaultStart);
      const end = new THREE.Vector3(...defaultEnd);
      const position = start.clone().lerp(end, easedProgress);

      return {
        position,
        lookAt: targetPos,
        fov: baseFov,
      };
    }
  }
}

// Helper function for smooth spline interpolation
function catmullRomSpline(points: THREE.Vector3[], t: number): THREE.Vector3 {
  const l = points.length;
  const p = (l - 1) * t;
  const intPoint = Math.floor(p);
  const weight = p - intPoint;

  const p0 = points[intPoint === 0 ? intPoint : intPoint - 1];
  const p1 = points[intPoint];
  const p2 = points[intPoint > l - 2 ? l - 1 : intPoint + 1];
  const p3 = points[intPoint > l - 3 ? l - 1 : intPoint + 2];

  const result = new THREE.Vector3();

  result.x = catmullRomInterpolate(p0.x, p1.x, p2.x, p3.x, weight);
  result.y = catmullRomInterpolate(p0.y, p1.y, p2.y, p3.y, weight);
  result.z = catmullRomInterpolate(p0.z, p1.z, p2.z, p3.z, weight);

  return result;
}

function catmullRomInterpolate(
  p0: number,
  p1: number,
  p2: number,
  p3: number,
  t: number
): number {
  const v0 = (p2 - p0) * 0.5;
  const v1 = (p3 - p1) * 0.5;
  const t2 = t * t;
  const t3 = t * t2;

  return (
    (2 * p1 - 2 * p2 + v0 + v1) * t3 +
    (-3 * p1 + 3 * p2 - 2 * v0 - v1) * t2 +
    v0 * t +
    p1
  );
}
