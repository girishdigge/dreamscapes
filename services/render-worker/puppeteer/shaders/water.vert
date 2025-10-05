// Water Surface Vertex Shader
// Animates wave displacement and passes data to fragment shader

uniform float time;
varying vec3 vNormal;
varying vec3 vPosition;

void main() {
  vNormal = normalize(normalMatrix * normal);
  
  // Animated wave displacement
  vec3 pos = position;
  float wave = sin(pos.x * 0.1 + time) * cos(pos.y * 0.1 + time) * 2.0;
  pos.z += wave;
  
  vPosition = pos;
  
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
