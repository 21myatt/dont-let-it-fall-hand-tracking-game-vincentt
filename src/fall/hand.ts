// Palm → stage position and velocity. One mutable object, written once per frame
// by <HandRig /> (useFrame priority -1). In dev, a moving mouse overrides the
// palm (DevMouse.tsx) — the preview clip's palm can't chase the ball.
import { useFrame, useThree } from "@react-three/fiber";
import { XRModel } from "@vincentt-xr/sdk";
import { useXRContext, type XRModelNodeHandTracking } from "@vincentt-xr/sdk/low-level";

import { OneEuro } from "./oneEuro";

export const hand = {
  /** Palm centre on the z=0 stage, or null when nothing is tracked. */
  palm: null as { x: number; y: number } | null,
  vel: { x: 0, y: 0 },
  source: "none" as "none" | "hand" | "mouse",
};

/** Dev-only override in stage units; `at` = performance.now() of the last move. */
export const mouseOverride = { x: 0, y: 0, at: -Infinity };

const MOUSE_HOLD_MS = 1500;
const LOST_MS = 200;
/** Fast response for gameplay; light smoothing against jitter. */
const fx = new OneEuro(2.4, 1.6);
const fy = new OneEuro(2.4, 1.6);
const pos = { x: 0, y: 0 };
let lastSeen = -Infinity;
let had = false;

export const HandRig = () => {
  const { session } = useXRContext();
  const { viewport, camera } = useThree();

  useFrame((_s, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20);
    const now = performance.now();
    const { width, height } = viewport.getCurrentViewport(camera, [0, 0, 0]);
    let raw: { x: number; y: number } | null = null;
    let source: typeof hand.source = "none";

    if (now - mouseOverride.at < MOUSE_HOLD_MS) {
      raw = { x: mouseOverride.x, y: mouseOverride.y };
      source = "mouse";
    } else {
      const node = session.getModelNode<XRModelNodeHandTracking>(XRModel.HAND_TRACKER);
      const c = node?.hands?.[0]?.coordinates ?? node?.coordinates;
      if (c && c.length >= 21) {
        lastSeen = now;
        // Palm centre: wrist + four knuckles; tracker space is centre-origin [-1, 1], Y up.
        let x = 0;
        let y = 0;
        [0, 5, 9, 13, 17].forEach((i) => {
          x += c[i].x;
          y += c[i].y;
        });
        raw = { x: (x / 5) * (width / 2), y: (y / 5) * (height / 2) };
        source = "hand";
      } else if (now - lastSeen < LOST_MS && hand.palm) {
        // Brief dropout: hold the last position (no new movement).
        raw = { x: pos.x, y: pos.y };
        source = "hand";
      }
    }

    if (!raw) {
      hand.palm = null;
      hand.vel.x = 0;
      hand.vel.y = 0;
      hand.source = "none";
      had = false;
      fx.reset();
      fy.reset();
      return;
    }
    const px = pos.x;
    const py = pos.y;
    if (!had || hand.source !== source) {
      fx.reset();
      fy.reset();
    }
    pos.x = source === "mouse" ? raw.x : fx.filter(raw.x, dt);
    pos.y = source === "mouse" ? raw.y : fy.filter(raw.y, dt);
    if (had && dt > 0) {
      const k = Math.min(1, dt * 16);
      hand.vel.x += ((pos.x - px) / dt - hand.vel.x) * k;
      hand.vel.y += ((pos.y - py) / dt - hand.vel.y) * k;
    }
    hand.palm = { x: pos.x, y: pos.y };
    hand.source = source;
    had = true;
  }, -1);

  return null;
};

if (process.env.NODE_ENV !== "production") {
  (window as unknown as { __hand: typeof hand }).__hand = hand;
}
