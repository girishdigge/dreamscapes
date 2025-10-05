// services/frontend/next-app/app/components/QualitySettings.tsx
'use client';

import React, { useState } from 'react';
import {
  QualityLevel,
  PerformanceMetrics,
  usePerformanceMonitor,
} from '../utils/performanceMonitor';
import {
  useAdaptiveQuality,
  QualityChangeNotification,
} from '../utils/adaptiveQuality';
import { getGlobalPerformanceMonitor } from '../utils/performanceMonitor';

/**
 * Quality Settings UI Component
 * Provides controls for quality presets, individual effect toggles, and performance metrics
 * Requirements: 8.5, 8.8, 8.9
 */

interface QualitySettingsProps {
  initialQuality?: QualityLevel;
  onQualityChange?: (quality: QualityLevel) => void;
  showAdvanced?: boolean;
}

export default function QualitySettings({
  initialQuality = 'balanced',
  onQualityChange,
  showAdvanced = false,
}: QualitySettingsProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showNotifications, setShowNotifications] = useState(true);
  const [adaptiveEnabled, setAdaptiveEnabled] = useState(true);

  // Get performance monitor
  const monitor = getGlobalPerformanceMonitor();

  // Use adaptive quality hook
  const {
    currentQuality,
    notifications,
    setQuality,
    setTargetQuality,
    manager,
  } = useAdaptiveQuality(monitor, initialQuality, {
    enabled: adaptiveEnabled,
    autoReduce: true,
    autoRestore: true,
    minQuality: 'performance',
    notifyUser: showNotifications,
  });

  // Get performance metrics
  const metrics = usePerformanceMonitor({
    targetFPS: 30,
    minAcceptableFPS: 20,
    maxMemoryMB: 2048,
    degradationThreshold: 0.7,
  });

  // Handle quality change
  const handleQualityChange = (quality: QualityLevel) => {
    setQuality?.(quality);
    setTargetQuality?.(quality);
    onQualityChange?.(quality);
  };

  // Handle adaptive quality toggle
  const handleAdaptiveToggle = () => {
    const newEnabled = !adaptiveEnabled;
    setAdaptiveEnabled(newEnabled);
    manager?.setConfig({ enabled: newEnabled });
  };

  // Get quality color
  const getQualityColor = (quality: QualityLevel) => {
    switch (quality) {
      case 'cinematic':
        return 'text-purple-400';
      case 'balanced':
        return 'text-blue-400';
      case 'performance':
        return 'text-green-400';
      default:
        return 'text-gray-400';
    }
  };

  // Get FPS color
  const getFpsColor = (fps: number) => {
    if (fps >= 50) return 'text-green-400';
    if (fps >= 30) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div className='fixed top-4 left-4 z-50'>
      {/* Compact View */}
      {!isExpanded && (
        <button
          onClick={() => setIsExpanded(true)}
          className='bg-black/70 backdrop-blur-sm rounded-lg p-3 text-white hover:bg-black/80 transition-colors'
        >
          <div className='flex items-center space-x-3'>
            <div className='flex items-center space-x-2'>
              <div
                className={`w-2 h-2 rounded-full ${
                  metrics.isPerformanceDegraded
                    ? 'bg-red-500 animate-pulse'
                    : 'bg-green-500'
                }`}
              />
              <span className={`font-mono text-sm ${getFpsColor(metrics.fps)}`}>
                {metrics.fps} FPS
              </span>
            </div>
            <div className='text-xs text-gray-400'>|</div>
            <div className={`text-sm ${getQualityColor(currentQuality)}`}>
              {currentQuality.charAt(0).toUpperCase() + currentQuality.slice(1)}
            </div>
          </div>
        </button>
      )}

      {/* Expanded View */}
      {isExpanded && (
        <div className='bg-black/80 backdrop-blur-md rounded-lg p-4 text-white min-w-[320px] shadow-xl border border-white/10'>
          {/* Header */}
          <div className='flex items-center justify-between mb-4'>
            <h3 className='text-lg font-semibold'>Quality Settings</h3>
            <button
              onClick={() => setIsExpanded(false)}
              className='text-gray-400 hover:text-white transition-colors'
            >
              ✕
            </button>
          </div>

          {/* Performance Metrics */}
          <div className='mb-4 p-3 bg-white/5 rounded-lg'>
            <h4 className='text-sm font-semibold mb-2 text-gray-300'>
              Performance
            </h4>
            <div className='space-y-2 text-sm'>
              <div className='flex justify-between items-center'>
                <span className='text-gray-400'>FPS:</span>
                <span className={`font-mono ${getFpsColor(metrics.fps)}`}>
                  {metrics.fps}
                </span>
              </div>
              <div className='flex justify-between items-center'>
                <span className='text-gray-400'>Avg FPS:</span>
                <span className={`font-mono ${getFpsColor(metrics.avgFps)}`}>
                  {metrics.avgFps}
                </span>
              </div>
              <div className='flex justify-between items-center'>
                <span className='text-gray-400'>Min/Max:</span>
                <span className='font-mono text-gray-300'>
                  {metrics.minFps} / {metrics.maxFps}
                </span>
              </div>
              {metrics.memoryUsageMB > 0 && (
                <div className='flex justify-between items-center'>
                  <span className='text-gray-400'>Memory:</span>
                  <span className='font-mono text-gray-300'>
                    {metrics.memoryUsageMB} MB
                  </span>
                </div>
              )}
              <div className='flex justify-between items-center'>
                <span className='text-gray-400'>Frame Time:</span>
                <span className='font-mono text-gray-300'>
                  {metrics.frameTime.toFixed(2)} ms
                </span>
              </div>
            </div>
          </div>

          {/* Quality Preset Selector */}
          <div className='mb-4'>
            <h4 className='text-sm font-semibold mb-2 text-gray-300'>
              Quality Preset
            </h4>
            <div className='grid grid-cols-3 gap-2'>
              {(['performance', 'balanced', 'cinematic'] as QualityLevel[]).map(
                (quality) => (
                  <button
                    key={quality}
                    onClick={() => handleQualityChange(quality)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      currentQuality === quality
                        ? 'bg-blue-600 text-white shadow-lg'
                        : 'bg-white/10 text-gray-300 hover:bg-white/20'
                    }`}
                  >
                    {quality.charAt(0).toUpperCase() + quality.slice(1)}
                  </button>
                )
              )}
            </div>
          </div>

          {/* Adaptive Quality Toggle */}
          <div className='mb-4 p-3 bg-white/5 rounded-lg'>
            <div className='flex items-center justify-between'>
              <div>
                <h4 className='text-sm font-semibold text-gray-300'>
                  Adaptive Quality
                </h4>
                <p className='text-xs text-gray-500 mt-1'>
                  Auto-adjust quality based on performance
                </p>
              </div>
              <button
                onClick={handleAdaptiveToggle}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  adaptiveEnabled ? 'bg-blue-600' : 'bg-gray-600'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    adaptiveEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Recommended Quality */}
          {metrics.recommendedQuality !== currentQuality && (
            <div className='mb-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg'>
              <div className='flex items-start space-x-2'>
                <span className='text-yellow-500 text-lg'>💡</span>
                <div className='flex-1'>
                  <p className='text-sm text-yellow-200'>
                    Recommended:{' '}
                    <span className='font-semibold'>
                      {metrics.recommendedQuality.charAt(0).toUpperCase() +
                        metrics.recommendedQuality.slice(1)}
                    </span>
                  </p>
                  <button
                    onClick={() =>
                      handleQualityChange(metrics.recommendedQuality)
                    }
                    className='text-xs text-yellow-300 hover:text-yellow-100 underline mt-1'
                  >
                    Apply recommendation
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Performance Warning */}
          {metrics.isPerformanceDegraded && (
            <div className='mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg'>
              <div className='flex items-start space-x-2'>
                <span className='text-red-500 text-lg'>⚠️</span>
                <div className='flex-1'>
                  <p className='text-sm text-red-200'>
                    Performance degraded. Consider lowering quality.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Recent Notifications */}
          {showNotifications && notifications.length > 0 && (
            <div className='mb-4'>
              <h4 className='text-sm font-semibold mb-2 text-gray-300'>
                Recent Changes
              </h4>
              <div className='space-y-2 max-h-32 overflow-y-auto'>
                {notifications
                  .slice(-3)
                  .reverse()
                  .map((notification, index) => (
                    <div
                      key={notification.timestamp}
                      className='p-2 bg-white/5 rounded text-xs'
                    >
                      <div className='flex items-center space-x-2'>
                        <span>
                          {notification.type === 'reduction' ? '⬇️' : '⬆️'}
                        </span>
                        <span className='text-gray-300'>
                          {notification.from} → {notification.to}
                        </span>
                      </div>
                      <p className='text-gray-500 mt-1'>
                        {notification.reason}
                      </p>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Advanced Settings */}
          {showAdvanced && (
            <div className='pt-4 border-t border-white/10'>
              <h4 className='text-sm font-semibold mb-2 text-gray-300'>
                Advanced
              </h4>
              <div className='space-y-2 text-xs'>
                <div className='flex items-center justify-between'>
                  <span className='text-gray-400'>Show Notifications:</span>
                  <button
                    onClick={() => setShowNotifications(!showNotifications)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                      showNotifications ? 'bg-blue-600' : 'bg-gray-600'
                    }`}
                  >
                    <span
                      className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                        showNotifications ? 'translate-x-5' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Minimal Performance HUD (for always-on display)
 */
export function PerformanceHUD() {
  const metrics = usePerformanceMonitor();

  const getFpsColor = (fps: number) => {
    if (fps >= 50) return 'text-green-400';
    if (fps >= 30) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div className='fixed bottom-4 left-4 bg-black/50 backdrop-blur-sm rounded-lg px-3 py-2 text-xs font-mono text-white z-50'>
      <div className='flex items-center space-x-3'>
        <div className='flex items-center space-x-1'>
          <span className='text-gray-400'>FPS:</span>
          <span className={getFpsColor(metrics.fps)}>{metrics.fps}</span>
        </div>
        {metrics.memoryUsageMB > 0 && (
          <>
            <div className='text-gray-600'>|</div>
            <div className='flex items-center space-x-1'>
              <span className='text-gray-400'>MEM:</span>
              <span className='text-gray-300'>{metrics.memoryUsageMB}MB</span>
            </div>
          </>
        )}
        {metrics.isPerformanceDegraded && (
          <>
            <div className='text-gray-600'>|</div>
            <span className='text-red-400 animate-pulse'>⚠️</span>
          </>
        )}
      </div>
    </div>
  );
}
