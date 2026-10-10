// One mesh per simulated body: per-kind shader, squash & stretch, spin, and —
// for the characters — eyes that blink, look where they're heading and squint
// happily after a bounce. Reads the world each frame; no per-frame re-renders.
import { useEffect, useMemo, useRef } from "react";
import type { Group, Mesh } from "three";
import { useFrame } from "@react-three/fiber";

import { KINDS, type Kind } from "./config";
import { makeMaterial } from "./materials";
import type { World } from "./sim";

/** Per-body visual impulses, set by Game on events. */
export const ballVis = new Map<number, { squash: number; flash: number; happy: number }>();
export const visFor = (id: number) => {
  let v = ballVis.get(id);
  if (!v) {
    v = { squash: 0, flash: 0, happy: 0 };
    ballVis.set(id, v);
  }
  return v;
};

const Eyes = ({ eyes }: { eyes: React.RefObject<Group> }) => (
  <group ref={eyes} position={[0, 0.12, 0.8]}>
    {[-1, 1].map((side) => (
      <group key={side} position={[side * 0.34, 0, 0]}>
        <mesh scale={[0.24, 0.3, 0.12]}>
          <sphereGeometry args={[1, 20, 14]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
        <mesh position={[0, 0, 0.1]} scale={[0.12, 0.15, 0.06]} name="pupil">
          <sphereGeometry args={[1, 16, 10]} />
          <meshBasicMaterial color="#1b1b24" />
        </mesh>
      </group>
    ))}
  </group>
);

export const Ball = ({ id, kind, world }: { id: number; kind: Kind; world: () => World }) => {
  const outer = useRef<Group>(null);
  const body = useRef<Mesh>(null);
  const eyes = useRef<Group>(null);
  const fuse = useRef<Group>(null);
  const material = useMemo(() => makeMaterial(kind), [kind]);
  const blink = useRef({ next: 1 + Math.random() * 3, t: 0 });
  const spec = KINDS[kind];

  useEffect(() => () => material.dispose(), [material]);
  useEffect(() => () => {
    ballVis.delete(id);
  }, [id]);

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 1 / 30);
    const g = outer.current;
    const w = world();
    const b = w.bodies.find((x) => x.id === id);
    if (!g) return;
    if (!b || !b.alive) {
      g.visible = false;
      return;
    }
    g.visible = true;
    const v = visFor(id);
    v.squash = Math.max(0, v.squash - dt * 4.5);
    v.flash = Math.max(0, v.flash - dt * 3);
    v.happy = Math.max(0, v.happy - dt * 2.2);

    const r = spec.radius;
    g.position.set(b.x, b.y, 0);
    // Stretch along the fall, squash on impact (a quick wobble).
    const s = Math.min(0.2, Math.abs(b.vy) * 0.022);
    const q = v.squash > 0 ? Math.sin((1 - v.squash) * Math.PI * 2.5) * v.squash * 0.38 : 0;
    const breathe = b.held ? Math.sin(state.clock.elapsedTime * 3) * 0.03 : 0;
    const fadeIn = Math.min(1, b.age / 0.2 + (b.held ? 1 : 0));
    g.scale.set(r * (1 - s * 0.5 + q) * fadeIn, r * (1 + s - q + breathe) * fadeIn, r * (1 - s * 0.5 + q) * fadeIn);
    if (body.current) {
      body.current.rotation.z = b.spin;
      body.current.rotation.y = b.spin * 0.6;
    }
    if (fuse.current) fuse.current.rotation.z = Math.sin(state.clock.elapsedTime * 9) * 0.12;
    material.uniforms.uTime.value = state.clock.elapsedTime;
    material.uniforms.uFlash.value = v.flash * 0.7;

    // Eyes: look toward the motion, blink, squint when happy, widen when falling fast low down.
    if (eyes.current) {
      const e = eyes.current;
      blink.current.next -= dt;
      if (blink.current.next <= 0) {
        blink.current.t = 0.13;
        blink.current.next = 2 + Math.random() * 3;
      }
      blink.current.t = Math.max(0, blink.current.t - dt);
      const scared = b.vy < -3 && b.y < -w.hh * 0.3 ? 1.25 : 1;
      const open = blink.current.t > 0 ? 0.12 : 1 - v.happy * 0.6;
      e.scale.set(scared, open * scared, 1);
      const lx = Math.max(-0.12, Math.min(0.12, b.vx * 0.05));
      const ly = Math.max(-0.12, Math.min(0.12, b.vy * 0.025));
      e.children.forEach((eye) => {
        const pupil = eye.children[1];
        if (pupil) pupil.position.set(lx, ly, 0.1);
      });
    }
  });

  return (
    <group ref={outer}>
      <mesh ref={body} material={material} renderOrder={10}>
        <sphereGeometry args={[1, 40, 28]} />
      </mesh>
      {spec.face ? <Eyes eyes={eyes} /> : null}
      {kind === "bomb" ? (
        <group ref={fuse} position={[0.25, 0.95, 0]} rotation={[0, 0, -0.4]}>
          <mesh>
            <cylinderGeometry args={[0.1, 0.12, 0.35, 10]} />
            <meshBasicMaterial color="#c8b48a" />
          </mesh>
        </group>
      ) : null}
      {kind === "slowmo" ? (
        <mesh rotation={[Math.PI / 2.4, 0, 0]}>
          <torusGeometry args={[1.35, 0.06, 8, 40]} />
          <meshBasicMaterial color="#e0f2fe" transparent opacity={0.8} />
        </mesh>
      ) : null}
    </group>
  );
};
