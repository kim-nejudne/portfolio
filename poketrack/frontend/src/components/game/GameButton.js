import React from "react";
import { classNames } from "@/lib/motion";

// A pressable pill. The depth is a solid offset shadow in a darker tint of the
// face; pressing moves the face down by 2px and shrinks the shadow by the same
// amount, so the button reads as pushed in rather than sliding.
const VARIANTS = {
  accent:    { face: "var(--accent)",         ink: "var(--accent-ink)",   edge: "var(--accent-shadow)" },
  success:   { face: "var(--success)",        ink: "var(--success-ink)",  edge: "var(--success-shadow)" },
  prestige:  { face: "var(--prestige)",       ink: "var(--prestige-ink)", edge: "var(--prestige-shadow)" },
  danger:    { face: "var(--danger)",         ink: "var(--danger-ink)",   edge: "var(--danger-shadow)" },
  secondary: { face: "var(--surface-raised)", ink: "var(--text)",         edge: "var(--shadow-hard)" },
};

const SIZES = {
  sm: "h-10 px-4 text-[14px]",
  md: "h-[50px] px-6 text-[15px]",
  lg: "h-14 px-7 text-[16px]",
};

export function GameButton({
  children,
  onClick,
  type = "button",
  variant = "accent",
  size = "md",
  disabled,
  className = "",
  testId,
  as = "button",
  ...rest
}) {
  const v = VARIANTS[variant] || VARIANTS.accent;
  const Tag = as;
  return (
    <Tag
      type={as === "button" ? type : undefined}
      data-testid={testId}
      onClick={onClick}
      disabled={disabled}
      style={{ background: v.face, color: v.ink, "--edge": v.edge }}
      className={classNames(
        "relative inline-flex items-center justify-center gap-2 select-none whitespace-nowrap rounded-chip font-body font-extrabold",
        "shadow-[0_4px_0_var(--edge)] transition-[transform,box-shadow,filter] duration-100 ease-out",
        "hover:brightness-105",
        "active:translate-y-[2px] active:shadow-[0_2px_0_var(--edge)]",
        "motion-reduce:active:translate-y-0",
        "disabled:opacity-50 disabled:pointer-events-none",
        SIZES[size] || SIZES.md,
        className
      )}
      {...rest}
    >
      {children}
    </Tag>
  );
}

export default GameButton;
