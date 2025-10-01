// services/frontend/next-app/app/components/DreamControls.tsx
'use client';

import { useState, useRef } from 'react';
import { Dream } from '../types/dream';

interface DreamControlsProps {
  dream: Dream;
  isPlaying: boolean;
  currentTime: number;
  onPlayToggle: () => void;
  onExport: (format: string) => Promise<unknown>;
  onTimeUpdate: (time: number) => void;
}

export default function DreamControls({
  dream,
  isPlaying,
  currentTime,
  onPlayToggle,
  onExport,
  onTimeUpdate,
}: DreamControlsProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [exportFormat, setExportFormat] = useState('webm');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  const duration = dream?.cinematography?.durationSec || 30;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    const newTime = Math.max(0, Math.min(duration, percentage * duration));
    onTimeUpdate(newTime);
  };

  const startRecording = async () => {
    try {
      const canvas = document.querySelector('canvas');
      if (!canvas) {
        throw new Error('No canvas found');
      }

      const stream = canvas.captureStream(30);

      // Check for supported MIME types
      const mimeTypes = [
        'video/webm;codecs=vp9',
        'video/webm;codecs=vp8',
        'video/webm',
        'video/mp4',
      ];

      let selectedMimeType = 'video/webm';
      for (const mimeType of mimeTypes) {
        if (MediaRecorder.isTypeSupported(mimeType)) {
          selectedMimeType = mimeType;
          break;
        }
      }

      recordedChunksRef.current = [];
      mediaRecorderRef.current = new MediaRecorder(stream, {
        mimeType: selectedMimeType,
        videoBitsPerSecond: 2500000, // 2.5 Mbps
      });

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, {
          type: selectedMimeType,
        });

        // Create download link
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const fileExtension = selectedMimeType.includes('webm')
          ? 'webm'
          : 'mp4';
        a.href = url;
        a.download = `dream-${dream.id || 'export'}.${fileExtension}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        setIsRecording(false);
        console.log('Recording saved!');
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);

      // Auto-stop after duration
      setTimeout(() => {
        if (
          mediaRecorderRef.current &&
          mediaRecorderRef.current.state === 'recording'
        ) {
          mediaRecorderRef.current.stop();
        }
      }, duration * 1000);

      // Start playback
      onPlayToggle();
    } catch (error) {
      console.error('Recording failed:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';
      alert('Recording failed: ' + errorMessage);
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === 'recording'
    ) {
      mediaRecorderRef.current.stop();
    }
  };

  const handleExport = async () => {
    if (isRecording) {
      stopRecording();
      return;
    }

    try {
      const result = await onExport(exportFormat);

      if (!result) {
        // Fallback to client-side recording
        startRecording();
      }
    } catch (error) {
      console.error('Export error:', error);
      // Fallback to client-side recording
      startRecording();
    }
  };

  return (
    <div className='bg-white/10 backdrop-blur-sm rounded-lg p-4 space-y-4'>
      <h3 className='text-lg font-semibold'>Playback Controls</h3>

      {/* Play/Pause Button */}
      <div className='flex items-center justify-center'>
        <button
          onClick={onPlayToggle}
          className='w-16 h-16 bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 rounded-full flex items-center justify-center text-2xl transition-all transform hover:scale-105'
        >
          {isPlaying ? '⏸️' : '▶️'}
        </button>
      </div>

      {/* Timeline */}
      <div className='space-y-2'>
        <div className='flex justify-between text-sm text-gray-400'>
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>

        <div
          className='w-full h-2 bg-white/20 rounded-full cursor-pointer'
          onClick={handleSeek}
        >
          <div
            className='h-full bg-gradient-to-r from-cyan-400 to-purple-400 rounded-full transition-all'
            style={{ width: `${(currentTime / duration) * 100}%` }}
          />
        </div>
      </div>

      {/* Shot Timeline */}
      {dream?.cinematography?.shots && (
        <div className='space-y-2'>
          <h4 className='text-sm font-medium text-gray-300'>Shots</h4>
          <div className='space-y-1'>
            {dream.cinematography.shots.map((shot, i) => {
              const startTime = dream
                .cinematography!.shots.slice(0, i)
                .reduce((acc, s) => acc + s.duration, 0);
              const isActive =
                currentTime >= startTime &&
                currentTime < startTime + shot.duration;

              return (
                <div
                  key={i}
                  className={`p-2 rounded text-xs transition-colors ${
                    isActive
                      ? 'bg-cyan-500/30 border border-cyan-400'
                      : 'bg-white/10'
                  }`}
                >
                  <div className='flex justify-between'>
                    <span className='capitalize'>
                      {shot.type.replace('_', ' ')}
                    </span>
                    <span>
                      {formatTime(startTime)} -{' '}
                      {formatTime(startTime + shot.duration)}
                    </span>
                  </div>
                  {shot.target && (
                    <div className='text-gray-400 mt-1'>
                      Target: {shot.target}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Export Section */}
      <div className='space-y-3 pt-4 border-t border-white/20'>
        <h4 className='text-sm font-medium'>Export Dream</h4>

        <div className='flex items-center space-x-2'>
          <select
            value={exportFormat}
            onChange={(e) => setExportFormat(e.target.value)}
            className='flex-1 p-2 bg-black/30 border border-white/20 rounded text-sm text-white focus:outline-none focus:border-cyan-400'
            disabled={isRecording}
          >
            <option value='webm'>WebM (Chrome/Firefox)</option>
            <option value='mp4'>MP4 (Safari/Edge)</option>
          </select>
        </div>

        <button
          onClick={handleExport}
          disabled={isRecording && !mediaRecorderRef.current}
          className='w-full py-2 bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed rounded font-medium text-sm transition-all'
        >
          {isRecording ? (
            <div className='flex items-center justify-center space-x-2'>
              <div className='w-4 h-4 bg-red-500 rounded-full animate-pulse'></div>
              <span>Recording... ({duration}s)</span>
            </div>
          ) : (
            '📹 Record & Download'
          )}
        </button>

        {isRecording && (
          <button
            onClick={stopRecording}
            className='w-full py-2 bg-red-600 hover:bg-red-700 rounded font-medium text-sm transition-colors'
          >
            ⏹️ Stop Recording
          </button>
        )}

        <div className='text-xs text-gray-400 space-y-1'>
          <p>• Click Record to capture the cinematic playthrough</p>
          <p>• Video will auto-download when complete</p>
          <p>• Ensure canvas is visible during recording</p>
        </div>
      </div>

      {/* Debug Info */}
      {process.env.NODE_ENV === 'development' && (
        <details className='text-xs'>
          <summary className='cursor-pointer text-gray-400'>Debug Info</summary>
          <pre className='mt-2 p-2 bg-black/30 rounded text-gray-300 overflow-auto'>
            {JSON.stringify(
              {
                isPlaying,
                currentTime,
                duration,
                isRecording,
                shotsCount: dream?.cinematography?.shots?.length || 0,
              },
              null,
              2
            )}
          </pre>
        </details>
      )}
    </div>
  );
}
