import React from "react";
import PokeBall from "./PokeBall";

export function PokeBallLoader({ label = "Loading", size = 48, className = "" }) {
  return (
    <div className={`inline-flex items-center gap-3 ${className}`} role="status" aria-live="polite" data-testid="pokeball-loader">
      <PokeBall size={size} className="animate-capture-wobble" />
      {label && <span className="font-body text-[13px] font-extrabold uppercase tracking-[0.07em] text-label">{label}</span>}
    </div>
  );
}

export default PokeBallLoader;
