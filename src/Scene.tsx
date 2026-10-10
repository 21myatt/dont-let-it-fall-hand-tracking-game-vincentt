// Scene.tsx — Don't Let It Fall: keep the ball alive with your hand.
// See Brief.md (what) and PLAN.md (how).
import { lazy, Suspense } from "react";
import { HandTracker } from "@vincentt-xr/sdk/tracking";

import { ExperienceStatus } from "./fall/ExperienceStatus";
import { Game } from "./fall/Game";
import { HandRig } from "./fall/hand";

// Dev-only mouse stand-in for the hand, lazy and behind a constant esbuild folds
// to false in production. Two rules: `process.env.NODE_ENV`, not
// `import.meta.env.DEV` (vincentt-xr/v2-template#112); and write the check INSIDE
// the ternary — hoisted into a `const`, esbuild keeps the dead branch.
const DevMouse = process.env.NODE_ENV !== "production" ? lazy(() => import("./fall/DevMouse")) : null;

export const Scene = () => (
  <>
    {/* Gameplay wants fresh hand data: 30 fps inference, One Euro smoothing between samples. */}
    <HandTracker targetFps={30} />
    <HandRig />
    <ExperienceStatus />

    <Game />

    {DevMouse ? (
      <Suspense fallback={null}>
        <DevMouse />
      </Suspense>
    ) : null}
  </>
);
