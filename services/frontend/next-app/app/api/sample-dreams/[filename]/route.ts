import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';

export async function GET(
  request: NextRequest,
  { params }: { params: { filename: string } }
) {
  const { filename } = params;

  try {
    // Security: Only allow specific JSON files
    const allowedFiles = [
      'star_collision.json',
      'titanic_ocean_voyage.json',
      'volcano_eruption.json',
      'floating_library_books.json',
      'growing_house_tree.json',
      'cosmic_voyage_3d.json',
      'cyberpunk_garden.json',
      'ethereal_library.json',
      'surreal_house.json',
    ];

    if (!allowedFiles.includes(filename)) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // Path to sample_dreams directory
    // Try multiple possible paths since process.cwd() varies by environment
    const possiblePaths = [
      // When running from project root
      join(process.cwd(), 'sample_dreams', filename),
      // When running from services/frontend/next-app
      join(process.cwd(), '..', '..', '..', 'sample_dreams', filename),
      // When running from services/frontend
      join(process.cwd(), '..', '..', 'sample_dreams', filename),
      // When running from services
      join(process.cwd(), '..', 'sample_dreams', filename),
    ];

    console.log('process.cwd():', process.cwd());
    console.log('Trying paths:', possiblePaths);

    // Try each path until we find one that works
    let fileContent: string | null = null;
    let successfulPath: string | null = null;

    for (const filePath of possiblePaths) {
      try {
        fileContent = await readFile(filePath, 'utf-8');
        successfulPath = filePath;
        console.log('✅ Successfully loaded from:', filePath);
        break;
      } catch (err) {
        console.log('❌ Failed to load from:', filePath);
        continue;
      }
    }

    if (!fileContent || !successfulPath) {
      throw new Error(
        `File not found in any of the expected locations: ${filename}`
      );
    }

    const dreamData = JSON.parse(fileContent);

    // Return the dream data
    return NextResponse.json(dreamData, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    });
  } catch (error) {
    console.error('Error loading sample dream:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      filename,
      cwd: process.cwd(),
    });
    return NextResponse.json(
      {
        error: 'Failed to load sample dream',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
