import React from "react";
import { classNames } from "@/lib/motion";

// The universal panel: a rounded surface with no border, sitting on a solid
// offset shadow. `tone` picks the surface, `shape` the corner radius — page
// panels are 28px, cards nested inside them 20px.
const TONES = {
  surface: "bg-surface",
  raised: "bg-surface-raised",
  sunken: "bg-surface-sunken",
};

export function GameFrame({ children, className = "", tone = "surface", shape = "panel", testId, style }) {
  return (
    <div
      data-testid={testId}
      style={style}
      className={classNames(
        "relative text-fg",
        shape === "card" ? "rounded-card shadow-hard" : "rounded-panel shadow-hard-lg",
        TONES[tone] || TONES.surface,
        className
      )}
    >
      {children}
    </div>
  );
}

export default GameFrame;
