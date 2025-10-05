/**
 * Engine Module Exports
 * Aggregates all engine modules for easy importing
 *
 * Note: In browser environment, these are loaded via script tags
 * and attached to window object. This file serves as documentation
 * and potential future module bundling.
 */

// This file is primarily for documentation purposes
// In the browser template, modules are loaded via script tags:
// <script src="engine/SceneRenderer.js"></script>
// <script src="engine/AssetLibrary.js"></script>
// etc.

// For Node.js environments (if needed for testing):
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    // Modules will be available after implementation
    // SceneRenderer: require('./SceneRenderer'),
    // AssetLibrary: require('./AssetLibrary'),
    // MaterialSystem: require('./MaterialSystem'),
    // AnimationController: require('./AnimationController'),
    // CameraController: require('./CameraController')
  };
}
