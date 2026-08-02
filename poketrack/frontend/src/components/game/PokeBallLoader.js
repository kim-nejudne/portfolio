import React from "react";

export function PokeBallLoader({ label = "LOADING", size = 48, className = "" }) {
  return (
    <div className={`inline-flex items-center gap-3 ${className}`} role="status" aria-live="polite" data-testid="pokeball-loader">
      <div
        style={{ width: size, height: size }}
        className="relative rounded-full ring-4 ring-black bg-[linear-gradient(to_bottom,#E53935_0_50%,#F7F7FB_50%_100%)] animate-capture-wobble shadow-[0_10px_18px_rgba(0,0,0,0.55)]"
      >
        <span className="absolute left-0 top-1/2 h-[6px] w-full -translate-y-1/2 bg-black" />
        <span className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#F7F7FB] ring-4 ring-black" />
      </div>
      {label && <span className="font-pixel text-[10px] tracking-wider text-game-ink pixel-shadow">{label}</span>}
    </div>
  );
}

export default PokeBallLoader;
