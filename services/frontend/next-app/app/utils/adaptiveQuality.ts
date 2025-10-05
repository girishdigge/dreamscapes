// services/frontend/next-app/app/utils/adaptiveQuality.ts
'use client';

import {
  PerformanceMonitor,
  PerformanceMetrics,
  QualityLevel,
} from './performanceMonitor';
import { PostProcessingConfig } from '../components/PostProcessing';
import { getPreset } from '../components/postProcessingPresets';

/**
 * Adaptive Quality System
 * Automatically adjusts rendering quality based on performance metrics
 * Requirements: 6.7, 8.7
 */

export interface AdaptiveQualityConfig {
  enabled: boolean;
  autoReduce: boolean; // Auto-reduce quality when FPS drops
  autoRestore: boolean; // Auto-restore quality when performance improves
  minQuality: QualityLevel; // Don't go below this quality
  notifyUser: boolean; // Show notifications for quality changes
}

export interface QualityChangeNotification {
  type: 'reduction' | 'restoration';
  from: QualityLevel;
  to: QualityLevel;
  reason: string;
  timestamp: number;
}

export type QualityChangeCallback = (
  notification: QualityChangeNotification
) => void;

/**
 * AdaptiveQualityManager class
 * Manages automatic quality adjustments based on performance
 */
export class AdaptiveQualityManager {
  private monitor: PerformanceMonitor;
  private config: AdaptiveQualityConfig;
  private currentQuality: QualityLevel;
  private targetQuality: QualityLevel;
  private callbacks: Set<QualityChangeCallback> = new Set();
  private lastQualityChange = 0;
  private qualityChangeDelay = 3000; // Wait 3 seconds between changes
  private isActive = false;
  private unsubscribeMonitor: (() => void) | null = null;

  // Quality hierarchy (lower index = lower quality)
  private qualityLevels: QualityLevel[] = [
    'performance',
    'balanced',
    'cinematic',
  ];

  constructor(
    monitor: PerformanceMonitor,
    initialQuality: QualityLevel = 'balanced',
    config?: Partial<AdaptiveQualityConfig>
  ) {
    this.monitor = monitor;
    this.currentQuality = initialQuality;
    this.targetQuality = initialQuality;
    this.config = {
      enabled: config?.enabled ?? true,
      autoReduce: config?.autoReduce ?? true,
      autoRestore: config?.autoRestore ?? true,
      minQuality: config?.minQuality ?? 'performance',
      notifyUser: config?.notifyUser ?? true,
    };
  }

  /**
   * Start adaptive quality management
   */
  start(): void {
    if (this.isActive) return;

    this.isActive = true;
    this.lastQualityChange = Date.now();

    // Subscribe to performance updates
    this.unsubscribeMonitor = this.monitor.subscribe((metrics) => {
      this.handlePerformanceUpdate(metrics);
    });

    console.log('🎯 Adaptive quality system started');
  }

  /**
   * Stop adaptive quality management
   */
  stop(): void {
    if (!this.isActive) return;

    this.isActive = false;

    if (this.unsubscribeMonitor) {
      this.unsubscribeMonitor();
      this.unsubscribeMonitor = null;
    }

    console.log('🎯 Adaptive quality system stopped');
  }

  /**
   * Handle performance metric updates
   */
  private handlePerformanceUpdate(metrics: PerformanceMetrics): void {
    if (!this.config.enabled) return;

    const now = Date.now();
    const timeSinceLastChange = now - this.lastQualityChange;

    // Don't change quality too frequently
    if (timeSinceLastChange < this.qualityChangeDelay) {
      return;
    }

    // Check if we need to reduce quality
    if (this.config.autoReduce && metrics.isPerformanceDegraded) {
      this.reduceQuality(metrics);
    }
    // Check if we can restore quality
    else if (this.config.autoRestore && !metrics.isPerformanceDegraded) {
      this.restoreQuality(metrics);
    }
  }

  /**
   * Reduce quality level due to performance degradation
   */
  private reduceQuality(metrics: PerformanceMetrics): void {
    const currentIndex = this.qualityLevels.indexOf(this.currentQuality);
    const minIndex = this.qualityLevels.indexOf(this.config.minQuality);

    // Can't reduce below minimum quality
    if (currentIndex <= minIndex) {
      console.warn(
        `⚠️ Already at minimum quality (${this.config.minQuality}), cannot reduce further`
      );
      return;
    }

    // Reduce by one level
    const newQuality = this.qualityLevels[currentIndex - 1];
    this.changeQuality(newQuality, 'reduction', metrics);
  }

  /**
   * Restore quality level when performance improves
   */
  private restoreQuality(metrics: PerformanceMetrics): void {
    const currentIndex = this.qualityLevels.indexOf(this.currentQuality);
    const targetIndex = this.qualityLevels.indexOf(this.targetQuality);

    // Already at target quality
    if (currentIndex >= targetIndex) {
      return;
    }

    // Check if performance is good enough to restore
    const recommendedQuality = metrics.recommendedQuality;
    const recommendedIndex = this.qualityLevels.indexOf(recommendedQuality);

    // Only restore if recommended quality is higher than current
    if (recommendedIndex > currentIndex) {
      // Restore by one level at a time
      const newQuality = this.qualityLevels[currentIndex + 1];
      this.changeQuality(newQuality, 'restoration', metrics);
    }
  }

  /**
   * Change quality level and notify callbacks
   */
  private changeQuality(
    newQuality: QualityLevel,
    type: 'reduction' | 'restoration',
    metrics: PerformanceMetrics
  ): void {
    const oldQuality = this.currentQuality;

    if (oldQuality === newQuality) {
      return;
    }

    this.currentQuality = newQuality;
    this.lastQualityChange = Date.now();

    // Update monitor
    this.monitor.setCurrentQuality(newQuality);

    // Create notification
    const notification: QualityChangeNotification = {
      type,
      from: oldQuality,
      to: newQuality,
      reason:
        type === 'reduction'
          ? `Performance degraded (${metrics.fps} FPS)`
          : `Performance improved (${metrics.fps} FPS)`,
      timestamp: Date.now(),
    };

    // Log change
    const emoji = type === 'reduction' ? '⬇️' : '⬆️';
    console.log(
      `${emoji} Quality ${type}: ${oldQuality} → ${newQuality} (${notification.reason})`
    );

    // Notify callbacks
    if (this.config.notifyUser) {
      this.callbacks.forEach((callback) => callback(notification));
    }
  }

  /**
   * Manually set quality level
   */
  setQuality(quality: QualityLevel): void {
    this.currentQuality = quality;
    this.targetQuality = quality;
    this.monitor.setCurrentQuality(quality);
    this.lastQualityChange = Date.now();
  }

  /**
   * Get current quality level
   */
  getCurrentQuality(): QualityLevel {
    return this.currentQuality;
  }

  /**
   * Get target quality level (what user originally selected)
   */
  getTargetQuality(): QualityLevel {
    return this.targetQuality;
  }

  /**
   * Set target quality level (what user wants)
   */
  setTargetQuality(quality: QualityLevel): void {
    this.targetQuality = quality;
  }

  /**
   * Update configuration
   */
  setConfig(config: Partial<AdaptiveQualityConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };
  }

  /**
   * Get current configuration
   */
  getConfig(): AdaptiveQualityConfig {
    return { ...this.config };
  }

  /**
   * Subscribe to quality change notifications
   */
  subscribe(callback: QualityChangeCallback): () => void {
    this.callbacks.add(callback);

    // Return unsubscribe function
    return () => {
      this.callbacks.delete(callback);
    };
  }

  /**
   * Check if adaptive quality is active
   */
  isRunning(): boolean {
    return this.isActive;
  }

  /**
   * Get post-processing config for current quality
   */
  getPostProcessingConfig(): PostProcessingConfig {
    // Handle custom quality by using balanced as fallback
    if (this.currentQuality === 'custom') {
      return getPreset('balanced');
    }
    return getPreset(this.currentQuality);
  }

  /**
   * Get rendering settings for current quality
   */
  getRenderingSettings() {
    const quality = this.currentQuality;

    return {
      antialias: quality !== 'performance',
      shadows: quality !== 'performance',
      shadowQuality:
        quality === 'cinematic'
          ? 'high'
          : quality === 'balanced'
          ? 'medium'
          : 'low',
      geometryDetail:
        quality === 'cinematic'
          ? 'high'
          : quality === 'balanced'
          ? 'medium'
          : 'low',
      textureQuality:
        quality === 'cinematic'
          ? 'high'
          : quality === 'balanced'
          ? 'medium'
          : 'low',
      particleMultiplier:
        quality === 'cinematic' ? 1.0 : quality === 'balanced' ? 0.7 : 0.4,
    };
  }
}

/**
 * Create a singleton instance for global use
 */
let globalManager: AdaptiveQualityManager | null = null;

export function getGlobalAdaptiveQualityManager(
  monitor: PerformanceMonitor,
  initialQuality?: QualityLevel
): AdaptiveQualityManager {
  if (!globalManager) {
    globalManager = new AdaptiveQualityManager(monitor, initialQuality);
  }
  return globalManager;
}

/**
 * React hook for using adaptive quality
 */
import React from 'react';

export function useAdaptiveQuality(
  monitor: PerformanceMonitor,
  initialQuality: QualityLevel = 'balanced',
  config?: Partial<AdaptiveQualityConfig>
) {
  const [currentQuality, setCurrentQuality] =
    React.useState<QualityLevel>(initialQuality);
  const [notifications, setNotifications] = React.useState<
    QualityChangeNotification[]
  >([]);
  const managerRef = React.useRef<AdaptiveQualityManager | null>(null);

  React.useEffect(() => {
    // Create manager
    const manager = new AdaptiveQualityManager(monitor, initialQuality, config);
    managerRef.current = manager;

    // Subscribe to quality changes
    const unsubscribe = manager.subscribe((notification) => {
      setCurrentQuality(notification.to);
      setNotifications((prev) => [...prev, notification].slice(-5)); // Keep last 5
    });

    // Start adaptive quality
    manager.start();

    // Cleanup
    return () => {
      unsubscribe();
      manager.stop();
    };
  }, [monitor, initialQuality, config]);

  return {
    currentQuality,
    notifications,
    manager: managerRef.current,
    setQuality: (quality: QualityLevel) =>
      managerRef.current?.setQuality(quality),
    setTargetQuality: (quality: QualityLevel) =>
      managerRef.current?.setTargetQuality(quality),
    getPostProcessingConfig: () =>
      managerRef.current?.getPostProcessingConfig(),
    getRenderingSettings: () => managerRef.current?.getRenderingSettings(),
  };
}
