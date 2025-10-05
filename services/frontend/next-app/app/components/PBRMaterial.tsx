// Wrapper component for MeshStandardMaterial with PBR properties
// This bypasses React Three Fiber's incomplete TypeScript definitions
import React from 'react';

interface PBRMaterialProps {
  color?: string;
  metalness?: number;
  roughness?: number;
  opacity?: number;
  transparent?: boolean;
  emissive?: string;
  emissiveIntensity?: number;
  envMapIntensity?: number;
  // Enhanced PBR properties
  clearcoat?: number;
  clearcoatRoughness?: number;
  transmission?: number;
  ior?: number;
  thickness?: number;
  [key: string]: any;
}

export function PBRMaterial(props: PBRMaterialProps) {
  // @ts-expect-error - R3F types don't include all PBR properties
  return <meshStandardMaterial {...props} />;
}
