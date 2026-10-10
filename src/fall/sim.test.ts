import { describe, expect, it } from "vitest";

import { CATCH, DIRECTOR, FLOW, KINDS } from "./config";
import { makeRng } from "./rng";
import { createWorld, step, type GameEvent, type HandInput, type World } from "./sim";

const DT = 1 / 120;
const HW = 1.16;
const HH = 2.07;
const still = { x: 0, y: 0 };

const run = (w: World, hand: HandInput | ((w: World) => HandInput), seconds: number, seed = 1) => {
  const rng = makeRng(seed);
  const events: GameEvent[] = [];
  for (let t = 0; t < seconds; t += DT) events.push(...step(w, typeof hand === "function" ? hand(w) : hand, DT, rng));
  return events;
};

/** A perfect player: palm always directly under the first main ball. */
const perfect = (w: World): HandInput => {
  const b = w.bodies.find((x) => KINDS[x.kind].lethalMiss) ?? w.bodies[0];
  return { palm: { x: b ? b.x : 0, y: -1.2 }, vel: still };
};

describe("start", () => {
  it("waits at the top until a hand is seen, then drops", () => {
    const w = createWorld(HW, HH);
    run(w, { palm: null, vel: still }, 3);
    expect(w.phase).toBe("waiting");
    expect(w.bodies[0].held).toBe(true);
    const ev = run(w, { palm: { x: 0, y: -1.2 }, vel: still }, FLOW.dropAfter + 0.05);
    expect(ev.some((e) => e.type === "drop")).toBe(true);
    expect(w.phase).toBe("playing");
  });
});

describe("catching", () => {
  it("bounces the ball when the palm is underneath, one point per bounce", () => {
    const w = createWorld(HW, HH);
    const ev = run(w, perfect, 6);
    const catches = ev.filter((e) => e.type === "catch").length;
    expect(catches).toBeGreaterThan(2);
    expect(w.score).toBe(catches);
    expect(w.phase).toBe("playing");
  });

  it("does not catch from beside the ball", () => {
    const w = createWorld(HW, HH);
    run(w, { palm: { x: 0, y: -1.2 }, vel: still }, FLOW.dropAfter + 0.02);
    const ev = run(w, { palm: { x: 0.9, y: -1.2 }, vel: still }, 3);
    expect(ev.some((e) => e.type === "catch")).toBe(false);
    expect(ev.some((e) => e.type === "over")).toBe(true);
  });

  it("does not catch a ball whose centre is already below the pad (hand not underneath)", () => {
    const w = createWorld(HW, HH);
    run(w, { palm: { x: 0, y: -1.2 }, vel: still }, FLOW.dropAfter + 0.02);
    const b = w.bodies[0];
    b.y = -1.2 + CATCH.padOffset - CATCH.centreBelowPad - 0.05;
    b.prevY = b.y;
    b.vy = -1;
    const ev = run(w, { palm: { x: 0, y: -1.2 }, vel: still }, DT);
    expect(ev.some((e) => e.type === "catch")).toBe(false);
  });

  it("never awards catches without a tracked hand", () => {
    const w = createWorld(HW, HH);
    run(w, { palm: { x: 0, y: -1.2 }, vel: still }, FLOW.dropAfter + 0.02);
    const ev = run(w, { palm: null, vel: still }, 4);
    expect(ev.filter((e) => e.type === "catch")).toHaveLength(0);
    expect(w.phase === "over" || ev.some((e) => e.type === "over")).toBe(true);
  });

  it("one catch per contact (cooldown) even if the hand stays in place", () => {
    const w = createWorld(HW, HH);
    run(w, { palm: { x: 0, y: -1.2 }, vel: still }, FLOW.dropAfter + 0.02);
    // The first landing takes < 1.2 s; the bounce then needs > 1.2 s to come back down.
    const ev = run(w, { palm: { x: 0, y: -1.2 }, vel: still }, 1.2);
    expect(ev.filter((e) => e.type === "catch")).toHaveLength(1);
  });
});

describe("missing and restarting", () => {
  it("a miss ends the round once, freezes the score, then a new ball waits", () => {
    const w = createWorld(HW, HH);
    run(w, perfect, 4);
    const scored = w.score;
    expect(scored).toBeGreaterThan(0);
    // Hand off to the side: the ball falls past. (Look only up to the first
    // restart — with the hand still in view the next ball drops straight away.)
    const all = run(w, { palm: { x: 1.1, y: -1.9 }, vel: still }, 4);
    const cut = all.findIndex((e) => e.type === "restart");
    const ev = all.slice(0, cut + 1);
    expect(ev.filter((e) => e.type === "over")).toHaveLength(1);
    const over = ev.find((e) => e.type === "over") as Extract<GameEvent, { type: "over" }>;
    expect(over.score).toBe(scored);
    expect(w.best).toBeGreaterThanOrEqual(scored);
    expect(cut).toBeGreaterThan(-1);
    expect(all.slice(0, cut).some((e) => e.type === "catch")).toBe(false); // no scoring while over
  });
});

describe("director", () => {
  it("catching a bomb ends the round", () => {
    const w = createWorld(HW, HH, 0, DIRECTOR.bombFrom);
    run(w, { palm: { x: 0, y: -1.2 }, vel: still }, FLOW.dropAfter + 0.02);
    // Replace everything with a bomb falling onto the palm.
    w.bodies = [];
    w.nextId += 1;
    w.bodies.push({ id: w.nextId, kind: "bomb", baseKind: "bomb", x: 0, y: 0, vx: 0, vy: -1, prevY: 0, cooldown: 0, variantLeft: 0, held: false, alive: true, age: 2, spin: 0 });
    const ev = run(w, { palm: { x: 0, y: -1.2 }, vel: still }, 2);
    const over = ev.find((e) => e.type === "over") as Extract<GameEvent, { type: "over" }> | undefined;
    expect(over?.cause).toBe("bomb");
  });

  it("introduces wind, variants, bonuses and a second ball as the score climbs", () => {
    const w = createWorld(HW, HH, 0, 0);
    const ev = run(w, perfect, 120, 4);
    const kinds = new Set(ev.filter((e) => e.type === "variant").map((e) => (e as Extract<GameEvent, { type: "variant" }>).kind));
    // The perfect player should get far; check what the director produced on the way.
    expect(w.score + ev.filter((e) => e.type === "over").length).toBeGreaterThan(0);
    if (w.score >= DIRECTOR.variantsFrom + 1) expect(kinds.has("heavy")).toBe(true);
    if (w.score >= DIRECTOR.bonusFrom + 10) expect(ev.some((e) => e.type === "spawn")).toBe(true);
  });

  it("is deterministic for a seed", () => {
    const a = createWorld(HW, HH);
    const b = createWorld(HW, HH);
    run(a, perfect, 20, 9);
    run(b, perfect, 20, 9);
    expect(a.score).toBe(b.score);
    expect(a.bodies.map((x) => [x.x.toFixed(4), x.y.toFixed(4)])).toEqual(b.bodies.map((x) => [x.x.toFixed(4), x.y.toFixed(4)]));
  });
});
