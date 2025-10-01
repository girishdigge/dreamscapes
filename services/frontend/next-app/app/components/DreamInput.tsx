// services/frontend/next-app/app/components/DreamInput.tsx
'use client';

import { useState } from 'react';

interface DreamInputProps {
  onGenerate: (text: string, style: string) => void;
  onPatch: (text: string) => void;
  isGenerating: boolean;
  hasDream: boolean;
}

export default function DreamInput({
  onGenerate,
  onPatch,
  isGenerating,
  hasDream,
}: DreamInputProps) {
  const [dreamText, setDreamText] = useState('');
  const [patchText, setPatchText] = useState('');
  const [selectedStyle, setSelectedStyle] = useState('ethereal');
  const [showPatch, setShowPatch] = useState(false);

  const styles = [
    { value: 'ethereal', label: '✨ Ethereal', desc: 'Soft, dreamy, luminous' },
    {
      value: 'cyberpunk',
      label: '🌃 Cyberpunk',
      desc: 'Neon, digital, futuristic',
    },
    {
      value: 'surreal',
      label: '🎭 Surreal',
      desc: 'Impossible, abstract, weird',
    },
    { value: 'fantasy', label: '🏰 Fantasy', desc: 'Magical, mythical, epic' },
    { value: 'nightmare', label: '👻 Nightmare', desc: 'Dark, ominous, scary' },
  ];

  const handleGenerate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!dreamText.trim() || isGenerating) return;

    await onGenerate(dreamText.trim(), selectedStyle);
  };

  const handlePatch = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!patchText.trim() || isGenerating) return;

    await onPatch(patchText.trim());
    setPatchText('');
    setShowPatch(false);
  };

  return (
    <div className='space-y-4'>
      {/* Main Dream Input */}
      <div className='bg-white/10 backdrop-blur-sm rounded-lg p-4'>
        <h2 className='text-xl font-semibold mb-4'>Describe Your Dream</h2>

        <form onSubmit={handleGenerate} className='space-y-4'>
          <div>
            <textarea
              value={dreamText}
              onChange={(e) => setDreamText(e.target.value)}
              placeholder='I dreamed of a floating library where books fly around like birds, spelling out messages in the sky...'
              className='w-full h-32 p-3 bg-black/30 border border-white/20 rounded-lg text-white placeholder-gray-400 resize-none focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400'
              disabled={isGenerating}
            />
            <p className='text-xs text-gray-400 mt-1'>
              {dreamText.length}/500 characters
            </p>
          </div>

          {/* Style Selection */}
          <div>
            <label className='block text-sm font-medium mb-2'>
              Dream Style
            </label>
            <div className='grid grid-cols-1 gap-2'>
              {styles.map((style) => (
                <label
                  key={style.value}
                  className={`flex items-center p-3 rounded-lg cursor-pointer transition-all ${
                    selectedStyle === style.value
                      ? 'bg-cyan-500/20 border-cyan-400 border'
                      : 'bg-white/5 border border-transparent hover:bg-white/10'
                  }`}
                >
                  <input
                    type='radio'
                    name='style'
                    value={style.value}
                    checked={selectedStyle === style.value}
                    onChange={(e) => setSelectedStyle(e.target.value)}
                    className='sr-only'
                  />
                  <div className='flex-1'>
                    <div className='font-medium'>{style.label}</div>
                    <div className='text-xs text-gray-400'>{style.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <button
            type='submit'
            disabled={!dreamText.trim() || isGenerating}
            className='w-full py-3 bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 disabled:from-gray-500 disabled:to-gray-600 disabled:cursor-not-allowed rounded-lg font-semibold transition-all transform hover:scale-[1.02] disabled:scale-100'
          >
            {isGenerating ? (
              <div className='flex items-center justify-center space-x-2'>
                <div className='w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin'></div>
                <span>Generating Dream...</span>
              </div>
            ) : (
              'Generate Dream 🌙'
            )}
          </button>
        </form>
      </div>

      {/* Patch Input */}
      {hasDream && (
        <div className='bg-white/10 backdrop-blur-sm rounded-lg p-4'>
          <div className='flex items-center justify-between mb-3'>
            <h3 className='text-lg font-semibold'>Edit Your Dream</h3>
            <button
              onClick={() => setShowPatch(!showPatch)}
              className='text-cyan-400 hover:text-cyan-300 text-sm'
            >
              {showPatch ? 'Hide' : 'Show'} Editor
            </button>
          </div>

          {showPatch && (
            <form onSubmit={handlePatch} className='space-y-3'>
              <div>
                <textarea
                  value={patchText}
                  onChange={(e) => setPatchText(e.target.value)}
                  placeholder='Make the books glow blue and fly faster...'
                  className='w-full h-20 p-3 bg-black/30 border border-white/20 rounded-lg text-white placeholder-gray-400 resize-none focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400'
                  disabled={isGenerating}
                />
              </div>

              <div className='flex space-x-2'>
                <button
                  type='submit'
                  disabled={!patchText.trim() || isGenerating}
                  className='flex-1 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded font-medium text-sm transition-colors'
                >
                  {isGenerating ? 'Applying...' : 'Apply Edit'}
                </button>

                <button
                  type='button'
                  onClick={() => {
                    setPatchText('');
                    setShowPatch(false);
                  }}
                  className='px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded font-medium text-sm transition-colors'
                >
                  Cancel
                </button>
              </div>

              {/* Quick Edit Suggestions */}
              <div className='text-xs'>
                <p className='text-gray-400 mb-2'>Quick edits:</p>
                <div className='flex flex-wrap gap-1'>
                  {[
                    'make it glow blue',
                    'add more books',
                    'make it darker',
                    'zoom in closer',
                    'move faster',
                  ].map((suggestion) => (
                    <button
                      key={suggestion}
                      type='button'
                      onClick={() => setPatchText(suggestion)}
                      className='px-2 py-1 bg-white/10 hover:bg-white/20 rounded text-xs transition-colors'
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
