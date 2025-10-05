// services/frontend/next-app/app/utils/performanceMonitor.ts
'use client';

/**
 * Performance monitoring utility for tracking FPS, memory usage, and performance degradation
 * Requirements: 6.7, 6.10
 */

export type QualityLevel = 'cinematic' | 'balanced' | 'performance' | 'custom';

export interface PerformanceMetrics {
  fps: number;
  avgFps: number;
  minFps: number;
  maxFps: number;
  memoryUsageMB: number;
  frameTime: number;
  isPerformanceDegraded: boolean;
  recommendedQuality: QualityLevel;
}

export interface PerformanceThresholds {
  targetFPS: number;
  minAcceptableFPS: number;
  maxMemoryMB: number;
  degradationThreshold: number; // FPS drop percentage to trigger degradation
}

export type PerformanceCallback = (metrics: PerformanceMetrics) => void;

/**
 * PerformanceMonitor class
 * Tracks real-time performance metrics and detects degradation
 */
export class PerformanceMonitor {
  private frameCount = 0;
  private lastTime = performance.now();
  private fps = 60;
  private fpsHistory: number[] = [];
  private maxHistorySize = 60; // Track last 60 frames
  private minFps = 60;
  private maxFps = 60;
  private frameTime = 0;
  private isActive = false;
  private animationFrameId: number | null = null;
  private callbacks: Set<PerformanceCallback> = new Set();
  private thresholds: PerformanceThresholds;
  private currentQuality: QualityLevel = 'balanced';
  private degradationCount = 0;
  private improvementCount = 0;

  constructor(thresholds?: Partial<PerformanceThresholds>) {
    this.thresholds = {
      targetFPS: thresholds?.targetFPS || 30,
      minAcceptableFPS: thresholds?.minAcceptableFPS || 20,
      maxMemoryMB: thresholds?.maxMemoryMB || 2048,
      degradationThreshold: thresholds?.degradationThreshold || 0.7, // 70% of target
    };
  }

  /**
   * Start monitoring performance
   */
  start(): void {
    if (this.isActive) return;

    this.isActive = true;
    this.frameCount = 0;
    this.lastTime = performance.now();
    this.fpsHistory = [];
    this.minFps = 60;
    this.maxFps = 60;
    this.degradationCount = 0;
    this.improvementCount = 0;

    this.update();
  }

  /**
   * Stop monitoring performance
   */
  stop(): void {
    this.isActive = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * Update performance metrics (called every frame)
   */
  private update = (): void => {
    if (!this.isActive) return;

    this.frameCount++;
    const currentTime = performance.now();
    const deltaTime = currentTime - this.lastTime;

    // Calculate frame time
    this.frameTime = deltaTime;

    // Update FPS every second
    if (deltaTime >= 1000) {
      this.fps = Math.round((this.frameCount * 1000) / deltaTime);

      // Add to history
      this.fpsHistory.push(this.fps);
      if (this.fpsHistory.length > this.maxHistorySize) {
        this.fpsHistory.shift();
      }

      // Update min/max
      this.minFps = Math.min(this.minFps, this.fps);
      this.maxFps = Math.max(this.maxFps, this.fps);

      // Reset counters
      this.frameCount = 0;
      this.lastTime = currentTime;

      // Notify callbacks with current metrics
      const metrics = this.getMetrics();
      this.callbacks.forEach((callback) => callback(metrics));

      // Check for performance degradation
      this.checkPerformanceDegradation(metrics);
    }

    // Schedule next update
    this.animationFrameId = requestAnimationFrame(this.update);
  };

  /**
   * Check if performance has degraded and update quality recommendation
   */
  private checkPerformanceDegradation(metrics: PerformanceMetrics): void {
    const degradationThreshold =
      this.thresholds.targetFPS * this.thresholds.degradationThreshold;

    if (metrics.fps < degradationThreshold) {
      this.degradationCount++;
      this.improvementCount = 0;

      // Trigger degradation after 3 consecutive low FPS readings
      if (this.degradationCount >= 3) {
        console.warn(
          `⚠️ Performance degraded: ${metrics.fps} FPS (target: ${this.thresholds.targetFPS})`
        );
      }
    } else if (metrics.fps >= this.thresholds.targetFPS) {
      this.improvementCount++;
      this.degradationCount = 0;

      // Trigger improvement after 5 consecutive good FPS readings
      if (this.improvementCount >= 5) {
        console.log(
          `✅ Performance improved: ${metrics.fps} FPS (target: ${this.thresholds.targetFPS})`
        );
      }
    } else {
      // FPS is between degradation threshold and target - stable
      this.degradationCount = 0;
      this.improvementCount = 0;
    }
  }

  /**
   * Get current performance metrics
   */
  getMetrics(): PerformanceMetrics {
    const avgFps =
      this.fpsHistory.length > 0
        ? Math.round(
            this.fpsHistory.reduce((sum, fps) => sum + fps, 0) /
              this.fpsHistory.length
          )
        : this.fps;

    const memoryUsageMB = this.getMemoryUsage();
    const isPerformanceDegraded = this.isPerformanceDegraded();
    const recommendedQuality = this.getRecommendedQuality();

    return {
      fps: this.fps,
      avgFps,
      minFps: this.minFps,
      maxFps: this.maxFps,
      memoryUsageMB,
      frameTime: this.frameTime,
      isPerformanceDegraded,
      recommendedQuality,
    };
  }

  /**
   * Get memory usage in MB (if available)
   */
  private getMemoryUsage(): number {
    if ('memory' in performance && (performance as any).memory) {
      const memory = (performance as any).memory;
      return Math.round(memory.usedJSHeapSize / 1024 / 1024);
    }
    return 0;
  }

  /**
   * Check if performance is currently degraded
   */
  private isPerformanceDegraded(): boolean {
    return (
      this.fps < this.thresholds.minAcceptableFPS || this.degradationCount >= 3
    );
  }

  /**
   * Get recommended quality level based on current performance
   */
  private getRecommendedQuality(): QualityLevel {
    const avgFps =
      this.fpsHistory.length > 0
        ? this.fpsHistory.reduce((sum, fps) => sum + fps, 0) /
          this.fpsHistory.length
        : this.fps;

    // If FPS is very low, recommend performance mode
    if (avgFps < this.thresholds.minAcceptableFPS) {
      return 'performance';
    }

    // If FPS is below target, recommend balanced mode
    if (avgFps < this.thresholds.targetFPS) {
      return 'balanced';
    }

    // If FPS is well above target (1.5x), can use cinematic mode
    if (avgFps >= this.thresholds.targetFPS * 1.5) {
      return 'cinematic';
    }

    // Otherwise, stay with balanced
    return 'balanced';
  }

  /**
   * Subscribe to performance updates
   */
  subscribe(callback: PerformanceCallback): () => void {
    this.callbacks.add(callback);

    // Return unsubscribe function
    return () => {
      this.callbacks.delete(callback);
    };
  }

  /**
   * Update performance thresholds
   */
  setThresholds(thresholds: Partial<PerformanceThresholds>): void {
    this.thresholds = {
      ...this.thresholds,
      ...thresholds,
    };
  }

  /**
   * Set current quality level (for tracking)
   */
  setCurrentQuality(quality: QualityLevel): void {
    this.currentQuality = quality;
  }

  /**
   * Get current quality level
   */
  getCurrentQuality(): QualityLevel {
    return this.currentQuality;
  }

  /**
   * Reset performance statistics
   */
  reset(): void {
    this.frameCount = 0;
    this.lastTime = performance.now();
    this.fpsHistory = [];
    this.minFps = 60;
    this.maxFps = 60;
    this.degradationCount = 0;
    this.improvementCount = 0;
  }

  /**
   * Check if monitoring is active
   */
  isMonitoring(): boolean {
    return this.isActive;
  }
}

/**
 * Create a singleton instance for global use
 */
let globalMonitor: PerformanceMonitor | null = null;

export function getGlobalPerformanceMonitor(): PerformanceMonitor {
  if (!globalMonitor) {
    globalMonitor = new PerformanceMonitor();
  }
  return globalMonitor;
}

/**
 * React hook for using performance monitor
 */
export function usePerformanceMonitor(
  thresholds?: Partial<PerformanceThresholds>
): PerformanceMetrics {
  if (typeof window === 'undefined') {
    // Return default metrics for SSR
    return {
      fps: 60,
      avgFps: 60,
      minFps: 60,
      maxFps: 60,
      memoryUsageMB: 0,
      frameTime: 16.67,
      isPerformanceDegraded: false,
      recommendedQuality: 'balanced',
    };
  }

  const [metrics, setMetrics] = React.useState<PerformanceMetrics>(() => {
    const monitor = getGlobalPerformanceMonitor();
    return monitor.getMetrics();
  });

  React.useEffect(() => {
    const monitor = getGlobalPerformanceMonitor();

    // Update thresholds if provided
    if (thresholds) {
      monitor.setThresholds(thresholds);
    }

    // Start monitoring
    monitor.start();

    // Subscribe to updates
    const unsubscribe = monitor.subscribe((newMetrics) => {
      setMetrics(newMetrics);
    });

    // Cleanup
    return () => {
      unsubscribe();
      monitor.stop();
    };
  }, [thresholds]);

  return metrics;
}

// Import React for the hook
import React from 'react';
