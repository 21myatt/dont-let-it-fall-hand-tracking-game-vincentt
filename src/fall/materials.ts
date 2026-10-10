// One procedural shader per object kind, sharing a lighting core: a soft key
// light, a sky/ground fake environment, a fresnel rim, and per-kind surface.
// Each kind reads differently at a glance — same sphere, different material.
import { Color, ShaderMaterial } from "three";

import { KINDS, type Kind } from "./config";

const vert = /* glsl */ `
varying vec3 vN;
varying vec3 vWorld;
varying vec3 vLocal;
void main() {
  vLocal = position;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const frag = /* glsl */ `
uniform vec3 uColor;
uniform float uTime;
uniform float uFlash;
uniform float uOpacity;
varying vec3 vN;
varying vec3 vWorld;
varying vec3 vLocal;

vec3 hsv2rgb(vec3 c) {
  vec3 p = abs(fract(c.xxx + vec3(0.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0);
  return c.z * mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), c.y);
}

void main() {
  vec3 N = normalize(vN);
  vec3 V = normalize(cameraPosition - vWorld);
  vec3 L = normalize(vec3(-0.45, 0.85, 0.55));
  float ndl = max(dot(N, L), 0.0);
  float fres = pow(1.0 - max(dot(N, V), 0.0), 2.5);
  vec3 R = reflect(-V, N);
  // Fake environment: warm sky above, cool ground below.
  vec3 env = mix(vec3(0.18, 0.2, 0.28), vec3(1.0, 0.96, 0.9), smoothstep(-0.3, 0.6, R.y));
  float spec = pow(max(dot(R, L), 0.0), 40.0);
  vec3 col;

  #if defined(KIND_BALL)
    // Soft toon: two bands, warm top, a gentle rim.
    float band = smoothstep(0.25, 0.32, ndl) * 0.35 + smoothstep(0.62, 0.7, ndl) * 0.25;
    col = uColor * (0.58 + band) + vec3(1.0, 0.85, 0.75) * fres * 0.35 + vec3(spec) * 0.5;
  #elif defined(KIND_HEAVY)
    // Dark steel: mostly reflection, hard highlight.
    col = uColor * (0.25 + 0.35 * ndl) + env * 0.55 * (0.3 + fres) + vec3(pow(max(dot(R, L), 0.0), 90.0)) * 1.2;
  #elif defined(KIND_FAST)
    // Electric: animated diagonal stripes glowing through.
    float stripes = smoothstep(0.35, 0.5, sin((vLocal.x + vLocal.y) * 18.0 - uTime * 12.0));
    col = uColor * (0.35 + 0.5 * ndl) + uColor * stripes * 0.9 + vec3(0.6, 1.0, 1.0) * fres * 0.8 + vec3(spec);
  #elif defined(KIND_BOUNCY)
    // Rainbow, cycling over the surface.
    vec3 rb = hsv2rgb(vec3(fract(vLocal.y * 0.6 + vLocal.x * 0.25 + uTime * 0.25), 0.62, 1.0));
    col = rb * (0.45 + 0.55 * ndl) + vec3(spec) * 0.9 + vec3(1.0) * fres * 0.3;
  #elif defined(KIND_GOLD)
    // Polished gold with a twinkle.
    vec3 gold = vec3(1.0, 0.78, 0.25);
    col = gold * (0.3 + 0.4 * ndl) + gold * env * 0.7 + vec3(pow(max(dot(R, L), 0.0), 60.0)) * 1.4;
    col += vec3(1.0, 0.95, 0.7) * pow(max(0.0, sin(uTime * 6.0 + vLocal.x * 30.0)), 30.0) * 0.6;
  #elif defined(KIND_SLOWMO)
    // Frosted ice: strong fresnel, inner swirl.
    float swirl = 0.5 + 0.5 * sin(atan(vLocal.y, vLocal.x) * 3.0 + uTime * 1.5 + length(vLocal.xy) * 8.0);
    col = mix(uColor * 0.55, vec3(0.92, 0.98, 1.0), fres) + uColor * swirl * 0.25 + vec3(spec) * 0.8;
  #elif defined(KIND_BOMB)
    // Matte black with a pulsing red core showing at the edges.
    float pulse = 0.5 + 0.5 * sin(uTime * 7.0);
    col = uColor * (0.35 + 0.4 * ndl) + vec3(1.0, 0.15, 0.1) * fres * (0.6 + 0.9 * pulse) + vec3(spec) * 0.35;
  #else
    col = uColor;
  #endif

  col += vec3(1.0) * uFlash;
  gl_FragColor = vec4(col, uOpacity);
  #include <colorspace_fragment>
}
`;

export const makeMaterial = (kind: Kind) =>
  new ShaderMaterial({
    vertexShader: vert,
    fragmentShader: frag,
    defines: { [`KIND_${kind.toUpperCase()}`]: "" },
    uniforms: {
      uColor: { value: new Color(KINDS[kind].color) },
      uTime: { value: 0 },
      uFlash: { value: 0 },
      uOpacity: { value: 1 },
    },
    transparent: true,
  });
