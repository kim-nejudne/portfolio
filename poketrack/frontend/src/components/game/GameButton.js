import React from "react";
import { classNames } from "@/lib/motion";
import { typeColor, readableInk } from "@/lib/types";

// 3D pressable game button. Colored face, dark rim, hard bottom edge that compresses on active.
export function GameButton({
  children,
  onClick,
  type = "button",
  variant = "primary",
  tone,             // an optional Pokémon type name for primary; drives glow
  size = "md",
  disabled,
  className = "",
  testId,
  as = "button",
  ...rest
}) {
  const face = variant === "primary" ? typeColor(tone || "electric") : variant === "danger" ? "#C22E28" : "rgba(255,255,255,0.10)";
  const ink = variant === "primary" ? readableInk(face) : variant === "danger" ? "#F7F7FB" : "#EAF0FF";
  const glow = variant === "primary" ? face : variant === "danger" ? "#C22E28" : "rgba(255,255,255,0.4)";
  const sizes = {
    sm: "px-3 py-2 text-[9px]",
    md: "px-4 py-3 text-[10px]",
    lg: "px-5 py-4 text-[12px]",
  };
  const Tag = as;
  return (
    <Tag
      type={as === "button" ? type : undefined}
      data-testid={testId}
      onClick={onClick}
      disabled={disabled}
      style={{ background: face, color: ink, boxShadow: `0 6px 0 rgba(0,0,0,0.75), 0 10px 18px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.25)`, "--glow": glow }}
      className={classNames(
        "relative inline-flex items-center justify-center select-none rounded-[12px] font-pixel tracking-wide outline-none",
        "ring-2 ring-black/70",
        "transition-[filter,transform,box-shadow] duration-150",
        "hover:brightness-110 hover:-translate-y-[1px]",
        "active:translate-y-[3px] active:shadow-[0_2px_0_rgba(0,0,0,0.75),0_6px_10px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.18)]",
        "disabled:opacity-60 disabled:pointer-events-none",
        sizes[size] || sizes.md,
        className
      )}
      {...rest}
    >
      <span className="pointer-events-none absolute inset-0 rounded-[12px]"
        style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.18), rgba(255,255,255,0) 40%, rgba(0,0,0,0.15))" }} />
      <span className="relative z-10 whitespace-nowrap flex items-center gap-2">{children}</span>
    </Tag>
  );
}

export default GameButton;
