// Orchestrator: steps the simulation at a fixed 120 Hz (delta-time accumulator),
// feeds it the hand, and routes its events to effects and the HUD. React
// re-renders only when the set of bodies or their kinds change.
import { useCallback, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";

import { Ball, visFor } from "./Balls";
import { BEST_KEY, KINDS, PHYSICS } from "./config";
import { CameraShake, fx, padState, PalmPad, Particles, Ripples, Stage, stageState, WindStreaks, windState } from "./effects";
import { hand } from "./hand";
import { Hud, hud } from "./Hud";
import { makeRng, seedFromUrl } from "./rng";
import { catchRadiusFor, createWorld, step, type GameEvent, type World } from "./sim";

const loadBest = () => {
  try {
    return Number(window.localStorage.getItem(BEST_KEY)) || 0;
  } catch {
    return 0;
  }
};
const saveBest = (n: number) => {
  try {
    window.localStorage.setItem(BEST_KEY, String(n));
  } catch {
    // Storage blocked: best lasts this session only.
  }
};

const CONFETTI = ["#ff7a59", "#fbbf24", "#22d3ee", "#a78bfa", "#4ade80", "#f472b6"];

const handle = (e: GameEvent, w: World) => {
  switch (e.type) {
    case "catch": {
      const { color } = KINDS[e.body.kind];
      const v = visFor(e.body.id);
      v.squash = 1;
      v.happy = 1;
      fx.emit({ x: e.x, y: e.y, count: 14, colors: ["#ffffff", color], speed: [0.8, 2.4], angle: Math.PI / 2, spread: 2.6, size: [0.04, 0.09], life: [0.3, 0.55], gravity: 3, drag: 2 });
      fx.ripple(e.x, e.y, color, e.power);
      fx.pad(1);
      fx.shake(0.012 + e.power * 0.01);
      hud.bump();
      break;
    }
    case "bonus":
      fx.emit({ x: e.body.x, y: e.body.y, count: 26, colors: ["#fde68a", "#fbbf24", "#ffffff"], speed: [1, 3], size: [0.04, 0.08], life: [0.4, 0.8], drag: 2.5, additive: true });
      hud.pop(`+${e.points}`, "#fbbf24");
      break;
    case "slowmo":
      fx.emit({ x: e.body.x, y: e.body.y, count: 26, colors: ["#e0f2fe", "#7dd3fc"], speed: [0.8, 2.5], size: [0.04, 0.08], life: [0.5, 0.9], drag: 2, additive: true });
      hud.pop("SLOW-MO", "#7dd3fc");
      break;
    case "bomb":
      fx.emit({ x: e.body.x, y: e.body.y, count: 50, colors: ["#fb923c", "#ef4444", "#fde047"], speed: [1.5, 5], size: [0.06, 0.14], life: [0.4, 0.9], gravity: 2, drag: 2.2, additive: true });
      fx.emit({ x: e.body.x, y: e.body.y, count: 24, colors: ["#1f2330", "#374151"], speed: [0.5, 2], size: [0.1, 0.2], life: [0.6, 1.1], gravity: -0.5, drag: 1.5 });
      fx.shake(0.18);
      break;
    case "miss": {
      const { color } = KINDS[e.body.kind];
      const y = Math.max(e.body.y, -w.hh + 0.1);
      fx.emit({ x: e.body.x, y, count: 44, colors: [color, "#ffffff", color], speed: [1.5, 4.2], angle: Math.PI / 2, spread: 2.8, size: [0.05, 0.12], life: [0.5, 1], gravity: 5, drag: 1.2 });
      fx.shake(0.1);
      break;
    }
    case "despawn":
      fx.emit({ x: e.body.x, y: Math.max(e.body.y, -w.hh + 0.1), count: 8, colors: [KINDS[e.body.kind].color], speed: [0.4, 1.2], size: [0.03, 0.06], life: [0.3, 0.5] });
      break;
    case "milestone":
      hud.pop(`${e.score}!`, "#ffffff", true);
      fx.emit({ x: 0, y: w.hh + 0.1, count: 60, colors: CONFETTI, speed: [0.5, 2.5], angle: -Math.PI / 2, spread: 2.2, size: [0.05, 0.09], life: [1.2, 2], gravity: 1.2, drag: 0.6 });
      break;
    case "variant": {
      const spec = KINDS[e.kind];
      visFor(e.body.id).flash = 1;
      fx.emit({ x: e.body.x, y: e.body.y, count: 22, colors: [spec.color, "#ffffff"], speed: [1, 2.6], size: [0.04, 0.08], life: [0.4, 0.7], drag: 2, additive: true });
      hud.pop(spec.label || "NORMAL", spec.label ? spec.color : "#ffffff");
      break;
    }
    case "spawn":
      if (KINDS[e.body.kind].lethalMiss) hud.pop("JUGGLE!", "#ffffff");
      break;
    case "over":
      hud.over(e.cause === "bomb" ? "BOOM!" : "MISSED!", `Score ${e.score}   ·   Best ${e.best}`);
      saveBest(e.best);
      break;
    default:
      break;
  }
};

export const Game = () => {
  const { viewport, camera } = useThree();
  const rng = useMemo(() => makeRng(seedFromUrl(window.location.search)), []);
  const worldRef = useRef<World | null>(null);
  if (!worldRef.current) {
    const { width, height } = viewport.getCurrentViewport(camera, [0, 0, 0]);
    // Dev-only `?score=N` starts at a score, to reach later phases quickly.
    const startScore =
      process.env.NODE_ENV !== "production" ? Number(new URLSearchParams(window.location.search).get("score")) || 0 : 0;
    worldRef.current = createWorld(width / 2, height / 2, loadBest(), startScore);
  }
  const world = useCallback(() => worldRef.current as World, []);
  const acc = useRef(0);
  const [, rerender] = useState(0);
  const shapeKey = useRef("");

  if (process.env.NODE_ENV !== "production") {
    (window as unknown as { __world: () => World }).__world = world;
  }

  useFrame((_state, rawDt) => {
    const w = world();
    const { width, height } = viewport.getCurrentViewport(camera, [0, 0, 0]);
    w.hw = width / 2;
    w.hh = height / 2;

    // Fixed-step physics.
    const fixed = 1 / PHYSICS.rate;
    acc.current = Math.min(acc.current + rawDt, PHYSICS.maxSteps * fixed);
    const input = { palm: hand.palm, vel: hand.vel };
    // Dev-only: `window.__freeze = true` pauses the simulation (visual inspection).
    if (process.env.NODE_ENV !== "production" && (window as unknown as { __freeze?: boolean }).__freeze) acc.current = 0;
    while (acc.current >= fixed) {
      acc.current -= fixed;
      const events = step(w, input, fixed, rng);
      events.forEach((e) => handle(e, w));
    }

    // Feed the effects.
    padState.radius = catchRadiusFor(w, "ball");
    windState.wind = w.wind;
    windState.hw = w.hw;
    windState.hh = w.hh;
    stageState.slow = w.slowmo > 0 ? 1 : 0;
    w.bodies.forEach((b) => {
      if (!b.alive || b.held) return;
      const speed = Math.hypot(b.vx, b.vy);
      // Motion trails on fast moves.
      if (speed > 3.2 && Math.random() < Math.min(1, (speed - 3.2) / 3)) {
        fx.emit({ x: b.x, y: b.y, count: 1, colors: [KINDS[b.kind].color], speed: [0, 0.15], size: [0.1, 0.16], life: [0.18, 0.28], drag: 4 });
      }
      // Bomb fuse sparks.
      if (b.kind === "bomb" && Math.random() < 0.6) {
        const r = KINDS.bomb.radius;
        fx.emit({ x: b.x + r * 0.35, y: b.y + r * 1.15, count: 1, colors: ["#fde047", "#fb923c"], speed: [0.3, 1], angle: Math.PI / 2, spread: 2, size: [0.03, 0.05], life: [0.15, 0.3], additive: true });
      }
    });

    // Re-render only when bodies appear, disappear or change kind.
    const key = w.bodies.map((b) => `${b.id}:${b.kind}`).join(",");
    if (key !== shapeKey.current) {
      shapeKey.current = key;
      rerender((n) => n + 1);
    }
  });

  const w = world();
  return (
    <>
      <Stage />
      <PalmPad />
      {w.bodies.map((b) => (
        <Ball key={`${b.id}-${b.kind}`} id={b.id} kind={b.kind} world={world} />
      ))}
      <Particles />
      <Ripples />
      <WindStreaks />
      <CameraShake />
      <Hud world={world} />
    </>
  );
};
