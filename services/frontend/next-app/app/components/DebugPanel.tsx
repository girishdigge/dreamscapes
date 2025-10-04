// Debug panel component to help identify frontend issues
'use client';

import { useState } from 'react';
import { Dream } from '../types/dream';

interface DebugPanelProps {
  dream: Dream | null;
  isGenerating: boolean;
  error: string | null;
}

export default function DebugPanel({
  dream,
  isGenerating,
  error,
}: DebugPanelProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <div className='fixed bottom-4 right-4 z-50'>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className='bg-red-600 text-white px-3 py-2 rounded-lg text-sm font-mono'
      >
        DEBUG {isOpen ? '▼' : '▲'}
      </button>

      {isOpen && (
        <div className='absolute bottom-12 right-0 bg-black/90 text-white p-4 rounded-lg max-w-md max-h-96 overflow-auto text-xs font-mono'>
          <h3 className='text-yellow-400 font-bold mb-2'>Debug Information</h3>

          <div className='space-y-2'>
            <div>
              <span className='text-cyan-400'>Status:</span>
              <div className='ml-2'>
                <div>Generating: {isGenerating ? '🔄 YES' : '✅ NO'}</div>
                <div>Has Dream: {dream ? '✅ YES' : '❌ NO'}</div>
                <div>Has Error: {error ? '❌ YES' : '✅ NO'}</div>
              </div>
            </div>

            {error && (
              <div>
                <span className='text-red-400'>Error:</span>
                <div className='ml-2 text-red-300'>{error}</div>
              </div>
            )}

            {dream && (
              <div>
                <span className='text-green-400'>Dream Data:</span>
                <div className='ml-2'>
                  <div>ID: {dream.id || '❌ MISSING'}</div>
                  <div>Style: {dream.style || '❌ MISSING'}</div>
                  <div>Structures: {dream.structures?.length || 0}</div>
                  <div>Entities: {dream.entities?.length || 0}</div>
                  <div>
                    Cinematography: {dream.cinematography ? '✅' : '❌'}
                  </div>
                  <div>Environment: {dream.environment ? '✅' : '❌'}</div>
                  <div>Render Config: {dream.render ? '✅' : '❌'}</div>
                </div>
              </div>
            )}

            {dream && (
              <div>
                <span className='text-blue-400'>Raw Dream Object:</span>
                <pre className='ml-2 text-xs bg-gray-800 p-2 rounded mt-1 max-h-32 overflow-auto'>
                  {JSON.stringify(dream, null, 2)}
                </pre>
              </div>
            )}

            <div>
              <span className='text-purple-400'>Environment:</span>
              <div className='ml-2'>
                <div>NODE_ENV: {process.env.NODE_ENV}</div>
                <div>
                  API URL: {process.env.NEXT_PUBLIC_API_URL || 'default'}
                </div>
              </div>
            </div>

            <div>
              <span className='text-orange-400'>Actions:</span>
              <div className='ml-2 space-y-1'>
                <button
                  onClick={() => console.log('Dream object:', dream)}
                  className='bg-blue-600 px-2 py-1 rounded text-xs'
                >
                  Log Dream to Console
                </button>
                <button
                  onClick={async () => {
                    try {
                      const response = await fetch('/api/parse-dream', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          text: 'Debug test dream',
                          style: 'ethereal',
                        }),
                      });
                      const result = await response.json();
                      console.log('API Test Result:', result);
                    } catch (err) {
                      console.error('API Test Error:', err);
                    }
                  }}
                  className='bg-green-600 px-2 py-1 rounded text-xs'
                >
                  Test API Call
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
