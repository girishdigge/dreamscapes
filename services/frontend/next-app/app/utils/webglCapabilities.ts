// services/frontend/next-app/app/utils/webglCapabilities.ts

/**
 * WebGL Capabilities Detection
 *
 * Detects browser WebGL capabilities and provides feature detection
 * for graceful degradation of unsupported features.
 *
 * Requirements: 6.9 - Graceful degradation for unsupported features
 */

export interface WebGLCapabilities {
  webgl2: boolean;
  webgl1: boolean;
  maxTextureSize: number;
  maxVertexUniforms: number;
  maxFragmentUniforms: number;
  floatTextures: boolean;
  depthTexture: boolean;
  standardDerivatives: boolean;
  textureFilterAnisotropic: boolean;
  maxAnisotropy: number;
  instancedArrays: boolean;
  vertexArrayObject: boolean;
  multipleRenderTargets: boolean;
  colorBufferFloat: boolean;
  shaderTextureLOD: boolean;
}

export interface FeatureSupport {
  postProcessing: boolean;
  depthOfField: boolean;
  bloom: boolean;
  shadows: boolean;
  highQualityShadows: boolean;
  instancedRendering: boolean;
  floatTextures: boolean;
  antialiasing: boolean;
}

let cachedCapabilities: WebGLCapabilities | null = null;
let cachedFeatureSupport: FeatureSupport | null = null;

/**
 * Detect WebGL capabilities
 */
export function detectWebGLCapabilities(): WebGLCapabilities {
  if (cachedCapabilities) {
    return cachedCapabilities;
  }

  // Create temporary canvas for testing
  const canvas = document.createElement('canvas');
  const gl2 = canvas.getContext('webgl2') as WebGL2RenderingContext | null;
  const gl = (gl2 ||
    canvas.getContext('webgl') ||
    canvas.getContext('experimental-webgl')) as
    | WebGLRenderingContext
    | WebGL2RenderingContext
    | null;

  if (!gl) {
    console.error('WebGL not supported');
    return {
      webgl2: false,
      webgl1: false,
      maxTextureSize: 0,
      maxVertexUniforms: 0,
      maxFragmentUniforms: 0,
      floatTextures: false,
      depthTexture: false,
      standardDerivatives: false,
      textureFilterAnisotropic: false,
      maxAnisotropy: 0,
      instancedArrays: false,
      vertexArrayObject: false,
      multipleRenderTargets: false,
      colorBufferFloat: false,
      shaderTextureLOD: false,
    };
  }

  // Detect extensions
  const extAniso =
    gl.getExtension('EXT_texture_filter_anisotropic') ||
    gl.getExtension('WEBKIT_EXT_texture_filter_anisotropic');
  const extFloat = gl.getExtension('OES_texture_float');
  const extDepth = gl.getExtension('WEBGL_depth_texture');
  const extDerivatives = gl.getExtension('OES_standard_derivatives');
  const extInstanced = gl.getExtension('ANGLE_instanced_arrays');
  const extVAO = gl.getExtension('OES_vertex_array_object');
  const extDrawBuffers = gl.getExtension('WEBGL_draw_buffers');
  const extColorBufferFloat =
    gl.getExtension('EXT_color_buffer_float') ||
    gl.getExtension('WEBGL_color_buffer_float');
  const extShaderTextureLOD = gl.getExtension('EXT_shader_texture_lod');

  cachedCapabilities = {
    webgl2: !!gl2,
    webgl1: !!gl && !gl2,
    maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE) || 0,
    maxVertexUniforms: gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS) || 0,
    maxFragmentUniforms: gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS) || 0,
    floatTextures: !!extFloat || !!gl2,
    depthTexture: !!extDepth || !!gl2,
    standardDerivatives: !!extDerivatives || !!gl2,
    textureFilterAnisotropic: !!extAniso,
    maxAnisotropy: extAniso
      ? gl.getParameter(extAniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT)
      : 0,
    instancedArrays: !!extInstanced || !!gl2,
    vertexArrayObject: !!extVAO || !!gl2,
    multipleRenderTargets: !!extDrawBuffers || !!gl2,
    colorBufferFloat: !!extColorBufferFloat || !!gl2,
    shaderTextureLOD: !!extShaderTextureLOD || !!gl2,
  };

  return cachedCapabilities;
}

/**
 * Determine which features are supported based on capabilities
 */
export function getFeatureSupport(
  capabilities?: WebGLCapabilities
): FeatureSupport {
  if (cachedFeatureSupport) {
    return cachedFeatureSupport;
  }

  const caps = capabilities || detectWebGLCapabilities();

  cachedFeatureSupport = {
    // Post-processing requires float textures and MRT
    postProcessing: caps.floatTextures && caps.multipleRenderTargets,

    // Depth of field requires depth texture support
    depthOfField: caps.depthTexture && caps.floatTextures,

    // Bloom requires float textures
    bloom: caps.floatTextures,

    // Basic shadows require depth texture
    shadows: caps.depthTexture,

    // High quality shadows require larger texture sizes
    highQualityShadows: caps.depthTexture && caps.maxTextureSize >= 4096,

    // Instanced rendering for particles
    instancedRendering: caps.instancedArrays,

    // Float textures for HDR rendering
    floatTextures: caps.floatTextures,

    // Antialiasing support
    antialiasing: caps.webgl2 || caps.standardDerivatives,
  };

  return cachedFeatureSupport;
}

/**
 * Get recommended quality preset based on capabilities
 */
export function getRecommendedQuality(
  capabilities?: WebGLCapabilities
): 'draft' | 'medium' | 'high' {
  const caps = capabilities || detectWebGLCapabilities();
  const features = getFeatureSupport(caps);

  // High quality: WebGL2 with all features
  if (caps.webgl2 && features.postProcessing && features.highQualityShadows) {
    return 'high';
  }

  // Medium quality: WebGL1 with most features
  if (features.postProcessing && features.shadows) {
    return 'medium';
  }

  // Draft quality: Limited features
  return 'draft';
}

/**
 * Get user-friendly warning messages for missing features
 */
export function getCapabilityWarnings(
  capabilities?: WebGLCapabilities
): string[] {
  const caps = capabilities || detectWebGLCapabilities();
  const features = getFeatureSupport(caps);
  const warnings: string[] = [];

  if (!caps.webgl2 && !caps.webgl1) {
    warnings.push(
      'WebGL is not supported in your browser. 3D rendering will not work.'
    );
    return warnings;
  }

  if (!caps.webgl2) {
    warnings.push(
      'WebGL 2.0 is not supported. Some advanced features may be disabled.'
    );
  }

  if (!features.postProcessing) {
    warnings.push(
      'Post-processing effects (bloom, depth of field) are not supported.'
    );
  }

  if (!features.depthOfField) {
    warnings.push('Depth of field effect is not supported.');
  }

  if (!features.shadows) {
    warnings.push('Shadow rendering is not supported.');
  }

  if (!features.highQualityShadows && features.shadows) {
    warnings.push(
      'High quality shadows are not supported. Using lower resolution shadows.'
    );
  }

  if (!features.instancedRendering) {
    warnings.push(
      'Instanced rendering is not supported. Particle performance may be reduced.'
    );
  }

  if (caps.maxTextureSize < 2048) {
    warnings.push(
      `Maximum texture size is ${caps.maxTextureSize}. Some textures may be lower quality.`
    );
  }

  return warnings;
}

/**
 * Log capabilities to console for debugging
 */
export function logCapabilities(capabilities?: WebGLCapabilities): void {
  const caps = capabilities || detectWebGLCapabilities();
  const features = getFeatureSupport(caps);
  const warnings = getCapabilityWarnings(caps);

  console.group('🎮 WebGL Capabilities');
  console.log(
    'WebGL Version:',
    caps.webgl2 ? '2.0' : caps.webgl1 ? '1.0' : 'Not Supported'
  );
  console.log('Max Texture Size:', caps.maxTextureSize);
  console.log('Max Vertex Uniforms:', caps.maxVertexUniforms);
  console.log('Max Fragment Uniforms:', caps.maxFragmentUniforms);
  console.log('Float Textures:', caps.floatTextures ? '✓' : '✗');
  console.log('Depth Texture:', caps.depthTexture ? '✓' : '✗');
  console.log('Instanced Arrays:', caps.instancedArrays ? '✓' : '✗');
  console.log(
    'Multiple Render Targets:',
    caps.multipleRenderTargets ? '✓' : '✗'
  );
  console.groupEnd();

  console.group('✨ Feature Support');
  console.log('Post-Processing:', features.postProcessing ? '✓' : '✗');
  console.log('Depth of Field:', features.depthOfField ? '✓' : '✗');
  console.log('Bloom:', features.bloom ? '✓' : '✗');
  console.log('Shadows:', features.shadows ? '✓' : '✗');
  console.log('High Quality Shadows:', features.highQualityShadows ? '✓' : '✗');
  console.log('Instanced Rendering:', features.instancedRendering ? '✓' : '✗');
  console.groupEnd();

  if (warnings.length > 0) {
    console.group('⚠️ Warnings');
    warnings.forEach((warning) => console.warn(warning));
    console.groupEnd();
  }

  console.log('Recommended Quality:', getRecommendedQuality(caps));
}
