# Plan — Don't Let It Fall

What: `Brief.md`. This file is how.

## Decisions (confirmed 2026-10-10)

- **3D balls:** the main ball is a soft sphere with expressive eyes. Every other kind is also round
  but has its own shader, so each reads at a glance.
- **Scope:** all three phases; the director introduces them by score.
- **Start:** the ball waits at the top with "Raise your hand" and drops once a hand is seen. A hand
  lost mid-game doesn't pause anything: the ball keeps falling, and a miss counts.

## Modules (`src/fall/`, as the brief asks)

| Module | Job |
|---|---|
| `config.ts` | every tunable, plus the object kinds table (physics + rules) |
| `sim.ts` | **pure** game simulation: fixed-step physics, collision (catches), scoring, phases, the difficulty director. No three.js, so it is unit-tested (`sim.test.ts`). Returns events. |
| `hand.ts` | palm → world position + velocity, smoothed. Dev mouse override. |
| `Game.tsx` | runs `sim.step` at a fixed 120 Hz (delta-time accumulator), routes events to effects and the HUD |
| `Balls.tsx` + `materials.ts` | one mesh per body; per-kind shader; squash & stretch; eyes |
| `effects.tsx` | pooled particles (trails, puffs, bursts), hand ripple ring, screen shake, stage dim, palm pad |
| `Hud.tsx` | score, best, prompts, milestone pops, variant labels, the game-over moment |

## Rules

- **Catch:** the body is falling, the hand is tracked, the ball is within the catch radius
  horizontally, and the ball's bottom crosses (swept) or is within a small tolerance of the palm
  "pad" (lag tolerance) with the palm underneath. A short per-body cooldown means one catch per
  contact. No hand = no catches.
- **Bounce:** launch so the apex lands near the top (more gravity = less airtime = harder).
  Off-centre hits add sideways speed; an upward-moving hand adds power.
- **Miss:** a lethal ball reaches the bottom → it bursts, the score freezes, "MISSED" shows for
  about 1.2 s, then a new ball waits at the top. If the hand is still there, it drops at once.
  Phases are guarded so a round can't score twice or overlap.

## Director (difficulty by score)

| Score | Adds |
|---|---|
| 0+ | one ball; gravity rises slowly with score; small sideways variation grows |
| 15+ | **wind** gusts pushing sideways (HUD arrow) |
| 25+ | every 10 points the ball **transforms** for 8 bounces: heavy (dark steel, falls faster, smaller catch zone) → fast (electric, jittery sideways) → bouncy (rainbow, super bounce) |
| 30+ | **bonus** drops: gold (+3) or ice clock (slow motion for 4 s) |
| 40+ | **bombs**: catching one ends the round; let them fall |
| 50+ | **a second ball** to juggle |

Milestone pop every 10 points. Best score in localStorage (guarded).

## Dev input

A moving mouse takes over as the hand; `?score=N` starts at a score; `window.__freeze = true`
pauses the simulation. All dev-only and stripped from production. `?seed=N` (deterministic runs)
also works in production. A recorded clip was used as the camera during development, then
removed: **the input is the webcam only.**

## Production

Title and share-preview metadata are in `index.html` (a platform file: re-apply after a template
upgrade). An experience status signal is included. New `src/` files are in the manifest's
`creator` list.
