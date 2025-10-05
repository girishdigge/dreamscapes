// Galaxy Skybox Fragment Shader
// Creates spiral galaxy with stars and nebula clouds

uniform float time;
varying vec3 vWorldPosition;

// Pseudo-random function
float random(vec2 st) {
  return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
}

void main() {
  vec3 direction = normalize(vWorldPosition);
  float angle = atan(direction.x, direction.z);
  float radius = length(direction.xz);
  
  // Spiral arms pattern
  float spiral = sin(angle * 3.0 + radius * 10.0 + time * 0.1) * 0.5 + 0.5;
  
  // Star field
  vec2 starCoord = direction.xy * 100.0;
  float stars = step(0.99, random(floor(starCoord)));
  
  // Nebula base color (purple/blue gradient)
  vec3 nebulaColor = mix(vec3(0.1, 0.05, 0.2), vec3(0.8, 0.4, 0.9), spiral * 0.3);
  
  // Add stars
  vec3 color = nebulaColor + stars * vec3(1.0, 0.9, 0.8);
  
  gl_FragColor = vec4(color, 1.0);
}
