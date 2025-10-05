// Material presets for common PBR materials
import { Material } from '../types/dream';

export type MaterialPresetName =
  | 'chrome'
  | 'glass'
  | 'stone'
  | 'wood'
  | 'plastic'
  | 'metal'
  | 'fabric'
  | 'ceramic'
  | 'crystal';

export const materialPresets: Record<MaterialPresetName, Partial<Material>> = {
  chrome: {
    metalness: 1.0,
    roughness: 0.1,
    envMapIntensity: 1.5,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
  },
  glass: {
    metalness: 0.0,
    roughness: 0.0,
    transmission: 1.0,
    opacity: 1.0,
    ior: 1.5,
    thickness: 0.5,
    envMapIntensity: 1.0,
    clearcoat: 1.0,
    clearcoatRoughness: 0.0,
  },
  stone: {
    metalness: 0.0,
    roughness: 0.9,
    envMapIntensity: 0.2,
  },
  wood: {
    metalness: 0.0,
    roughness: 0.7,
    envMapIntensity: 0.3,
  },
  plastic: {
    metalness: 0.0,
    roughness: 0.4,
    envMapIntensity: 0.5,
    clearcoat: 0.3,
    clearcoatRoughness: 0.2,
  },
  metal: {
    metalness: 1.0,
    roughness: 0.3,
    envMapIntensity: 1.0,
  },
  fabric: {
    metalness: 0.0,
    roughness: 0.8,
    sheen: 0.5,
    sheenRoughness: 0.5,
    envMapIntensity: 0.1,
  },
  ceramic: {
    metalness: 0.0,
    roughness: 0.2,
    clearcoat: 0.8,
    clearcoatRoughness: 0.1,
    envMapIntensity: 0.6,
  },
  crystal: {
    metalness: 0.0,
    roughness: 0.0,
    transmission: 0.9,
    opacity: 1.0,
    ior: 2.0,
    thickness: 1.0,
    envMapIntensity: 1.5,
    clearcoat: 1.0,
    clearcoatRoughness: 0.0,
  },
};

/**
 * Apply a material preset to a base material
 */
export function applyMaterialPreset(
  baseMaterial: Partial<Material>,
  presetName: MaterialPresetName
): Material {
  const preset = materialPresets[presetName];
  return {
    ...preset,
    ...baseMaterial, // Base material overrides preset
  };
}

/**
 * Get material preset by name, with fallback
 */
export function getMaterialPreset(
  presetName?: string
): Partial<Material> | undefined {
  if (!presetName) return undefined;
  return materialPresets[presetName as MaterialPresetName];
}
