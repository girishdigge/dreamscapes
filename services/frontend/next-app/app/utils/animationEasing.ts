// services/frontend/next-app/app/utils/animationEasing.ts
// Enhanced easing functions and interpolation utilities for smooth animations

/**
 * Easing function type
 */
export type EasingFunction = (t: number) => number;

/**
 * Standard easing functions
 */
export const easingFunctions = {
  // Linear
  linear: (t: number): number => t,

  // Quadratic
  easeInQuad: (t: number): number => t * t,
  easeOutQuad: (t: number): number => t * (2 - t),
  easeInOutQuad: (t: number): number =>
    t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,

  // Cubic
  easeInCubic: (t: number): number => t * t * t,
  easeOutCubic: (t: number): number => --t * t * t + 1,
  easeInOutCubic: (t: number): number =>
    t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,

  // Quartic
  easeInQuart: (t: number): number => t * t * t * t,
  easeOutQuart: (t: number): number => 1 - --t * t * t * t,
  easeInOutQuart: (t: number): number =>
    t < 0.5 ? 8 * t * t * t * t : 1 - 8 * --t * t * t * t,

  // Quintic
  easeInQuint: (t: number): number => t * t * t * t * t,
  easeOutQuint: (t: number): number => 1 + --t * t * t * t * t,
  easeInOutQuint: (t: number): number =>
    t < 0.5 ? 16 * t * t * t * t * t : 1 + 16 * --t * t * t * t * t,

  // Sine
  easeInSine: (t: number): number => 1 - Math.cos((t * Math.PI) / 2),
  easeOutSine: (t: number): number => Math.sin((t * Math.PI) / 2),
  easeInOutSine: (t: number): number => -(Math.cos(Math.PI * t) - 1) / 2,

  // Exponential
  easeInExpo: (t: number): number => (t === 0 ? 0 : Math.pow(2, 10 * t - 10)),
  easeOutExpo: (t: number): number => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  easeInOutExpo: (t: number): number => {
    if (t === 0) return 0;
    if (t === 1) return 1;
    return t < 0.5
      ? Math.pow(2, 20 * t - 10) / 2
      : (2 - Math.pow(2, -20 * t + 10)) / 2;
  },

  // Circular
  easeInCirc: (t: number): number => 1 - Math.sqrt(1 - t * t),
  easeOutCirc: (t: number): number => Math.sqrt(1 - --t * t),
  easeInOutCirc: (t: number): number =>
    t < 0.5
      ? (1 - Math.sqrt(1 - 4 * t * t)) / 2
      : (Math.sqrt(1 - (-2 * t + 2) * (-2 * t + 2)) + 1) / 2,

  // Back
  easeInBack: (t: number): number => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return c3 * t * t * t - c1 * t * t;
  },
  easeOutBack: (t: number): number => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  easeInOutBack: (t: number): number => {
    const c1 = 1.70158;
    const c2 = c1 * 1.525;
    return t < 0.5
      ? (Math.pow(2 * t, 2) * ((c2 + 1) * 2 * t - c2)) / 2
      : (Math.pow(2 * t - 2, 2) * ((c2 + 1) * (t * 2 - 2) + c2) + 2) / 2;
  },

  // Elastic
  easeInElastic: (t: number): number => {
    const c4 = (2 * Math.PI) / 3;
    return t === 0
      ? 0
      : t === 1
      ? 1
      : -Math.pow(2, 10 * t - 10) * Math.sin((t * 10 - 10.75) * c4);
  },
  easeOutElastic: (t: number): number => {
    const c4 = (2 * Math.PI) / 3;
    return t === 0
      ? 0
      : t === 1
      ? 1
      : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  },
  easeInOutElastic: (t: number): number => {
    const c5 = (2 * Math.PI) / 4.5;
    return t === 0
      ? 0
      : t === 1
      ? 1
      : t < 0.5
      ? -(Math.pow(2, 20 * t - 10) * Math.sin((20 * t - 11.125) * c5)) / 2
      : (Math.pow(2, -20 * t + 10) * Math.sin((20 * t - 11.125) * c5)) / 2 + 1;
  },

  // Bounce
  easeInBounce: (t: number): number => 1 - easingFunctions.easeOutBounce(1 - t),
  easeOutBounce: (t: number): number => {
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
  },
  easeInOutBounce: (t: number): number =>
    t < 0.5
      ? (1 - easingFunctions.easeOutBounce(1 - 2 * t)) / 2
      : (1 + easingFunctions.easeOutBounce(2 * t - 1)) / 2,
};

/**
 * Cubic Bezier easing function
 * @param t - Progress value (0-1)
 * @param p1 - First control point (0-1)
 * @param p2 - Second control point (0-1)
 * @returns Eased value
 */
export function cubicBezier(t: number, p1: number, p2: number): number {
  // Cubic bezier with fixed start (0,0) and end (1,1)
  const cx = 3 * p1;
  const bx = 3 * (p2 - p1) - cx;
  const ax = 1 - cx - bx;

  const cy = 3 * p1;
  const by = 3 * (p2 - p1) - cy;
  const ay = 1 - cy - by;

  // Solve for t using Newton-Raphson
  let x = t;
  for (let i = 0; i < 8; i++) {
    const currentX = ((ax * x + bx) * x + cx) * x;
    const currentSlope = (3 * ax * x + 2 * bx) * x + cx;
    if (Math.abs(currentSlope) < 1e-6) break;
    x -= (currentX - t) / currentSlope;
  }

  return ((ay * x + by) * x + cy) * x;
}

/**
 * Get easing function by name
 * @param name - Easing function name or custom bezier parameters
 * @returns Easing function
 */
export function getEasingFunction(
  name: string | [number, number, number, number]
): EasingFunction {
  if (Array.isArray(name)) {
    // Custom cubic bezier [x1, y1, x2, y2]
    const [x1, y1, x2, y2] = name;
    return (t: number) => cubicBezier(t, x1, x2);
  }

  // Legacy support for old naming
  const legacyMap: Record<string, string> = {
    'ease-in': 'easeInQuad',
    'ease-out': 'easeOutQuad',
    'ease-in-out': 'easeInOutQuad',
  };

  const easingName = legacyMap[name] || name;
  return (
    easingFunctions[easingName as keyof typeof easingFunctions] ||
    easingFunctions.linear
  );
}

/**
 * Bezier curve interpolation for smooth paths
 */
export class BezierCurve {
  private points: [number, number, number][];

  constructor(points: [number, number, number][]) {
    this.points = points;
  }

  /**
   * Get point on curve at t (0-1)
   */
  getPoint(t: number): [number, number, number] {
    if (this.points.length === 0) return [0, 0, 0];
    if (this.points.length === 1) return this.points[0];

    const clampedT = Math.max(0, Math.min(1, t));
    const segmentCount = this.points.length - 1;
    const segment = Math.floor(clampedT * segmentCount);
    const localT = (clampedT * segmentCount) % 1;

    const p0 = this.points[Math.max(0, segment - 1)];
    const p1 = this.points[segment];
    const p2 = this.points[Math.min(this.points.length - 1, segment + 1)];
    const p3 = this.points[Math.min(this.points.length - 1, segment + 2)];

    return this.catmullRom(p0, p1, p2, p3, localT);
  }

  /**
   * Catmull-Rom spline interpolation
   */
  private catmullRom(
    p0: [number, number, number],
    p1: [number, number, number],
    p2: [number, number, number],
    p3: [number, number, number],
    t: number
  ): [number, number, number] {
    const t2 = t * t;
    const t3 = t2 * t;

    const v0 = (p2[0] - p0[0]) * 0.5;
    const v1 = (p3[0] - p1[0]) * 0.5;
    const x =
      (2 * p1[0] - 2 * p2[0] + v0 + v1) * t3 +
      (-3 * p1[0] + 3 * p2[0] - 2 * v0 - v1) * t2 +
      v0 * t +
      p1[0];

    const v0y = (p2[1] - p0[1]) * 0.5;
    const v1y = (p3[1] - p1[1]) * 0.5;
    const y =
      (2 * p1[1] - 2 * p2[1] + v0y + v1y) * t3 +
      (-3 * p1[1] + 3 * p2[1] - 2 * v0y - v1y) * t2 +
      v0y * t +
      p1[1];

    const v0z = (p2[2] - p0[2]) * 0.5;
    const v1z = (p3[2] - p1[2]) * 0.5;
    const z =
      (2 * p1[2] - 2 * p2[2] + v0z + v1z) * t3 +
      (-3 * p1[2] + 3 * p2[2] - 2 * v0z - v1z) * t2 +
      v0z * t +
      p1[2];

    return [x, y, z];
  }

  /**
   * Get tangent (direction) at point t
   */
  getTangent(t: number): [number, number, number] {
    const delta = 0.001;
    const t1 = Math.max(0, t - delta);
    const t2 = Math.min(1, t + delta);

    const p1 = this.getPoint(t1);
    const p2 = this.getPoint(t2);

    const dx = p2[0] - p1[0];
    const dy = p2[1] - p1[1];
    const dz = p2[2] - p1[2];

    const length = Math.sqrt(dx * dx + dy * dy + dz * dz);
    return length > 0 ? [dx / length, dy / length, dz / length] : [0, 0, 1];
  }
}

/**
 * Animation blending utility for smooth transitions
 */
export class AnimationBlender {
  private currentValue: number = 0;
  private targetValue: number = 0;
  private blendDuration: number = 0.5;
  private blendStartTime: number = 0;
  private blendStartValue: number = 0;
  private isBlending: boolean = false;

  constructor(initialValue: number = 0, blendDuration: number = 0.5) {
    this.currentValue = initialValue;
    this.targetValue = initialValue;
    this.blendDuration = blendDuration;
  }

  /**
   * Set new target value and start blending
   */
  setTarget(value: number, currentTime: number): void {
    if (value === this.targetValue) return;

    this.blendStartValue = this.currentValue;
    this.targetValue = value;
    this.blendStartTime = currentTime;
    this.isBlending = true;
  }

  /**
   * Update and get current blended value
   */
  update(
    currentTime: number,
    easingFn: EasingFunction = easingFunctions.easeInOutQuad
  ): number {
    if (!this.isBlending) {
      return this.currentValue;
    }

    const elapsed = currentTime - this.blendStartTime;
    const progress = Math.min(elapsed / this.blendDuration, 1);
    const easedProgress = easingFn(progress);

    this.currentValue =
      this.blendStartValue +
      (this.targetValue - this.blendStartValue) * easedProgress;

    if (progress >= 1) {
      this.isBlending = false;
      this.currentValue = this.targetValue;
    }

    return this.currentValue;
  }

  /**
   * Check if currently blending
   */
  isActive(): boolean {
    return this.isBlending;
  }

  /**
   * Get current value without updating
   */
  getValue(): number {
    return this.currentValue;
  }
}

/**
 * Vector3 animation blender for position/rotation animations
 */
export class Vector3Blender {
  private current: [number, number, number];
  private target: [number, number, number];
  private blendDuration: number;
  private blendStartTime: number;
  private blendStart: [number, number, number];
  private isBlending: boolean = false;

  constructor(
    initialValue: [number, number, number] = [0, 0, 0],
    blendDuration: number = 0.5
  ) {
    this.current = [...initialValue];
    this.target = [...initialValue];
    this.blendStart = [...initialValue];
    this.blendDuration = blendDuration;
    this.blendStartTime = 0;
  }

  setTarget(value: [number, number, number], currentTime: number): void {
    this.blendStart = [...this.current];
    this.target = [...value];
    this.blendStartTime = currentTime;
    this.isBlending = true;
  }

  update(
    currentTime: number,
    easingFn: EasingFunction = easingFunctions.easeInOutQuad
  ): [number, number, number] {
    if (!this.isBlending) {
      return this.current;
    }

    const elapsed = currentTime - this.blendStartTime;
    const progress = Math.min(elapsed / this.blendDuration, 1);
    const easedProgress = easingFn(progress);

    this.current = [
      this.blendStart[0] +
        (this.target[0] - this.blendStart[0]) * easedProgress,
      this.blendStart[1] +
        (this.target[1] - this.blendStart[1]) * easedProgress,
      this.blendStart[2] +
        (this.target[2] - this.blendStart[2]) * easedProgress,
    ];

    if (progress >= 1) {
      this.isBlending = false;
      this.current = [...this.target];
    }

    return this.current;
  }

  isActive(): boolean {
    return this.isBlending;
  }

  getValue(): [number, number, number] {
    return this.current;
  }
}
