// Minimal DOM HUD over the canvas: score + best, the start prompt, pop-ups
// (milestones, variants, bonuses) and the brief game-over moment. Updated
// imperatively every frame; never re-renders.
import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";

import { hand } from "./hand";
import type { World } from "./sim";

const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

const noop = () => {};
export const hud = {
  pop: noop as (text: string, color: string, big?: boolean) => void,
  bump: noop as () => void,
  /** Game-over moment text (title by cause, then score · best). */
  over: noop as (title: string, sub: string) => void,
};

const abs = (s: CSSProperties): CSSProperties => ({ position: "absolute", pointerEvents: "none", userSelect: "none", fontFamily: FONT, ...s });
const shadow = "0 2px 10px rgba(0,0,0,.45)";

export const Hud = ({ world }: { world: () => World }) => {
  const score = useRef<HTMLDivElement>(null);
  const best = useRef<HTMLDivElement>(null);
  const prompt = useRef<HTMLDivElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const over = useRef<HTMLDivElement>(null);
  const overTitle = useRef<HTMLDivElement>(null);
  const overSub = useRef<HTMLDivElement>(null);
  const wind = useRef<HTMLDivElement>(null);
  const slow = useRef<HTMLDivElement>(null);
  const last = useRef({ score: -1, best: -1, phase: "", prompt: "", wind: "", slow: false });

  useEffect(() => {
    hud.pop = (text, color, big = false) => {
      const el = pop.current;
      if (!el) return;
      el.textContent = text;
      el.style.color = color;
      el.style.fontSize = big ? "64px" : "40px";
      el.getAnimations().forEach((a) => a.cancel());
      el.animate(
        [
          { opacity: 0, transform: "translate(-50%,-50%) scale(0.4)" },
          { opacity: 1, transform: "translate(-50%,-50%) scale(1.2)", offset: 0.2 },
          { opacity: 1, transform: "translate(-50%,-50%) scale(1)", offset: 0.45 },
          { opacity: 0, transform: "translate(-50%,-80%) scale(1)" },
        ],
        { duration: 1000, easing: "cubic-bezier(.2,.8,.2,1)", fill: "forwards" },
      );
    };
    hud.bump = () => {
      score.current?.animate([{ transform: "translateX(-50%) scale(1.25)" }, { transform: "translateX(-50%) scale(1)" }], { duration: 220, easing: "ease-out" });
    };
    hud.over = (title, sub) => {
      if (overTitle.current) overTitle.current.textContent = title;
      if (overSub.current) overSub.current.textContent = sub;
    };
    return () => {
      hud.pop = noop;
      hud.bump = noop;
      hud.over = noop;
    };
  }, []);

  useFrame(() => {
    const w = world();
    const l = last.current;
    if (w.score !== l.score && score.current) {
      score.current.textContent = String(w.score);
      l.score = w.score;
    }
    if (w.best !== l.best && best.current) {
      best.current.textContent = `BEST ${w.best}`;
      l.best = w.best;
    }
    let p = "";
    if (w.phase === "waiting") p = hand.palm ? "Get ready…" : "Raise your hand under the ball";
    if (p !== l.prompt && prompt.current) {
      prompt.current.textContent = p;
      prompt.current.style.opacity = p ? "1" : "0";
      l.prompt = p;
    }
    if (w.phase !== l.phase && over.current) {
      over.current.style.opacity = w.phase === "over" ? "1" : "0";
      l.phase = w.phase;
    }
    let wl = "";
    if (w.wind > 0.3) wl = "WIND  →";
    else if (w.wind < -0.3) wl = "←  WIND";
    if (wl !== l.wind && wind.current) {
      wind.current.textContent = wl;
      wind.current.style.opacity = wl ? "1" : "0";
      l.wind = wl;
    }
    const sl = w.slowmo > 0;
    if (sl !== l.slow && slow.current) {
      slow.current.style.opacity = sl ? "1" : "0";
      l.slow = sl;
    }
  });

  return (
    <Html fullscreen zIndexRange={[20, 0]} pointerEvents="none">
      <div ref={score} style={abs({ top: 40, left: "50%", transform: "translateX(-50%)", fontSize: 64, fontWeight: 900, color: "#fff", textShadow: shadow, lineHeight: 1 })}>
        0
      </div>
      <div ref={best} style={abs({ top: 108, left: 0, right: 0, textAlign: "center", fontSize: 14, fontWeight: 700, letterSpacing: "0.18em", color: "rgba(255,255,255,.75)", textShadow: shadow })}>
        BEST 0
      </div>
      <div ref={wind} style={abs({ top: 52, right: 18, fontSize: 13, fontWeight: 800, letterSpacing: "0.12em", color: "#dbeafe", textShadow: shadow, opacity: 0, transition: "opacity 300ms" })} />
      <div ref={slow} style={abs({ top: 52, left: 18, fontSize: 13, fontWeight: 800, letterSpacing: "0.12em", color: "#7dd3fc", textShadow: shadow, opacity: 0, transition: "opacity 300ms" })}>
        SLOW-MO
      </div>
      <div
        ref={prompt}
        style={abs({ bottom: "max(48px, calc(env(safe-area-inset-bottom) + 32px))", left: 0, right: 0, textAlign: "center", fontSize: 17, fontWeight: 650, color: "#fff", textShadow: shadow, transition: "opacity 300ms" })}
      />
      <div ref={pop} style={abs({ top: "38%", left: "50%", transform: "translate(-50%,-50%)", fontWeight: 900, letterSpacing: "0.04em", textShadow: shadow, opacity: 0, whiteSpace: "nowrap" })} />
      <div
        ref={over}
        style={abs({ top: "50%", left: 0, right: 0, transform: "translateY(-50%)", textAlign: "center", color: "#fff", textShadow: shadow, opacity: 0, transition: "opacity 200ms" })}
      >
        <div ref={overTitle} style={{ fontSize: 56, fontWeight: 900, letterSpacing: "0.04em" }}>
          MISSED!
        </div>
        <div ref={overSub} style={{ fontSize: 16, fontWeight: 650, opacity: 0.85, marginTop: 6 }} />
      </div>
    </Html>
  );
};
