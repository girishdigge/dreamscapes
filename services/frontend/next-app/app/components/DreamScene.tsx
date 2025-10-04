// services/frontend/next-app/app/components/DreamScene.tsx
'use client';

import { Suspense, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { Environment, Stars } from '@react-three/drei';
import CinematicCamera from './CinematicCamera';
import DreamEnvironment from './DreamEnvironment';
import DreamStructures from './DreamStructures';
import DreamEntities from './DreamEntities';
import LoadingFallback from './LoadingFallback';
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

  // Canvas settings based on dream render config
  const renderConfig = dream.render || {
    res: [1280, 720],
    fps: 30,
    quality: 'draft',
  };
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
    if (preset && validPresets.includes(preset as ValidPreset)) {
      return preset as ValidPreset;
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

  return (
    <div className='w-full h-full relative'>
      <Canvas
        ref={canvasRef}
        camera={{ position: [0, 30, 50], fov: 60 }}
        gl={{
          preserveDrawingBuffer: true,
          antialias: renderConfig.quality !== 'draft',
          powerPreference: 'high-performance',
        }}
        style={{ background: styleColors.bg }}
      >
        {/* Lighting Setup */}
        <ambientLight
          intensity={dream.environment?.ambientLight || 0.8}
          color={styleColors.ambient}
        />
        <directionalLight
          position={[10, 10, 5]}
          intensity={1}
          color='#ffffff'
          castShadow
        />
        <pointLight
          position={[0, 50, 0]}
          intensity={0.5}
          distance={100}
          color='#87ceeb'
        />

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
        </Suspense>

        {/* Dream Entities (animated objects, particles) */}
        <Suspense fallback={<LoadingFallback />}>
          <DreamEntities
            entities={dream.entities || []}
            style={dream.style}
            isPlaying={isPlaying}
            currentTime={currentTime}
          />
        </Suspense>
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
          <div>Render: {renderConfig.quality}</div>
        </div>
      </div>

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
          <div>FPS Target: {renderConfig.fps}</div>
          <div>
            Resolution: {renderConfig.res?.[0]}x{renderConfig.res?.[1]}
          </div>
          <div>Quality: {renderConfig.quality}</div>
        </div>
      )}
    </div>
  );
}
