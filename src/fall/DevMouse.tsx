// Dev-only (lazy-loaded by Scene.tsx): the mouse stands in for the palm while it
// moves, because the preview clip's palm can't chase the ball. Never shipped.
import { useEffect } from "react";
import { useThree } from "@react-three/fiber";

import { mouseOverride } from "./hand";

const DevMouse = () => {
  const { gl, viewport, camera } = useThree();
  useEffect(() => {
    const el = gl.domElement;
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const { width, height } = viewport.getCurrentViewport(camera, [0, 0, 0]);
      mouseOverride.x = ((e.clientX - r.left) / r.width - 0.5) * width;
      mouseOverride.y = (0.5 - (e.clientY - r.top) / r.height) * height;
      mouseOverride.at = performance.now();
    };
    el.addEventListener("pointermove", move);
    return () => el.removeEventListener("pointermove", move);
  }, [gl, viewport, camera]);
  return null;
};

export default DevMouse;
