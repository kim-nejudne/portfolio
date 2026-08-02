import React from "react";
import { classNames } from "@/lib/motion";

// The universal HUD panel. Chunky beveled border, corner rivets, gloss + scanlines overlay.
export function GameFrame({ children, className = "", tone = "panel", rivets = true, testId, style }) {
  const bg = tone === "panel2" ? "bg-game-panel2" : "bg-game-panel";
  return (
    <div
      data-testid={testId}
      style={style}
      className={classNames(
        "relative rounded-frame text-game-ink shadow-frame outline outline-4 outline-game-outline outline-offset-2 overflow-hidden",
        bg,
        "border border-white/10",
        className
      )}
    >
      {/* gloss */}
      <div className="pointer-events-none absolute inset-0 rounded-frame"
        style={{ background: "radial-gradient(120% 80% at 50% 0%, rgba(255,255,255,0.22), rgba(255,255,255,0) 45%)" }} />
      {/* scanlines */}
      <div className="pointer-events-none absolute inset-0 rounded-frame bg-scanlines opacity-20 mix-blend-overlay" />
      {rivets && (
        <>
          <span className="absolute left-2 top-2 h-2 w-2 rounded-full bg-white/40 shadow-[0_0_0_2px_rgba(0,0,0,0.65)]" />
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-white/40 shadow-[0_0_0_2px_rgba(0,0,0,0.65)]" />
          <span className="absolute left-2 bottom-2 h-2 w-2 rounded-full bg-white/40 shadow-[0_0_0_2px_rgba(0,0,0,0.65)]" />
          <span className="absolute right-2 bottom-2 h-2 w-2 rounded-full bg-white/40 shadow-[0_0_0_2px_rgba(0,0,0,0.65)]" />
        </>
      )}
      <div className="relative rounded-frameInner">{children}</div>
    </div>
  );
}

export default GameFrame;
