import React from "react";

// The one illustration the UI draws itself: brand mark, loader and the closed
// balls in the starter picker. Sized by the caller; everything inside scales
// with it.
export function PokeBall({ size = 24, className = "" }) {
  return (
    <span
      aria-hidden
      style={{ width: size, height: size }}
      className={`relative inline-block shrink-0 overflow-hidden rounded-full bg-[linear-gradient(to_bottom,var(--ball-top)_0_50%,var(--ball-bottom)_50%_100%)] ${className}`}
    >
      <span className="absolute left-0 top-1/2 w-full -translate-y-1/2 bg-[var(--ball-band)]" style={{ height: Math.max(2, size * 0.1) }} />
      <span
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--ball-bottom)]"
        style={{ width: size * 0.36, height: size * 0.36, boxShadow: `0 0 0 ${Math.max(2, size * 0.08)}px var(--ball-band)` }}
      />
    </span>
  );
}

export default PokeBall;
