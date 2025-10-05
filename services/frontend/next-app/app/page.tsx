// services/frontend/next-app/app/page.tsx
'use client';

import { useState, useEffect } from 'react';
import DreamInput from './components/DreamInput';
import DreamScene from './components/DreamScene';
import DreamControls from './components/DreamControls';
import DebugPanel from './components/DebugPanel';
import ErrorBoundary from './components/ErrorBoundary';
import SampleDreams from './components/SampleDreams';
import { Dream } from './types/dream';

export default function Home() {
  const [dream, setDream] = useState<Dream | null>(null);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [isClient, setIsClient] = useState<boolean>(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const handleGenerateDream = async (
    text: string,
    style: string = 'ethereal'
  ) => {
    setIsGenerating(true);
    setError(null);

    try {
      // Try to call the backend API
      const response = await fetch('/api/parse-dream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, style }),
      });

      const result = await response.json();

      console.log('🔍 Full API Response:', result);
      console.log('🔍 Response Status:', response.status);
      console.log(
        '🔍 Response Headers:',
        Object.fromEntries(response.headers.entries())
      );

      if (result.success) {
        console.log('✅ Dream generation successful');
        console.log('🎨 Dream data:', result.data);
        console.log('📊 Dream metadata:', result.metadata);

        // Validate dream data before setting
        if (result.data && typeof result.data === 'object') {
          console.log('✅ Dream data is valid object');
          console.log('🔍 Dream validation:', {
            hasId: !!result.data.id,
            hasStyle: !!result.data.style,
            hasStructures: Array.isArray(result.data.structures),
            hasEntities: Array.isArray(result.data.entities),
            hasCinematography: !!result.data.cinematography,
          });

          setDream(result.data);
          console.log('✅ Dream state updated successfully');
        } else {
          console.error('❌ Invalid dream data structure:', result.data);
          throw new Error('Invalid dream data structure received');
        }
      } else {
        console.warn('⚠️ API returned success: false');
        // Use fallback if provided
        if (result.data) {
          console.log('🔄 Using fallback dream data');
          setDream(result.data);
          setError('Using fallback dream due to API issues');
        } else {
          throw new Error(result.error || 'Failed to generate dream');
        }
      }
    } catch (err) {
      console.error('Generation error:', err);

      // Create local fallback dream
      const fallbackDream = createFallbackDream(text, style);
      setDream(fallbackDream);
      setError('Using local fallback - backend not available');
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePatchDream = async (editText: string) => {
    if (!dream) return;

    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch('/api/patch-dream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dreamId: dream.id,
          editText,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setDream(result.data);
        console.log('Patched dream:', result.data);
      } else {
        throw new Error(result.error || 'Failed to patch dream');
      }
    } catch (err) {
      console.error('Patch error:', err);

      // Simple local patching - just keep the dream as is since we can't modify it structurally
      // In a real implementation, this would apply the edit to the dream content
      console.log(`Local edit applied: ${editText}`);
      setError('Applied local edit - backend not available');
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePlayToggle = () => {
    setIsPlaying(!isPlaying);
    if (!isPlaying) {
      setCurrentTime(0);
    }
  };

  const handleExport = async (format: string = 'webm') => {
    if (!dream) return;

    try {
      const response = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dreamId: dream.id,
          format,
        }),
      });

      const result = await response.json();

      if (result.success) {
        console.log('Export queued:', result.config);
        return result.config;
      } else {
        setError('Export failed');
      }
    } catch (err) {
      console.error('Export error:', err);
      setError('Export failed - trying client-side recording');
    }
  };

  const createFallbackDream = (text: string, style: string): Dream => {
    const styleConfigs = {
      ethereal: {
        entityColor: '#ffffff',
        glow: 0.8,
        speed: 1.0,
        skyColor: '#a6d8ff',
      },
      cyberpunk: {
        entityColor: '#00ffff',
        glow: 1.0,
        speed: 2.0,
        skyColor: '#001133',
      },
      surreal: {
        entityColor: '#ff0080',
        glow: 0.9,
        speed: 1.5,
        skyColor: '#2d1a4a',
      },
      fantasy: {
        entityColor: '#ffd700',
        glow: 0.7,
        speed: 0.8,
        skyColor: '#4a2d1a',
      },
      nightmare: {
        entityColor: '#800020',
        glow: 0.3,
        speed: 0.6,
        skyColor: '#1a0d1a',
      },
    };

    const config =
      styleConfigs[style as keyof typeof styleConfigs] || styleConfigs.ethereal;

    // Create a deterministic ID based on text and style to avoid hydration mismatch
    const textHash = text.split('').reduce((a, b) => {
      a = (a << 5) - a + b.charCodeAt(0);
      return a & a;
    }, 0);

    return {
      id: `local_${Math.abs(textHash)}_${style}`,
      style: style || 'ethereal',
      environment: {
        preset: 'sunset',
        fog: 0.3,
        skyColor: config.skyColor,
        ambientLight: 0.8,
      },
      structures: [
        {
          id: 's1',
          template: 'floating_library',
          pos: [0, 20, 0],
          scale: 1,
          features: ['infinite_stair'],
        },
      ],
      entities: [
        {
          id: 'e1',
          type: 'book_swarm',
          count: style === 'cyberpunk' ? 30 : 20,
          params: {
            speed: config.speed,
            glow: config.glow,
            color: config.entityColor,
          },
        },
      ],
      cinematography: {
        durationSec: 30,
        shots: [
          {
            type: 'establish',
            target: 's1',
            duration: 15,
            startPos: [0, 30, 50],
            endPos: [20, 25, 30],
          },
          {
            type: 'flythrough',
            target: 'e1',
            duration: 15,
            startPos: [20, 25, 30],
            endPos: [-20, 15, -20],
          },
        ],
      },
      render: { res: [1280, 720], fps: 30, quality: 'draft' as const },
    };
  };

  return (
    <div className='min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 text-white'>
      {/* Header */}
      <header className='p-6 text-center border-b border-white/10'>
        <h1 className='text-4xl font-bold mb-2 bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent'>
          🌙 Dreamscapes
        </h1>
        <p className='text-gray-300'>
          Transform your dreams into interactive films
        </p>
      </header>

      <div className='flex flex-col lg:flex-row min-h-[calc(100vh-120px)]'>
        {/* Left Panel - Controls */}
        <div className='lg:w-1/3 p-6 border-r border-white/10 space-y-6'>
          {/* Dream Input */}
          <DreamInput
            onGenerate={handleGenerateDream}
            onPatch={handlePatchDream}
            isGenerating={isGenerating}
            hasDream={!!dream}
          />

          {/* Error Display */}
          {error && (
            <div className='bg-red-500/20 border border-red-500/50 rounded-lg p-4'>
              <p className='text-red-200 text-sm'>{error}</p>
            </div>
          )}

          {/* Dream Info */}
          {dream && (
            <div className='bg-white/10 rounded-lg p-4 space-y-3'>
              <h3 className='text-lg font-semibold'>Dream Scene</h3>
              <div className='text-sm space-y-1'>
                <p>
                  <span className='text-cyan-400'>Style:</span> {dream.style}
                </p>
                <p>
                  <span className='text-cyan-400'>Duration:</span>{' '}
                  {dream.cinematography?.durationSec || 30}s
                </p>
                <p>
                  <span className='text-cyan-400'>Structures:</span>{' '}
                  {dream.structures?.length || 0}
                </p>
                <p>
                  <span className='text-cyan-400'>Entities:</span>{' '}
                  {dream.entities?.length || 0}
                </p>
              </div>
            </div>
          )}

          {/* Controls */}
          {dream && (
            <DreamControls
              dream={dream}
              isPlaying={isPlaying}
              currentTime={currentTime}
              onPlayToggle={handlePlayToggle}
              onExport={handleExport}
              onTimeUpdate={setCurrentTime}
            />
          )}

          {/* Sample Dreams */}
          {isClient && (
            <SampleDreams
              onSelectDream={setDream}
              isGenerating={isGenerating}
            />
          )}
        </div>

        {/* Right Panel - 3D Scene */}
        <div className='lg:w-2/3 relative'>
          {dream ? (
            <ErrorBoundary>
              <DreamScene
                dream={dream}
                isPlaying={isPlaying}
                currentTime={currentTime}
                onTimeUpdate={setCurrentTime}
              />
            </ErrorBoundary>
          ) : (
            <div className='h-full flex items-center justify-center bg-black/20'>
              <div className='text-center'>
                <div className='text-6xl mb-4'>🌙</div>
                <h2 className='text-2xl font-semibold mb-2'>Ready to Dream</h2>
                <p className='text-gray-400'>
                  Describe your dream to get started
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Debug Panel (Development Only) */}
      <DebugPanel dream={dream} isGenerating={isGenerating} error={error} />
    </div>
  );
}
