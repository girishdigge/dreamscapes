// Dream-related TypeScript interfaces

export interface DreamEnvironment {
  preset?: string;
  skyColor?: string;
  fog?: number;
  ambientLight?: number;
  skybox?: string;
  lighting?: {
    ambient?: number;
    directional?: {
      intensity?: number;
      position?: [number, number, number];
      color?: string;
    };
  };
}

export interface DreamRenderConfig {
  res?: [number, number];
  fps?: number;
  quality?: 'draft' | 'medium' | 'high' | 'low';
  qualityPreset?: 'cinematic' | 'balanced' | 'performance' | 'custom';
  customQuality?: {
    shadows?: boolean;
    shadowQuality?: 'low' | 'medium' | 'high';
    geometryDetail?: 'low' | 'medium' | 'high';
    postProcessing?: boolean;
    particleMultiplier?: number; // 0.5-2.0
    adaptiveQuality?: boolean; // Auto-adjust based on FPS
  };
}

// New camera schema
export interface CameraShot {
  startTime: number;
  duration: number;
  position: [number, number, number];
  target?: string; // Structure ID to track dynamically
  lookAt?: [number, number, number]; // Static position
  fov: number;
  movement:
    | 'static'
    | 'establish'
    | 'orbit'
    | 'flythrough'
    | 'close_up'
    | 'pull_back'
    | 'dolly_in'
    | 'tracking'
    | 'cinematic_pan'
    | 'crane'
    | 'handheld';
  easing: string;
  transition: string;
}

// Legacy cinematography (for backward compatibility)
export interface DreamCinematographyShot {
  type: string;
  target?: string;
  duration: number;
  startPos?: [number, number, number];
  endPos?: [number, number, number];
}

export interface DreamCinematography {
  durationSec: number;
  shots: DreamCinematographyShot[];
}

// Motion definitions
export interface Motion {
  type:
    | 'move_to'
    | 'move_along'
    | 'swarm'
    | 'wander'
    | 'trail'
    | 'flow_between'
    | 'expand';
  duration?: number;
  easing?: string;
  to?: [number, number, number];
  path?: [number, number, number][];
  center?: [number, number, number];
  radius?: number;
  frequency?: number;
  targets?: string[];
  attachTo?: string; // Structure ID to attach to
  offset?: [number, number, number]; // Local coordinates relative to attached structure
  from?: number;
  behaviors?: any[];
}

// Animation definitions
export interface Animation {
  type: 'scale' | 'rotate' | 'orbit';
  from: number;
  to: number;
  duration: number;
  easing: string;
  speed?: number;
  amplitude?: number;
}

// Material definitions
export interface Material {
  color?: string;
  emissive?: string;
  emissiveIntensity?: number;
  metalness?: number;
  roughness?: number;
  opacity?: number;
  transmission?: number;
  type?: string;
  // Enhanced PBR properties
  clearcoat?: number; // 0-1, adds glossy layer on top (car paint effect)
  clearcoatRoughness?: number; // 0-1, roughness of clearcoat layer
  envMapIntensity?: number; // 0-1+, strength of environment reflections
  ior?: number; // Index of refraction for glass/transparent materials (1.0-2.333)
  thickness?: number; // Thickness for transmission/subsurface scattering
  attenuationColor?: string; // Color tint for light passing through transparent materials
  attenuationDistance?: number; // How far light travels before being fully absorbed
  sheen?: number; // 0-1, fabric-like sheen effect
  sheenRoughness?: number; // 0-1, roughness of sheen
  sheenColor?: string; // Color of sheen effect
  specularIntensity?: number; // 0-1, intensity of specular reflections
  specularColor?: string; // Color of specular reflections
}

export interface DreamStructure {
  id: string;
  type?: string; // New schema uses 'type' instead of 'template'
  template?: string; // Legacy support
  pos?: [number, number, number];
  scale?: number;
  rotation?: [number, number, number];
  features?: string[];
  motion?: Motion;
  animation?: Animation;
  material?: Material;
}

export interface DreamEntity {
  id: string;
  type: string;
  pos?: [number, number, number];
  count?: number;
  params?: {
    speed?: number;
    glow?: number;
    size?: number;
    color?: string;
    [key: string]: any;
  };
  motion?: Motion;
}

// Event definitions
export interface DreamEvent {
  timeSec: number;
  type: 'explosion' | 'spawn_entity' | 'environment_change';
  targets?: string[];
  particleCount?: number;
  lightFlash?: boolean;
  cameraShake?: {
    amplitude: number;
    duration: number;
  };
  entityId?: string;
  params?: any;
}

export interface Dream {
  id?: string;
  title?: string;
  style: string;
  created?: string;
  source?: string;
  environment?: DreamEnvironment;
  render?: DreamRenderConfig;
  cinematography?: DreamCinematography; // Legacy support
  camera?: CameraShot[]; // New schema
  structures?: DreamStructure[];
  entities?: DreamEntity[];
  events?: DreamEvent[];
  metadata?: {
    seed?: number;
    originalText?: string;
    requestedStyle?: string;
    version?: string;
  };
}
