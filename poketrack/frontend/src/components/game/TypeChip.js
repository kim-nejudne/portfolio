import React from "react";
import { typeColor, readableInk } from "@/lib/types";

export function TypeChip({ type, size = "md", className = "", testId }) {
  const color = typeColor(type);
  const ink = readableInk(color);
  const sizes = size === "sm" ? "text-[8px] px-2 py-0.5" : "text-[9px] px-3 py-1";
  return (
    <span
      data-testid={testId}
      style={{ background: color, color: ink, boxShadow: `0 0 0 2px rgba(255,255,255,0.08), 0 0 18px color-mix(in srgb, ${color} 55%, transparent)` }}
      className={`inline-flex items-center gap-1 rounded-chip font-pixel tracking-wide ring-2 ring-black/70 uppercase ${sizes} ${className}`}
    >
      {type}
    </span>
  );
}

export default TypeChip;
