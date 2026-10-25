import React from "react";
import { typeColor, typeInk } from "@/lib/types";

export function TypeChip({ type, size = "md", className = "", testId }) {
  const sizes = size === "sm" ? "text-[12px] px-2.5 py-0.5" : "text-[13px] px-3 py-1";
  return (
    <span
      data-testid={testId}
      style={{ background: typeColor(type), color: typeInk(type) }}
      className={`inline-flex items-center rounded-chip font-body font-extrabold capitalize ${sizes} ${className}`}
    >
      {type}
    </span>
  );
}

export default TypeChip;
