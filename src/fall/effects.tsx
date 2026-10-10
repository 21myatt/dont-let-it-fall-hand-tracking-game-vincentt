// Visual effects, all pooled and allocation-free per frame: particles (trails,
// puffs, bursts, confetti), the ripple ring at the hand, screen shake, the stage
// dim, the palm pad and wind streaks. Components register on the `fx` bus.
import { useEffect, useMemo, useRef } from "react";
import { BufferAttribute, BufferGeometry, Color, type Mesh, NormalBlending, AdditiveBlending, ShaderMaterial, Vector3 } from "three";
import { useFrame, useThree } from "@react-three/fiber";

import { CATCH } from "./config";
import { hand } from "./hand";

export type EmitOptions = {
  x: number;
  y: number;
  count: number;
  colors: string[];
  speed: [number, number];
  /** Bias direction (radians) and spread; omit for all directions. */
  angle?: number;
  spread?: number;
  size?: [number, number];
  life?: [number, number];
  gravity?: number;
  drag?: number;
  additive?: boolean;
};

const noop = () => {};
export const fx = {
  emit: noop as (o: EmitOptions) => void,
  ripple: noop as (x: number, y: number, color: string, strength: number) => void,
  shake: noop as (amount: number) => void,
  pad: noop as (amount: number) => void,
};

// ─── Particles (two pools: soft normal-blended puffs, additive sparks) ──────

const MAX = 900;

const pVert = /* glsl */ `
attribute vec3 color;
attribute float size;
attribute float alpha;
varying vec3 vColor;
varying float vAlpha;
void main() {
  vColor = color;
  vAlpha = alpha;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = size * 950.0 / -mv.z;
  gl_Position = projectionMatrix * mv;
}
`;

const pFrag = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.15, d);
  gl_FragColor = vec4(vColor, a * vAlpha);
  #include <colorspace_fragment>
}
`;

type Pool = ReturnType<typeof makePool>;

const makePool = (additive: boolean) => {
  const g = new BufferGeometry();
  const position = new Float32Array(MAX * 3);
  const color = new Float32Array(MAX * 3);
  const size = new Float32Array(MAX);
  const alpha = new Float32Array(MAX);
  g.setAttribute("position", new BufferAttribute(position, 3));
  g.setAttribute("color", new BufferAttribute(color, 3));
  g.setAttribute("size", new BufferAttribute(size, 1));
  g.setAttribute("alpha", new BufferAttribute(alpha, 1));
  const material = new ShaderMaterial({
    vertexShader: pVert,
    fragmentShader: pFrag,
    transparent: true,
    depthWrite: false,
    blending: additive ? AdditiveBlending : NormalBlending,
  });
  return {
    geometry: g,
    material,
    position,
    color,
    size,
    alpha,
    vel: new Float32Array(MAX * 2),
    life: new Float32Array(MAX),
    max: new Float32Array(MAX),
    baseSize: new Float32Array(MAX),
    gravity: new Float32Array(MAX),
    drag: new Float32Array(MAX),
    cursor: 0,
  };
};

const stepPool = (p: Pool, dt: number) => {
  for (let i = 0; i < MAX; i++) {
    if (p.life[i] <= 0) {
      p.alpha[i] = 0;
      continue;
    }
    p.life[i] -= dt;
    const f = Math.exp(-p.drag[i] * dt);
    p.vel[i * 2] *= f;
    p.vel[i * 2 + 1] = p.vel[i * 2 + 1] * f - p.gravity[i] * dt;
    p.position[i * 3] += p.vel[i * 2] * dt;
    p.position[i * 3 + 1] += p.vel[i * 2 + 1] * dt;
    const k = Math.max(0, p.life[i] / p.max[i]);
    p.alpha[i] = k;
    p.size[i] = p.baseSize[i] * (0.4 + 0.6 * k);
  }
  p.geometry.attributes.position.needsUpdate = true;
  p.geometry.attributes.color.needsUpdate = true;
  p.geometry.attributes.size.needsUpdate = true;
  p.geometry.attributes.alpha.needsUpdate = true;
};

export const Particles = () => {
  const soft = useMemo(() => makePool(false), []);
  const glow = useMemo(() => makePool(true), []);

  useEffect(() => {
    const c = new Color();
    fx.emit = (o) => {
      const p = o.additive ? glow : soft;
      for (let n = 0; n < o.count; n++) {
        const i = p.cursor;
        p.cursor = (p.cursor + 1) % MAX;
        const a = o.angle === undefined ? Math.random() * Math.PI * 2 : o.angle + (Math.random() - 0.5) * (o.spread ?? 1);
        const sp = o.speed[0] + Math.random() * (o.speed[1] - o.speed[0]);
        p.position[i * 3] = o.x;
        p.position[i * 3 + 1] = o.y;
        p.position[i * 3 + 2] = 0.3 + Math.random() * 0.1;
        p.vel[i * 2] = Math.cos(a) * sp;
        p.vel[i * 2 + 1] = Math.sin(a) * sp;
        c.set(o.colors[n % o.colors.length]);
        p.color[i * 3] = c.r;
        p.color[i * 3 + 1] = c.g;
        p.color[i * 3 + 2] = c.b;
        const [s0, s1] = o.size ?? [0.05, 0.1];
        p.baseSize[i] = s0 + Math.random() * (s1 - s0);
        const [l0, l1] = o.life ?? [0.4, 0.8];
        p.life[i] = l0 + Math.random() * (l1 - l0);
        p.max[i] = p.life[i];
        p.gravity[i] = o.gravity ?? 0;
        p.drag[i] = o.drag ?? 1.5;
      }
    };
    return () => {
      fx.emit = noop;
    };
  }, [soft, glow]);

  useFrame((_s, rawDt) => {
    const dt = Math.min(rawDt, 1 / 30);
    stepPool(soft, dt);
    stepPool(glow, dt);
  });

  return (
    <>
      <points geometry={soft.geometry} material={soft.material} frustumCulled={false} renderOrder={20} />
      <points geometry={glow.geometry} material={glow.material} frustumCulled={false} renderOrder={21} />
    </>
  );
};

// ─── Ripple rings at the hand ────────────────────────────────────────────────

const RINGS = 6;

const ringVert = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;

const ringFrag = /* glsl */ `
uniform vec3 uColor;
uniform float uP;
varying vec2 vUv;
void main() {
  vec2 c = (vUv - 0.5) * vec2(2.0, 4.0); // a flat ellipse: a ripple on the palm plane
  float r = length(c);
  float w = 0.08 + 0.1 * (1.0 - uP);
  float ring = smoothstep(w, 0.0, abs(r - uP));
  gl_FragColor = vec4(uColor * 1.4, ring * (1.0 - uP) * (1.0 - uP));
}
`;

export const Ripples = () => {
  const meshes = useRef<(Mesh | null)[]>([]);
  const rings = useMemo(
    () =>
      Array.from({ length: RINGS }, () => ({
        t: 1,
        size: 1,
        material: new ShaderMaterial({
          uniforms: { uColor: { value: new Color() }, uP: { value: 1 } },
          vertexShader: ringVert,
          fragmentShader: ringFrag,
          transparent: true,
          depthWrite: false,
          blending: AdditiveBlending,
        }),
      })),
    [],
  );
  const cursor = useRef(0);
  const warm = useRef(3);

  useEffect(() => {
    fx.ripple = (x, y, color, strength) => {
      const i = cursor.current;
      cursor.current = (i + 1) % RINGS;
      const r = rings[i];
      r.t = 0;
      r.size = 0.9 + strength * 0.8;
      r.material.uniforms.uColor.value.set(color);
      meshes.current[i]?.position.set(x, y, 0.25);
    };
    return () => {
      fx.ripple = noop;
    };
  }, [rings]);

  useFrame((_s, dt) => {
    if (warm.current > 0) warm.current -= 1;
    rings.forEach((r, i) => {
      const m = meshes.current[i];
      if (!m) return;
      r.t = Math.min(1, r.t + dt / 0.55);
      r.material.uniforms.uP.value = 1 - (1 - r.t) ** 3;
      m.visible = r.t < 1 || warm.current > 0;
      m.scale.set(r.size, r.size, 1);
    });
  });

  return (
    <>
      {rings.map((r, i) => (
        <mesh
          // eslint-disable-next-line react/no-array-index-key
          key={i}
          ref={(m) => {
            meshes.current[i] = m;
          }}
          material={r.material}
          visible={false}
          renderOrder={15}
        >
          <planeGeometry args={[1, 1]} />
        </mesh>
      ))}
    </>
  );
};

// ─── Screen shake ────────────────────────────────────────────────────────────

export const CameraShake = () => {
  const { camera } = useThree();
  const amp = useRef(0);
  const base = useRef<Vector3 | null>(null);
  useEffect(() => {
    fx.shake = (a) => {
      amp.current = Math.min(0.22, amp.current + a);
    };
    return () => {
      fx.shake = noop;
    };
  }, []);
  useFrame((state, dt) => {
    if (!base.current) base.current = camera.position.clone();
    const t = state.clock.elapsedTime;
    const a = amp.current;
    camera.position.set(base.current.x + Math.sin(t * 73) * a, base.current.y + Math.sin(t * 61 + 1.7) * a, base.current.z);
    amp.current = Math.max(0, a - dt * (0.3 + a * 5));
  });
  return null;
};

// ─── Stage: light dim + vignette; tints blue in slow motion ──────────────────

const stageVert = ringVert;
const stageFrag = /* glsl */ `
uniform float uSlow;
varying vec2 vUv;
void main() {
  vec2 c = (vUv - 0.5) * vec2(0.85, 1.0);
  float v = smoothstep(0.25, 0.7, length(c));
  vec3 tint = mix(vec3(0.03, 0.04, 0.08), vec3(0.05, 0.16, 0.3), uSlow);
  gl_FragColor = vec4(tint, clamp(0.3 + v * 0.4 + uSlow * 0.15, 0.0, 0.85));
}
`;

export const stageState = { slow: 0 };

export const Stage = () => {
  const material = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: { uSlow: { value: 0 } },
        vertexShader: stageVert,
        fragmentShader: stageFrag,
        transparent: true,
        depthWrite: false,
      }),
    [],
  );
  useFrame((_s, dt) => {
    const u = material.uniforms.uSlow;
    u.value += (stageState.slow - u.value) * Math.min(1, dt * 5);
  });
  return (
    <mesh position={[0, 0, -1.5]} material={material} renderOrder={-500}>
      <planeGeometry args={[3.6, 6]} />
    </mesh>
  );
};

// ─── Palm pad: where the ball will bounce ────────────────────────────────────

const padFrag = /* glsl */ `
uniform float uGlow;
uniform float uAlpha;
varying vec2 vUv;
void main() {
  vec2 c = (vUv - 0.5) * 2.0;
  float r = length(c);
  float body = smoothstep(1.0, 0.0, r) * 0.35;
  float edge = smoothstep(0.08, 0.0, abs(r - 0.82)) * 0.6;
  gl_FragColor = vec4(vec3(1.0, 0.97, 0.9) * (1.0 + uGlow), (body + edge) * uAlpha * (0.55 + uGlow));
}
`;

export const padState = { radius: CATCH.radius };

export const PalmPad = () => {
  const mesh = useRef<Mesh>(null);
  const glow = useRef(0);
  const vis = useRef(0);
  const material = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: { uGlow: { value: 0 }, uAlpha: { value: 0 } },
        vertexShader: ringVert,
        fragmentShader: padFrag,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    [],
  );
  useEffect(() => {
    fx.pad = (a) => {
      glow.current = Math.min(1.5, glow.current + a);
    };
    return () => {
      fx.pad = noop;
    };
  }, []);
  useFrame((_s, dt) => {
    const m = mesh.current;
    if (!m) return;
    vis.current += ((hand.palm ? 1 : 0) - vis.current) * Math.min(1, dt * 10);
    glow.current = Math.max(0, glow.current - dt * 3);
    m.visible = vis.current > 0.01;
    if (hand.palm) m.position.set(hand.palm.x, hand.palm.y + CATCH.padOffset, 0.2);
    // A flat ellipse as wide as the catch zone.
    m.scale.set(padState.radius * 2.2, padState.radius * 0.7, 1);
    material.uniforms.uGlow.value = glow.current;
    material.uniforms.uAlpha.value = vis.current;
  });
  return (
    <mesh ref={mesh} material={material} renderOrder={14} visible={false}>
      <planeGeometry args={[1, 1]} />
    </mesh>
  );
};

// ─── Wind streaks ────────────────────────────────────────────────────────────

export const windState = { wind: 0, hw: 1.2, hh: 2.1 };

export const WindStreaks = () => {
  const t = useRef(0);
  useFrame((_s, dt) => {
    const w = windState.wind;
    if (Math.abs(w) < 0.3) return;
    t.current += dt * Math.abs(w) * 6;
    while (t.current > 1) {
      t.current -= 1;
      fx.emit({
        x: w > 0 ? -windState.hw - 0.1 : windState.hw + 0.1,
        y: (Math.random() * 2 - 1) * windState.hh * 0.8,
        count: 1,
        colors: ["#dbeafe"],
        speed: [1.6 + Math.abs(w) * 0.6, 2.4 + Math.abs(w) * 0.8],
        angle: w > 0 ? 0 : Math.PI,
        spread: 0.1,
        size: [0.025, 0.04],
        life: [1.1, 1.6],
        drag: 0,
        additive: true,
      });
    }
  });
  return null;
};
