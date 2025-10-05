// Nebula Skybox Fragment Shader
// Creates volumetric nebula clouds with color variation

uniform float time;
varying vec3 vWorldPosition;

// 3D noise function (simplified Perlin-like noise)
float noise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  
  float n = i.x + i.y * 57.0 + i.z * 113.0;
  return mix(
    mix(
      mix(fract(sin(n) * 43758.5453), fract(sin(n + 1.0) * 43758.5453), f.x),
      mix(fract(sin(n + 57.0) * 43758.5453), fract(sin(n + 58.0) * 43758.5453), f.x),
      f.y
    ),
    mix(
      mix(fract(sin(n + 113.0) * 43758.5453), fract(sin(n + 114.0) * 43758.5453), f.x),
      mix(fract(sin(n + 170.0) * 43758.5453), fract(sin(n + 171.0) * 43758.5453), f.x),
      f.y
    ),
    f.z
  );
}

void main() {
  vec3 direction = normalize(vWorldPosition);
  
  // Multi-octave noise for volumetric clouds
  float n = 0.0;
  n += noise(direction * 2.0 + time * 0.05) * 0.5;
  n += noise(direction * 4.0 + time * 0.1) * 0.25;
  n += noise(direction * 8.0 + time * 0.15) * 0.125;
  
  // Color gradient (pink to purple to blue)
  vec3 color1 = vec3(0.8, 0.2, 0.5); // Pink
  vec3 color2 = vec3(0.4, 0.1, 0.8); // Purple
  vec3 color3 = vec3(0.1, 0.3, 0.9); // Blue
  
  vec3 color = mix(color1, color2, n);
  color = mix(color, color3, n * n);
  
  // Add some brightness variation
  color *= 0.5 + n * 0.5;
  
  gl_FragColor = vec4(color, 1.0);
}
