// Every tunable. World units: camera at z=5 with a 45° vertical FOV, so the z=0
// stage is ~4.14 units tall and ~2.33 wide (9:16). Positions are on that stage.

export type Kind = "ball" | "heavy" | "fast" | "bouncy" | "gold" | "slowmo" | "bomb";

export type KindSpec = {
  label: string;
  radius: number;
  /** Multiplies gravity. */
  gravity: number;
  /** Multiplies the catch radius (smaller = needs more precision). */
  catchZone: number;
  /** Multiplies launch height (bouncy > 1). */
  launch: number;
  /** Extra random sideways speed per bounce. */
  jitter: number;
  /** Multiplies wind. */
  wind: number;
  /** Missing it ends the round. */
  lethalMiss: boolean;
  /** Catching it ends the round (bombs). */
  lethalCatch: boolean;
  /** Has eyes (the characters). */
  face: boolean;
  /** Main colour (shaders take it from here). */
  color: string;
};

export const KINDS: Record<Kind, KindSpec> = {
  ball: { label: "", radius: 0.19, gravity: 1, catchZone: 1, launch: 1, jitter: 0, wind: 1, lethalMiss: true, lethalCatch: false, face: true, color: "#ff7a59" },
  heavy: { label: "HEAVY", radius: 0.2, gravity: 1.38, catchZone: 0.82, launch: 0.9, jitter: 0, wind: 0.45, lethalMiss: true, lethalCatch: false, face: true, color: "#5b6478" },
  fast: { label: "FAST", radius: 0.17, gravity: 1.18, catchZone: 0.95, launch: 1, jitter: 1.1, wind: 1, lethalMiss: true, lethalCatch: false, face: true, color: "#22d3ee" },
  bouncy: { label: "BOUNCY", radius: 0.19, gravity: 0.95, catchZone: 1.05, launch: 1.35, jitter: 0.5, wind: 1.2, lethalMiss: true, lethalCatch: false, face: true, color: "#f472b6" },
  gold: { label: "+3", radius: 0.14, gravity: 0.5, catchZone: 1.1, launch: 0, jitter: 0, wind: 1.3, lethalMiss: false, lethalCatch: false, face: false, color: "#fbbf24" },
  slowmo: { label: "SLOW-MO", radius: 0.14, gravity: 0.5, catchZone: 1.1, launch: 0, jitter: 0, wind: 1.3, lethalMiss: false, lethalCatch: false, face: false, color: "#7dd3fc" },
  bomb: { label: "", radius: 0.16, gravity: 0.6, catchZone: 0.9, launch: 0, jitter: 0, wind: 0.8, lethalMiss: false, lethalCatch: true, face: false, color: "#1f2330" },
};

export const PHYSICS = {
  /** Fixed simulation rate (Hz) and catch-up cap. */
  rate: 120,
  maxSteps: 10,
  /** Base gravity (units/s²) and growth per point (capped). */
  gravity: 7,
  gravityPerPoint: 0.012,
  gravityCapScore: 60,
  /** Wall restitution, ceiling restitution. */
  wall: 0.85,
  ceiling: 0.35,
  /** Bounce apex: this far below the top, with some randomness. */
  apexMargin: 0.38,
  apexRandom: 0.45,
  /** Sideways speed from an off-centre hit (at the catch edge) and its cap. */
  offCentre: 1.5,
  maxVx: 2.4,
  /** Share of hand velocity passed into the ball. */
  handVx: 0.25,
  handVyBoost: 0.3,
  /** Base sideways variation per bounce, growing with score. */
  jitterBase: 0.15,
  jitterPerPoint: 0.012,
  jitterCap: 0.7,
};

export const CATCH = {
  /** Horizontal catch radius (units) at score 0, and the floor it shrinks to. */
  radius: 0.34,
  radiusMin: 0.25,
  shrinkPerPoint: 0.0015,
  /** The pad sits this far above the palm centre. */
  padOffset: 0.1,
  /** Ball bottom may be this far below the pad and still count (tracking lag). */
  depth: 0.28,
  /** ...but the ball centre must stay above this (the hand is underneath). */
  centreBelowPad: 0.12,
  /** Seconds before the same body can be caught again. */
  cooldown: 0.22,
  /** A hand must be tracked this long before it can catch (s). */
  handSettle: 0.12,
};

export const FLOW = {
  /** Hand seen this long before the waiting ball drops (s). */
  dropAfter: 0.35,
  /** Game-over moment before the next ball waits (s). */
  overTime: 1.2,
  /** Waiting ball height, × half-height. */
  waitHeight: 0.55,
  milestoneEvery: 10,
};

export const DIRECTOR = {
  windFrom: 15,
  windMax: 2.2,
  windRampTo: 45,
  variantsFrom: 25,
  variantEvery: 10,
  variantBounces: 8,
  variantOrder: ["heavy", "fast", "bouncy"] as Kind[],
  bonusFrom: 30,
  bonusEvery: [6, 9] as [number, number],
  bombFrom: 40,
  bombEvery: [7, 10] as [number, number],
  secondBallAt: 50,
  slowmoTime: 4,
  slowmoScale: 0.55,
  goldPoints: 3,
};

export const BEST_KEY = "dont-let-it-fall:best";
