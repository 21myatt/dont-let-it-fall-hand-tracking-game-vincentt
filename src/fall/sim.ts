// The game simulation: physics, collision (catches), scoring, phases and the
// difficulty director. Pure TypeScript — no three.js, no React — so it is
// deterministic for a seeded RNG and unit-tested (sim.test.ts). `step` mutates
// the world in place (allocation-free hot path) and returns what happened as
// events for the effects and HUD.
import { CATCH, DIRECTOR, FLOW, KINDS, PHYSICS, type Kind } from "./config";
import type { Rng } from "./rng";

export type Body = {
  id: number;
  kind: Kind;
  /** For main balls: the kind it reverts to after a variant runs out. */
  baseKind: Kind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  prevY: number;
  /** Seconds until it can be caught again. */
  cooldown: number;
  /** Bounces left in the current variant (0 = none). */
  variantLeft: number;
  /** Held at the top until the round starts. */
  held: boolean;
  alive: boolean;
  age: number;
  /** Visual spin angle (rad). */
  spin: number;
};

export type Phase = "waiting" | "playing" | "over";

export type World = {
  phase: Phase;
  phaseTime: number;
  score: number;
  best: number;
  bodies: Body[];
  nextId: number;
  /** Half extents of the stage. */
  hw: number;
  hh: number;
  /** Sideways wind acceleration (units/s²) and its target. */
  wind: number;
  windTarget: number;
  windTimer: number;
  /** Slow motion seconds left (in real time). */
  slowmo: number;
  bonusTimer: number;
  bombTimer: number;
  /** Seconds the hand has been tracked continuously. */
  handTime: number;
  /** Bumped when the HUD needs to re-read. */
  version: number;
};

export type HandInput = {
  /** Palm centre on the stage, or null when no hand is tracked. */
  palm: { x: number; y: number } | null;
  /** Palm velocity (units/s). */
  vel: { x: number; y: number };
};

export type GameEvent =
  | { type: "drop"; body: Body }
  | { type: "catch"; body: Body; x: number; y: number; power: number }
  | { type: "bonus"; body: Body; points: number }
  | { type: "slowmo"; body: Body }
  | { type: "bomb"; body: Body }
  | { type: "miss"; body: Body }
  | { type: "despawn"; body: Body }
  | { type: "milestone"; score: number }
  | { type: "variant"; body: Body; kind: Kind }
  | { type: "spawn"; body: Body }
  | { type: "over"; score: number; best: number; cause: "miss" | "bomb" }
  | { type: "restart" };

const range = (rng: Rng, [a, b]: [number, number]) => a + rng() * (b - a);
const [BONUS_FIRST] = DIRECTOR.bonusEvery;
const [BOMB_FIRST] = DIRECTOR.bombEvery;

const makeBody = (w: World, kind: Kind, x: number, y: number, held: boolean): Body => {
  w.nextId += 1;
  return { id: w.nextId, kind, baseKind: kind, x, y, vx: 0, vy: 0, prevY: y, cooldown: 0, variantLeft: 0, held, alive: true, age: 0, spin: 0 };
};

const waitingBall = (w: World) => makeBody(w, "ball", 0, w.hh * FLOW.waitHeight, true);

export const createWorld = (hw: number, hh: number, best = 0, score = 0): World => {
  const w: World = {
    phase: "waiting",
    phaseTime: 0,
    score,
    best,
    bodies: [],
    nextId: 0,
    hw,
    hh,
    wind: 0,
    windTarget: 0,
    windTimer: 0,
    slowmo: 0,
    bonusTimer: 0,
    bombTimer: 0,
    handTime: 0,
    version: 0,
  };
  w.bodies.push(waitingBall(w));
  w.bonusTimer = BONUS_FIRST;
  w.bombTimer = BOMB_FIRST;
  return w;
};

export const gravityFor = (w: World, kind: Kind) =>
  PHYSICS.gravity * (1 + Math.min(w.score, PHYSICS.gravityCapScore) * PHYSICS.gravityPerPoint) * KINDS[kind].gravity;

export const catchRadiusFor = (w: World, kind: Kind) =>
  Math.max(CATCH.radiusMin, CATCH.radius - w.score * CATCH.shrinkPerPoint) * KINDS[kind].catchZone;

const mains = (w: World) => w.bodies.filter((b) => b.alive && KINDS[b.kind].lethalMiss);

const endRound = (w: World, events: GameEvent[], cause: "miss" | "bomb") => {
  w.phase = "over";
  w.phaseTime = 0;
  w.best = Math.max(w.best, w.score);
  // Everything still on stage bursts with the round.
  w.bodies.forEach((b) => {
    if (b.alive) {
      b.alive = false;
      events.push({ type: cause === "bomb" && KINDS[b.kind].lethalCatch ? "bomb" : "miss", body: b });
    }
  });
  events.push({ type: "over", score: w.score, best: w.best, cause });
  w.version += 1;
};

/** Launch speed so the apex lands near (not past) the top. */
const launchSpeed = (w: World, b: Body, rng: Rng) => {
  const g = gravityFor(w, b.kind);
  const apex = w.hh - PHYSICS.apexMargin - rng() * PHYSICS.apexRandom;
  const rise = Math.max(0.6, apex - b.y) * KINDS[b.kind].launch;
  return Math.sqrt(2 * g * rise);
};

const director = (w: World, dt: number, rng: Rng, events: GameEvent[]) => {
  // Wind: drifts toward a target that changes every few seconds.
  if (w.score >= DIRECTOR.windFrom) {
    w.windTimer -= dt;
    if (w.windTimer <= 0) {
      const t = Math.min(1, (w.score - DIRECTOR.windFrom) / (DIRECTOR.windRampTo - DIRECTOR.windFrom));
      const max = DIRECTOR.windMax * (0.35 + 0.65 * t);
      w.windTarget = (rng() * 2 - 1) * max;
      w.windTimer = 3 + rng() * 2.5;
      w.version += 1;
    }
  } else {
    w.windTarget = 0;
  }
  w.wind += (w.windTarget - w.wind) * Math.min(1, dt * 1.2);

  // Bonus drops.
  const spawnTop = (kind: Kind) => {
    const r = KINDS[kind].radius;
    const b = makeBody(w, kind, (rng() * 2 - 1) * (w.hw - r - 0.15), w.hh + r, false);
    b.vy = -0.4;
    w.bodies.push(b);
    events.push({ type: "spawn", body: b });
  };
  if (w.score >= DIRECTOR.bonusFrom) {
    w.bonusTimer -= dt;
    if (w.bonusTimer <= 0 && !w.bodies.some((b) => b.alive && (b.kind === "gold" || b.kind === "slowmo"))) {
      spawnTop(rng() < 0.6 ? "gold" : "slowmo");
      w.bonusTimer = range(rng, DIRECTOR.bonusEvery);
    }
  }
  if (w.score >= DIRECTOR.bombFrom) {
    w.bombTimer -= dt;
    if (w.bombTimer <= 0 && !w.bodies.some((b) => b.alive && b.kind === "bomb")) {
      spawnTop("bomb");
      w.bombTimer = range(rng, DIRECTOR.bombEvery);
    }
  }
};

/** Called after every main-ball catch: score, milestones, variants, extra balls. */
const afterCatch = (w: World, b: Body, rng: Rng, events: GameEvent[]) => {
  w.score += 1;
  w.best = Math.max(w.best, w.score);
  w.version += 1;
  if (w.score % FLOW.milestoneEvery === 0) events.push({ type: "milestone", score: w.score });

  // Variant countdown, then a new variant on schedule.
  if (b.variantLeft > 0) {
    b.variantLeft -= 1;
    if (b.variantLeft === 0 && b.kind !== b.baseKind) {
      b.kind = b.baseKind;
      events.push({ type: "variant", body: b, kind: b.kind });
    }
  }
  if (w.score >= DIRECTOR.variantsFrom && (w.score - DIRECTOR.variantsFrom) % DIRECTOR.variantEvery === 0 && b.variantLeft === 0) {
    const i = Math.floor((w.score - DIRECTOR.variantsFrom) / DIRECTOR.variantEvery) % DIRECTOR.variantOrder.length;
    b.kind = DIRECTOR.variantOrder[i];
    b.variantLeft = DIRECTOR.variantBounces;
    events.push({ type: "variant", body: b, kind: b.kind });
  }

  // Juggling: a second ball joins.
  if (w.score === DIRECTOR.secondBallAt && mains(w).length < 2) {
    const nb = makeBody(w, "ball", -Math.sign(b.x || 1) * w.hw * 0.5, w.hh + 0.2, false);
    nb.vy = -0.3;
    w.bodies.push(nb);
    events.push({ type: "spawn", body: nb });
  }
  // A little unpredictability that grows with score.
  const jitter = Math.min(PHYSICS.jitterCap, PHYSICS.jitterBase + w.score * PHYSICS.jitterPerPoint) + KINDS[b.kind].jitter;
  b.vx += (rng() * 2 - 1) * jitter;
};

/** One fixed step. `dt` is real seconds; slow motion scales it internally. */
export const step = (w: World, hand: HandInput, dt: number, rng: Rng): GameEvent[] => {
  const events: GameEvent[] = [];
  w.phaseTime += dt;
  w.handTime = hand.palm ? w.handTime + dt : 0;
  if (w.slowmo > 0) w.slowmo = Math.max(0, w.slowmo - dt);
  const sdt = dt * (w.slowmo > 0 ? DIRECTOR.slowmoScale : 1);

  if (w.phase === "over") {
    if (w.phaseTime >= FLOW.overTime) {
      // Fresh round: one ball waiting at the top.
      w.phase = "waiting";
      w.phaseTime = 0;
      w.score = 0;
      w.wind = 0;
      w.windTarget = 0;
      w.windTimer = 0;
      w.slowmo = 0;
      w.bonusTimer = BONUS_FIRST;
      w.bombTimer = BOMB_FIRST;
      w.bodies = [waitingBall(w)];
      w.version += 1;
      events.push({ type: "restart" });
    }
    return events;
  }

  if (w.phase === "waiting") {
    const held = w.bodies[0];
    if (held) {
      held.age += dt;
      held.y = w.hh * FLOW.waitHeight + Math.sin(held.age * 2.2) * 0.04;
      held.prevY = held.y;
      held.spin += dt * 0.6;
    }
    if (w.handTime >= FLOW.dropAfter && held) {
      held.held = false;
      held.vy = 0;
      w.phase = "playing";
      w.phaseTime = 0;
      w.version += 1;
      events.push({ type: "drop", body: held });
    }
    return events;
  }

  // ── Playing ──
  director(w, sdt, rng, events);
  const palm = hand.palm && w.handTime >= CATCH.handSettle ? hand.palm : null;

  for (const b of w.bodies) {
    if (!b.alive) continue;
    const spec = KINDS[b.kind];
    b.age += sdt;
    b.cooldown = Math.max(0, b.cooldown - sdt);
    b.prevY = b.y;

    // Integrate (semi-implicit Euler).
    b.vy -= gravityFor(w, b.kind) * sdt;
    b.vx += w.wind * spec.wind * sdt;
    b.vx *= 1 - 0.15 * sdt;
    b.x += b.vx * sdt;
    b.y += b.vy * sdt;
    b.spin += b.vx * sdt * 3;

    // Walls and ceiling.
    const r = spec.radius;
    if (Math.abs(b.x) > w.hw - r) {
      b.x = Math.sign(b.x) * (w.hw - r);
      b.vx = -b.vx * PHYSICS.wall;
    }
    if (b.y + r > w.hh && b.vy > 0 && !(b.age < 1.5 && !spec.lethalMiss)) {
      b.y = w.hh - r;
      b.vy = -b.vy * PHYSICS.ceiling;
    }

    // ── Catch: falling, hand underneath, within the zone ──
    if (palm && b.vy < 0 && b.cooldown <= 0) {
      const pad = palm.y + CATCH.padOffset;
      const dx = b.x - palm.x;
      const zone = catchRadiusFor(w, b.kind);
      const bottom = b.y - r;
      const prevBottom = b.prevY - r;
      const crossed = prevBottom >= pad && bottom <= pad;
      const inside = bottom <= pad && bottom >= pad - CATCH.depth && b.y >= pad - CATCH.centreBelowPad;
      if (Math.abs(dx) <= zone + r * 0.5 && (crossed || inside)) {
        if (spec.lethalCatch) {
          b.alive = false;
          endRound(w, events, "bomb");
          return events;
        }
        if (b.kind === "gold" || b.kind === "slowmo") {
          b.alive = false;
          if (b.kind === "gold") {
            w.score += DIRECTOR.goldPoints;
            w.best = Math.max(w.best, w.score);
            events.push({ type: "bonus", body: b, points: DIRECTOR.goldPoints });
          } else {
            w.slowmo = DIRECTOR.slowmoTime;
            events.push({ type: "slowmo", body: b });
          }
          w.version += 1;
          continue;
        }
        // Bounce.
        b.y = pad + r;
        b.prevY = b.y;
        const up = launchSpeed(w, b, rng) + Math.max(0, hand.vel.y) * PHYSICS.handVyBoost;
        b.vy = up;
        const vx = (dx / zone) * PHYSICS.offCentre + hand.vel.x * PHYSICS.handVx;
        b.vx = Math.max(-PHYSICS.maxVx, Math.min(PHYSICS.maxVx, b.vx * 0.3 + vx));
        b.cooldown = CATCH.cooldown;
        afterCatch(w, b, rng, events);
        events.push({ type: "catch", body: b, x: b.x, y: pad, power: Math.min(1, Math.abs(b.vy) / 7) });
        continue;
      }
    }

    // ── Bottom ──
    if (b.y - r < -w.hh) {
      if (spec.lethalMiss) {
        b.alive = false;
        endRound(w, events, "miss");
        return events;
      }
      b.alive = false;
      events.push({ type: "despawn", body: b });
    }
  }

  // Drop dead bodies (keep the array small).
  if (w.bodies.some((b) => !b.alive)) w.bodies = w.bodies.filter((b) => b.alive);
  return events;
};
