// Dream-related TypeScript interfaces

export interface DreamEnvironment {
  preset?: string;
  skyColor?: string;
  fog?: number;
  ambientLight?: number;
}

export interface DreamRenderConfig {
  res?: [number, number];
  fps?: number;
  quality?: 'draft' | 'medium' | 'high';
}

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

export interface DreamStructure {
  id: string;
  template: string;
  pos?: [number, number, number];
  scale?: number;
  rotation?: [number, number, number];
  features?: string[];
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
  };
}

export interface Dream {
  id?: string;
  style: string;
  environment?: DreamEnvironment;
  render?: DreamRenderConfig;
  cinematography?: DreamCinematography;
  structures?: DreamStructure[];
  entities?: DreamEntity[];
}
