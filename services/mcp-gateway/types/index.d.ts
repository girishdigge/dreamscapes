// types/index.d.ts
// TypeScript definitions for enhanced MCP Gateway

import { EventEmitter } from 'events';

export interface DreamRequest {
  text: string;
  style?: string;
  quality?: 'draft' | 'standard' | 'high' | 'cinematic';
  context?: {
    previousDreams?: any[];
    userPreferences?: Record<string, any>;
    sessionContext?: Record<string, any>;
  };
  options?: {
    streaming?: boolean;
    maxTokens?: number;
    temperature?: number;
    providers?: string[];
    fallbackEnabled?: boolean;
  };
}

export interface DreamResponse {
  success: boolean;
  data?: {
    id: string;
    title: string;
    description: string;
    scenes: SceneData[];
    cinematography: {
      shots: CameraShot[];
      transitions: Transition[];
      effects: Effect[];
      duration: number;
    };
    style: {
      visual: Record<string, any>;
      audio: Record<string, any>;
      mood: Record<string, any>;
    };
  };
  metadata?: {
    source: string;
    model: string;
    processingTime: number;
    quality: string;
    tokens: {
      input: number;
      output: number;
      total: number;
    };
    confidence: number;
    cacheHit: boolean;
  };
  error?: string;
}

export interface SceneData {
  id: string;
  description: string;
  objects: any[];
  lighting: Record<string, any>;
  camera: Record<string, any>;
}

export interface CameraShot {
  type: string;
  duration: number;
  position: Record<string, number>;
  target: Record<string, number>;
}

export interface Transition {
  type: string;
  duration: number;
  easing: string;
}

export interface Effect {
  type: string;
  intensity: number;
  duration?: number;
}

export interface ProviderConfig {
  enabled: boolean;
  priority: number;
  limits: {
    requestsPerMinute: number;
    tokensPerMinute: number;
    maxConcurrent: number;
  };
  fallback: {
    enabled: boolean;
    retryAttempts: number;
    backoffMultiplier: number;
  };
}

export interface CerebrasConfig extends ProviderConfig {
  sdk: {
    apiKey: string;
    model: string;
    streaming: boolean;
    maxTokens: number;
    temperature: number;
    topP: number;
  };
}

export interface ProviderMetrics {
  requests: number;
  successes: number;
  failures: number;
  avgResponseTime: number;
  lastHealthCheck: Date | null;
  successRate: number;
  isHealthy: boolean;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  repaired?: boolean;
}

export interface CacheOptions {
  ttl?: number;
  tags?: string[];
  quality?: string;
}

export abstract class BaseProvider {
  constructor(config: ProviderConfig);
  abstract generateDream(prompt: string, options?: any): Promise<DreamResponse>;
  abstract testConnection(): Promise<boolean>;
  healthCheck(): Promise<boolean>;
  updateMetrics(success: boolean, responseTime: number): void;
  getMetrics(): ProviderMetrics;
}

// Enhanced Provider Manager interfaces
export interface ProviderSelectionRequirements {
  providers?: string[];
  excludeProviders?: string[];
  loadBalancing?:
    | 'round-robin'
    | 'weighted'
    | 'least-connections'
    | 'response-time';
  timeout?: number;
  maxAttempts?: number;
}

export interface ProviderInfo {
  name: string;
  provider: BaseProvider;
  config: ProviderConfig;
  score: number;
}

export interface HealthCheckResult {
  isHealthy: boolean;
  responseTime?: number;
  timestamp: Date;
  error?: string;
}

export interface CircuitBreakerState {
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  failures: number;
  lastFailureTime: Date | null;
  successCount: number;
}

export interface EnhancedProviderMetrics extends ProviderMetrics {
  successRate: number;
  failureRate: number;
  consecutiveFailures: number;
  enabled: boolean;
  priority: number;
  rateLimitHits: number;
  circuitBreakerTrips: number;
  totalResponseTime: number;
  lastRequestTime: Date | null;
}

export interface LoadBalancerOptions {
  algorithm?:
    | 'round-robin'
    | 'weighted'
    | 'least-connections'
    | 'response-time';
}

export interface CircuitBreakerOptions {
  threshold?: number;
  timeout?: number;
}

export interface ProviderManagerConfig {
  healthCheckInterval?: number;
  maxRetryAttempts?: number;
  backoffMultiplier?: number;
  circuitBreakerThreshold?: number;
  circuitBreakerTimeout?: number;
}

export class ProviderManager extends EventEmitter {
  constructor(config?: ProviderManagerConfig);

  // Provider registration
  registerProvider(
    name: string,
    provider: BaseProvider,
    config?: ProviderConfig
  ): void;
  unregisterProvider(name: string): void;
  getProviders(): string[];

  // Provider selection and execution
  selectProvider(
    requirements?: ProviderSelectionRequirements
  ): Promise<ProviderInfo>;
  executeWithFallback(
    operation: (provider: BaseProvider, name: string) => Promise<any>,
    providers?: string[] | null,
    options?: { maxAttempts?: number; timeout?: number }
  ): Promise<any>;

  // Health monitoring
  healthCheck(
    providerName?: string
  ): Promise<HealthCheckResult | Record<string, HealthCheckResult>>;
  getProviderMetrics(
    providerName?: string
  ): EnhancedProviderMetrics | Record<string, EnhancedProviderMetrics>;
  getAvailableProviders(): Array<{
    name: string;
    provider: BaseProvider;
    config: ProviderConfig;
    health: any;
    metrics: any;
    score: number;
  }>;

  // Lifecycle
  startHealthMonitoring(): void;
  stopHealthMonitoring(): void;
  destroy(): void;

  // Events
  on(
    event: 'providerRegistered',
    listener: (data: { name: string; config: ProviderConfig }) => void
  ): this;
  on(
    event: 'providerUnregistered',
    listener: (data: { name: string }) => void
  ): this;
  on(
    event: 'providerSelected',
    listener: (data: { name: string; requirements: any; score: number }) => void
  ): this;
  on(
    event: 'operationSuccess',
    listener: (data: {
      provider: string;
      responseTime: number;
      totalTime: number;
      attempts: number;
    }) => void
  ): this;
  on(
    event: 'operationFailure',
    listener: (data: {
      provider: string;
      error: string;
      responseTime: number;
      attempts: number;
    }) => void
  ): this;
  on(
    event: 'allProvidersFailed',
    listener: (data: {
      attempts: number;
      totalTime: number;
      lastError: string;
    }) => void
  ): this;
  on(
    event: 'healthCheckPassed',
    listener: (data: { provider: string; responseTime: number }) => void
  ): this;
  on(
    event: 'healthCheckFailed',
    listener: (data: { provider: string; error: string }) => void
  ): this;
}

export class LoadBalancer {
  constructor();
  selectProvider(
    providers: any[],
    requirements?: ProviderSelectionRequirements
  ): any;
}

export class CircuitBreaker {
  constructor(name: string, options?: CircuitBreakerOptions);
  canExecute(): boolean;
  recordSuccess(): void;
  recordFailure(): void;
  getState(): CircuitBreakerState;
}

export class PromptEngine {
  buildDreamPrompt(text: string, style?: string, context?: any): string;
  buildVideoPrompt(sceneData: SceneData[], quality?: string): string;
  buildRefinementPrompt(content: string, feedback: string): string;
  getTemplate(type: string, style?: string): string;
}

export class ValidationPipeline {
  validateResponse(content: any, schema?: any): Promise<ValidationResult>;
  repairContent(content: any, errors: string[]): Promise<any>;
  qualityCheck(content: any, requirements?: any): Promise<ValidationResult>;
  getValidationMetrics(): Record<string, any>;
}

export class ResponseCache {
  get(key: string, options?: CacheOptions): Promise<any>;
  set(key: string, value: any, ttl?: number): Promise<void>;
  invalidate(pattern: string): Promise<void>;
  getStats(): Record<string, any>;
}
