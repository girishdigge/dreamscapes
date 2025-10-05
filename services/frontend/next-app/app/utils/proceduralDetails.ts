// Procedural detail generation utilities for complex structures
import * as THREE from 'three';

/**
 * Add subtle surface imperfections to geometry vertices
 */
export function addSurfaceImperfections(
  geometry: THREE.BufferGeometry,
  intensity: number = 0.01
): void {
  const positions = geometry.attributes.position;
  if (!positions) return;

  for (let i = 0; i < positions.count; i++) {
    const noise = (Math.random() - 0.5) * intensity;
    const x = positions.getX(i);
    const y = positions.getY(i);
    const z = positions.getZ(i);

    // Add noise in the direction of the vertex normal
    const length = Math.sqrt(x * x + y * y + z * z);
    if (length > 0) {
      const scale = 1 + noise / length;
      positions.setXYZ(i, x * scale, y * scale, z * scale);
    }
  }

  positions.needsUpdate = true;
  geometry.computeVertexNormals();
}

/**
 * Generate window positions for ship structure
 */
export function generateShipWindows(
  count: number,
  hullLength: number
): Array<{
  position: [number, number, number];
  rotation: [number, number, number];
}> {
  const windows: Array<{
    position: [number, number, number];
    rotation: [number, number, number];
  }> = [];
  const spacing = hullLength / (count + 1);

  for (let i = 0; i < count; i++) {
    const x = -hullLength / 2 + spacing * (i + 1);

    // Front side windows
    windows.push({
      position: [x, 4, 3.85],
      rotation: [0, 0, 0],
    });

    // Back side windows
    windows.push({
      position: [x, 4, -3.85],
      rotation: [0, Math.PI, 0],
    });

    // Upper deck windows
    if (i % 2 === 0) {
      windows.push({
        position: [x, 8, 3.3],
        rotation: [0, 0, 0],
      });
      windows.push({
        position: [x, 8, -3.3],
        rotation: [0, Math.PI, 0],
      });
    }
  }

  return windows;
}

/**
 * Generate detail panels for structures
 */
export function generateDetailPanels(
  width: number,
  height: number,
  panelSize: number = 2
): Array<{ position: [number, number, number]; size: [number, number] }> {
  const panels: Array<{
    position: [number, number, number];
    size: [number, number];
  }> = [];
  const cols = Math.floor(width / panelSize);
  const rows = Math.floor(height / panelSize);

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = -width / 2 + col * panelSize + panelSize / 2;
      const y = -height / 2 + row * panelSize + panelSize / 2;

      // Add some variation
      const sizeVariation = 0.9 + Math.random() * 0.2;

      panels.push({
        position: [x, y, 0],
        size: [panelSize * sizeVariation, panelSize * sizeVariation],
      });
    }
  }

  return panels;
}

/**
 * Generate rivet positions for metal structures
 */
export function generateRivets(
  width: number,
  height: number,
  spacing: number = 1
): Array<[number, number, number]> {
  const rivets: Array<[number, number, number]> = [];
  const cols = Math.floor(width / spacing);
  const rows = Math.floor(height / spacing);

  for (let row = 0; row <= rows; row++) {
    for (let col = 0; col <= cols; col++) {
      const x = -width / 2 + col * spacing;
      const y = -height / 2 + row * spacing;
      rivets.push([x, y, 0.05]);
    }
  }

  return rivets;
}

/**
 * Create a seeded random number generator for consistent procedural generation
 */
export class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  next(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }

  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }
}

/**
 * Generate varied structure instances with procedural differences
 */
export function generateStructureVariation(
  baseScale: number,
  seed: number
): {
  scale: number;
  colorVariation: number;
  detailLevel: number;
} {
  const rng = new SeededRandom(seed);

  return {
    scale: baseScale * rng.range(0.9, 1.1),
    colorVariation: rng.range(-0.1, 0.1),
    detailLevel: rng.range(0.8, 1.2),
  };
}
