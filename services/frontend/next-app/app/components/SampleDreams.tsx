'use client';

import { useState } from 'react';

interface SampleDream {
  id: string;
  title: string;
  description: string;
  style: string;
  thumbnail: string;
  jsonFile: string;
}

interface SampleDreamsProps {
  onSelectDream: (dreamData: any) => void;
  isGenerating: boolean;
}

const SAMPLE_DREAMS: SampleDream[] = [
  {
    id: 'cosmic_voyage',
    title: '🌌 Cosmic Voyage',
    description:
      'Journey through a galaxy of crystalline planets orbiting a golden star',
    style: 'fantasy',
    thumbnail: '🪐',
    jsonFile: 'cosmic_voyage_3d.json',
  },
  {
    id: 'cyberpunk_garden',
    title: '🌸 Cyberpunk Garden',
    description: 'Neon-lit garden where digital flowers bloom in binary code',
    style: 'cyberpunk',
    thumbnail: '🌺',
    jsonFile: 'cyberpunk_garden.json',
  },
  {
    id: 'ethereal_library',
    title: '📚 Ethereal Library',
    description: 'Infinite library where books float and pages turn themselves',
    style: 'ethereal',
    thumbnail: '📖',
    jsonFile: 'ethereal_library.json',
  },
  {
    id: 'surreal_house',
    title: '🏡 Surreal House',
    description: 'A house that grows like a tree with rooms as leaves',
    style: 'surreal',
    thumbnail: '🌳',
    jsonFile: 'surreal_house.json',
  },
  {
    id: 'floating_library',
    title: '☁️ Floating Library',
    description: 'Magical library among clouds with swirling glowing books',
    style: 'ethereal',
    thumbnail: '✨',
    jsonFile: 'floating_library_books.json',
  },
];

export default function SampleDreams({
  onSelectDream,
  isGenerating,
}: SampleDreamsProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSelectSample = async (sample: SampleDream) => {
    setLoading(sample.id);
    setError(null);

    try {
      // Fetch the JSON file from the sample_dreams directory
      const response = await fetch(`/api/sample-dreams/${sample.jsonFile}`);

      if (!response.ok) {
        throw new Error(`Failed to load sample dream: ${response.statusText}`);
      }

      const dreamData = await response.json();

      console.log('✅ Loaded sample dream:', sample.title);
      console.log('📊 Dream data:', dreamData);

      // Pass the dream data to the parent component
      onSelectDream(dreamData);
    } catch (err) {
      console.error('❌ Error loading sample dream:', err);
      setError(`Failed to load ${sample.title}`);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className='bg-white/5 rounded-lg p-4'>
      <h3 className='text-lg font-semibold mb-3 flex items-center'>
        <span className='mr-2'>✨</span>
        Try These Cinematic Dreams
      </h3>

      {error && (
        <div className='mb-3 p-2 bg-red-500/20 border border-red-500/50 rounded text-sm text-red-200'>
          {error}
        </div>
      )}

      <div className='space-y-2'>
        {SAMPLE_DREAMS.map((sample) => (
          <button
            key={sample.id}
            onClick={() => handleSelectSample(sample)}
            disabled={isGenerating || loading === sample.id}
            className='w-full text-left p-3 bg-white/10 hover:bg-white/20 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed group'
          >
            <div className='flex items-start space-x-3'>
              <div className='text-3xl flex-shrink-0 group-hover:scale-110 transition-transform'>
                {sample.thumbnail}
              </div>
              <div className='flex-1 min-w-0'>
                <div className='font-semibold text-white mb-1 flex items-center justify-between'>
                  <span>{sample.title}</span>
                  {loading === sample.id && (
                    <div className='w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin'></div>
                  )}
                </div>
                <p className='text-sm text-gray-300 line-clamp-2'>
                  {sample.description}
                </p>
                <div className='mt-1 flex items-center space-x-2'>
                  <span className='text-xs px-2 py-0.5 bg-cyan-500/20 text-cyan-300 rounded'>
                    {sample.style}
                  </span>
                  <span className='text-xs text-gray-400'>Click to load</span>
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className='mt-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg'>
        <p className='text-xs text-blue-200'>
          💡 <strong>Tip:</strong> These are pre-configured cinematic scenes
          with dynamic camera tracking, entity attachments, and timed events.
          Perfect for testing the full rendering pipeline!
        </p>
      </div>
    </div>
  );
}
