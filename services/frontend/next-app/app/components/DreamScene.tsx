// services/frontend/next-app/app/components/DreamScene.tsx
'use client';

import { Suspense, useRef, useState, useCallback, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { Environment, Stars, PerformanceMonitor } from '@react-three/drei';
import * as THREE from 'three';
import {
  detectWebGLCapabilities,
  getCapabilityWarnings,
  logCapabilities,
} from '../utils/webglCapabilities';
import CinematicCamera from './CinematicCamera';
import DreamEnvironment from './DreamEnvironment';
import DreamStructures from './DreamStructures';
import DreamEntities from './DreamEntities';
import EnhancedStructures from './EnhancedStructures';
import EnhancedEntities from './EnhancedEntities';
import LoadingFallback from './LoadingFallback';
import PostProcessing, { getPresetFromQuality } from './PostProcessing';
import PostProcessingErrorBoundary from './PostProcessingErrorBoundary';
import EnhancedLighting, {
  getEnvironmentLightingConfig,
} from './EnhancedLighting';
import { Dream } from '../types/dream';

interface DreamSceneProps {
  dream: Dream;
  isPlaying: boolean;
  currentTime: number;
  onTimeUpdate: (time: number) => void;
}

export default function DreamScene({
  dream,
  isPlaying,
  currentTime,
  onTimeUpdate,
}: DreamSceneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Canvas settings based on dream render config
  const renderConfig = dream.render || {
    res: [1280, 720],
    fps: 30,
    quality: 'draft',
  };

  // Map quality preset to quality level if specified
  const getQualityFromPreset = (
    preset?: string
  ): 'draft' | 'medium' | 'high' | 'low' => {
    switch (preset) {
      case 'cinematic':
        return 'high';
      case 'balanced':
        return 'medium';
      case 'performance':
        return 'draft';
      default:
        return renderConfig.quality || 'medium';
    }
  };

  const initialQuality = renderConfig.qualityPreset
    ? getQualityFromPreset(renderConfig.qualityPreset)
    : renderConfig.quality || 'medium';

  // Performance monitoring state
  const [currentFPS, setCurrentFPS] = useState<number>(60);
  const [performanceWarning, setPerformanceWarning] = useState<string | null>(
    null
  );
  const [adaptiveQuality, setAdaptiveQuality] = useState<
    'draft' | 'medium' | 'high' | 'low'
  >(initialQuality);
  const [capabilityWarnings, setCapabilityWarnings] = useState<string[]>([]);
  const [showCapabilityWarning, setShowCapabilityWarning] = useState(false);

  // Detect WebGL capabilities on mount
  useEffect(() => {
    const capabilities = detectWebGLCapabilities();
    const warnings = getCapabilityWarnings(capabilities);

    if (warnings.length > 0) {
      setCapabilityWarnings(warnings);
      setShowCapabilityWarning(true);

      // Auto-hide after 10 seconds
      setTimeout(() => setShowCapabilityWarning(false), 10000);
    }

    // Log capabilities in development
    if (process.env.NODE_ENV === 'development') {
      logCapabilities(capabilities);
    }
  }, []);

  // Debug logging
  console.log('🎬 DreamScene render:', {
    dreamId: dream?.id,
    dreamStyle: dream?.style,
    hasStructures: !!dream?.structures?.length,
    hasEntities: !!dream?.entities?.length,
    hasCinematography: !!dream?.cinematography,
    isPlaying,
    currentTime,
  });
  // Valid Environment presets from @react-three/drei
  const validPresets = [
    'night',
    'apartment',
    'city',
    'dawn',
    'forest',
    'lobby',
    'park',
    'studio',
    'sunset',
    'warehouse',
  ] as const;
  type ValidPreset = (typeof validPresets)[number];

  const getValidPreset = (preset?: string): ValidPreset => {
    // Handle composite presets like "clouds/dusk" or "golden_hour"
    if (preset) {
      if (
        preset.includes('clouds') ||
        preset.includes('dusk') ||
        preset.includes('golden')
      ) {
        return 'sunset';
      }
      if (preset.includes('space')) {
        return 'night';
      }
      if (validPresets.includes(preset as ValidPreset)) {
        return preset as ValidPreset;
      }
    }
    return 'sunset'; // Default fallback
  };

  const environmentPreset = getValidPreset(dream.environment?.preset);

  // Color scheme based on style
  const getStyleColors = (style: string) => {
    switch (style) {
      case 'cyberpunk':
        return {
          bg: '#0a0a0a',
          fog: '#001122',
          ambient: '#004466',
        };
      case 'nightmare':
        return {
          bg: '#1a0d1a',
          fog: '#2d1b2d',
          ambient: '#4d2d4d',
        };
      case 'fantasy':
        return {
          bg: '#2d1810',
          fog: '#4a2d1a',
          ambient: '#6b4226',
        };
      case 'surreal':
        return {
          bg: '#1a1a2e',
          fog: '#16213e',
          ambient: '#0f3460',
        };
      default: // ethereal
        return {
          bg: '#0f1419',
          fog: '#1a2b3d',
          ambient: '#2d4a6b',
        };
    }
  };

  const styleColors = getStyleColors(dream.style);

  // Performance monitoring callbacks
  const handlePerformanceChange = useCallback(
    (fps: number) => {
      setCurrentFPS(Math.round(fps));

      // Only apply adaptive quality if enabled (default true unless explicitly disabled)
      const adaptiveEnabled =
        renderConfig.customQuality?.adaptiveQuality !== false;
      if (!adaptiveEnabled) return;

      // Adaptive quality adjustment based on FPS
      const targetFPS = renderConfig.fps || 30;
      const currentQuality = adaptiveQuality;

      if (fps < targetFPS * 0.7) {
        // Below 70% of target
        if (currentQuality === 'high') {
          setAdaptiveQuality('medium');
          setPerformanceWarning(
            'Performance degraded. Switching to Medium quality.'
          );
          setTimeout(() => setPerformanceWarning(null), 3000);
        } else if (currentQuality === 'medium') {
          setAdaptiveQuality('draft');
          setPerformanceWarning(
            'Performance degraded. Switching to Draft quality.'
          );
          setTimeout(() => setPerformanceWarning(null), 3000);
        }
      } else if (fps > targetFPS * 1.2 && currentQuality !== initialQuality) {
        // Performance improved, restore original quality gradually
        if (currentQuality === 'draft' && initialQuality !== 'draft') {
          setAdaptiveQuality('medium');
          setPerformanceWarning(
            'Performance improved. Restoring Medium quality.'
          );
          setTimeout(() => setPerformanceWarning(null), 3000);
        } else if (currentQuality === 'medium' && initialQuality === 'high') {
          setAdaptiveQuality('high');
          setPerformanceWarning(
            'Performance improved. Restoring High quality.'
          );
          setTimeout(() => setPerformanceWarning(null), 3000);
        }
      }
    },
    [adaptiveQuality, renderConfig.fps, initialQuality]
  );

  // Get post-processing configuration based on adaptive quality setting
  const postProcessingConfig = getPresetFromQuality(adaptiveQuality);

  // Get lighting configuration based on environment and style
  const qualityLevel =
    adaptiveQuality === 'draft'
      ? 'low'
      : adaptiveQuality === 'high'
      ? 'high'
      : 'medium';
  const lightingConfig = getEnvironmentLightingConfig(
    environmentPreset,
    dream.style,
    qualityLevel
  );

  return (
    <div className='w-full h-full relative'>
      <Canvas
        ref={canvasRef}
        camera={{ position: [0, 50, 100], fov: 40, near: 0.1, far: 5000 }}
        gl={{
          preserveDrawingBuffer: true,
          antialias: renderConfig.quality !== 'draft',
          powerPreference: 'high-performance',
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.2,
        }}
        shadows
        style={{ background: styleColors.bg }}
      >
        {/* Performance Monitoring with Adaptive Quality */}
        <PerformanceMonitor
          onIncline={() => handlePerformanceChange(60)}
          onDecline={() => handlePerformanceChange(20)}
          onChange={({ fps }) => handlePerformanceChange(fps)}
        />

        {/* Enhanced Lighting System */}
        <EnhancedLighting config={lightingConfig} style={dream.style} />

        {/* Environment Effects */}
        <Suspense fallback={null}>
          {/* Fog */}
          {dream.environment?.fog && (
            <fog attach='fog' args={[styleColors.fog, 20, 200]} />
          )}

          {/* Stars for space-like environments */}
          {environmentPreset === 'night' && (
            <Stars
              radius={300}
              depth={60}
              count={2000}
              factor={6}
              saturation={0.8}
              fade={true}
            />
          )}

          {/* HDRI Environment */}
          <Environment preset={environmentPreset} />
        </Suspense>

        {/* Cinematic Camera Controller */}
        <CinematicCamera
          dream={dream}
          isPlaying={isPlaying}
          currentTime={currentTime}
          onTimeUpdate={onTimeUpdate}
        />

        {/* Dream Environment (sky, ground, etc.) */}
        <Suspense fallback={<LoadingFallback />}>
          <DreamEnvironment
            environment={dream.environment}
            style={dream.style}
          />
        </Suspense>

        {/* Dream Structures (buildings, objects) */}
        <Suspense fallback={<LoadingFallback />}>
          <DreamStructures
            structures={dream.structures || []}
            style={dream.style}
          />
          <EnhancedStructures
            structures={dream.structures || []}
            style={dream.style}
          />
        </Suspense>

        {/* Dream Entities (animated objects, particles) */}
        <Suspense fallback={<LoadingFallback />}>
          <DreamEntities
            entities={dream.entities || []}
            style={dream.style}
            isPlaying={isPlaying}
            currentTime={currentTime}
          />
          <EnhancedEntities
            entities={dream.entities || []}
            style={dream.style}
            isPlaying={isPlaying}
            currentTime={currentTime}
          />
        </Suspense>

        {/* Post-Processing Effects with Error Boundary */}
        <PostProcessingErrorBoundary
          fallback={
            <group>
              {/* Fallback: render without post-processing effects */}
            </group>
          }
        >
          <PostProcessing config={postProcessingConfig} />
        </PostProcessingErrorBoundary>
      </Canvas>

      {/* Overlay UI */}
      <div className='absolute top-4 right-4 bg-black/50 backdrop-blur-sm rounded-lg p-3 text-white text-sm'>
        <div className='space-y-1'>
          <div className='flex items-center space-x-2'>
            <div
              className={`w-2 h-2 rounded-full ${
                isPlaying ? 'bg-red-500 animate-pulse' : 'bg-green-500'
              }`}
            />
            <span>{isPlaying ? 'Playing' : 'Paused'}</span>
          </div>
          <div>
            Time: {Math.round(currentTime)}s /{' '}
            {dream.cinematography?.durationSec || 30}s
          </div>
          <div>Style: {dream.style}</div>
          {renderConfig.qualityPreset && (
            <div className='text-xs text-gray-300'>
              Preset: {renderConfig.qualityPreset}
            </div>
          )}
          <div className='flex items-center space-x-2'>
            <span>Quality: {adaptiveQuality}</span>
            {adaptiveQuality !== initialQuality && (
              <span className='text-yellow-400 text-xs'>(Adaptive)</span>
            )}
          </div>
          <div className='flex items-center space-x-2'>
            <span>FPS: {currentFPS}</span>
            {currentFPS < (renderConfig.fps || 30) && (
              <span className='text-red-400'>⚠</span>
            )}
          </div>
        </div>
      </div>

      {/* Performance Warning */}
      {performanceWarning && (
        <div className='absolute top-20 right-4 bg-yellow-500/90 backdrop-blur-sm rounded-lg p-3 text-black text-sm max-w-xs animate-fade-in'>
          <div className='flex items-start space-x-2'>
            <span className='text-lg'>⚠️</span>
            <span>{performanceWarning}</span>
          </div>
        </div>
      )}

      {/* Capability Warnings */}
      {showCapabilityWarning && capabilityWarnings.length > 0 && (
        <div className='absolute top-4 left-4 bg-orange-500/90 backdrop-blur-sm rounded-lg p-4 text-white text-sm max-w-md'>
          <div className='flex items-start justify-between mb-2'>
            <div className='flex items-center space-x-2'>
              <span className='text-lg'>⚠️</span>
              <span className='font-semibold'>Limited Feature Support</span>
            </div>
            <button
              onClick={() => setShowCapabilityWarning(false)}
              className='text-white hover:text-gray-200'
            >
              ✕
            </button>
          </div>
          <ul className='space-y-1 text-xs'>
            {capabilityWarnings.map((warning, index) => (
              <li key={index}>• {warning}</li>
            ))}
          </ul>
          <p className='text-xs mt-2 opacity-80'>
            Some visual effects may be disabled for compatibility.
          </p>
        </div>
      )}

      {/* Loading Overlay */}
      <div className='absolute inset-0 pointer-events-none'>
        <Suspense
          fallback={
            <div className='w-full h-full flex items-center justify-center bg-black/80'>
              <div className='text-center text-white'>
                <div className='w-16 h-16 border-4 border-white/20 border-t-cyan-400 rounded-full animate-spin mx-auto mb-4'></div>
                <p>Loading Dream Scene...</p>
                <p className='text-sm text-gray-400 mt-2'>
                  Rendering {dream.structures?.length || 0} structures,{' '}
                  {dream.entities?.length || 0} entities
                </p>
              </div>
            </div>
          }
        >
          {/* This suspense boundary catches any loading states from child components */}
        </Suspense>
      </div>

      {/* Performance Stats (Development Only) */}
      {process.env.NODE_ENV === 'development' && (
        <div className='absolute bottom-4 left-4 bg-black/50 backdrop-blur-sm rounded-lg p-2 text-xs text-white font-mono'>
          <div>
            FPS: {currentFPS} / {renderConfig.fps || 30} target
          </div>
          <div>
            Resolution: {renderConfig.res?.[0]}x{renderConfig.res?.[1]}
          </div>
          <div>
            Quality: {adaptiveQuality}{' '}
            {adaptiveQuality !== renderConfig.quality && '(adaptive)'}
          </div>
          <div>Original: {renderConfig.quality}</div>
          <div>Structures: {dream.structures?.length || 0}</div>
          <div>Entities: {dream.entities?.length || 0}</div>
        </div>
      )}
    </div>
  );
}
