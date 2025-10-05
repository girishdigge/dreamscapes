// Water Surface Fragment Shader
// Creates water appearance with reflection and refraction

uniform float time;
uniform vec3 waterColor;
varying vec3 vNormal;
varying vec3 vPosition;

void main() {
  // Fresnel effect (more reflective at grazing angles)
  vec3 viewDirection = normalize(cameraPosition - vPosition);
  float fresnel = pow(1.0 - dot(viewDirection, vNormal), 3.0);
  
  // Base water color
  vec3 color = waterColor;
  
  // Add some shimmer
  float shimmer = sin(vPosition.x * 0.5 + time * 2.0) * cos(vPosition.y * 0.5 + time * 2.0);
  shimmer = shimmer * 0.1 + 0.9;
  
  // Mix with white for highlights
  color = mix(color, vec3(1.0), fresnel * 0.3);
  color *= shimmer;
  
  gl_FragColor = vec4(color, 0.8);
}
