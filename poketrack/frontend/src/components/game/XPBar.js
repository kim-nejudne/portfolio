import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { typeColor } from "@/lib/types";
import { useReducedMotionMedia } from "@/lib/motion";

// Segmented XP bar with tick fill animation and a shine sweep. It also owns the LEVEL UP! banner + screen shake.
export function XPBar({
  level,
  types = ["water"],
  current = 0,
  needed = 1,
  totalXp = 0,
  animateKey = 0,   // increment when a new XP event has arrived to re-run the fill animation
  testId = "partner-xp-bar",
}) {
  const reduce = useReducedMotionMedia();
  const fill = Math.max(0, Math.min(1, needed > 0 ? current / needed : 1));
  const [displayFill, setDisplayFill] = useState(fill);
  const raf = useRef(null);

  useEffect(() => {
    if (reduce) { setDisplayFill(fill); return; }
    // Tick from current display value to target over ~800ms
    const startVal = displayFill;
    const startTs = performance.now();
    const dur = 900;
    const step = (ts) => {
      const t = Math.min(1, (ts - startTs) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplayFill(startVal + (fill - startVal) * eased);
      if (t < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [animateKey, fill, reduce]); // eslint-disable-line

  const color = typeColor(types[0] || "water");
  return (
    <div data-testid={testId} className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <span className="font-pixel text-[10px] tracking-display text-white/80">LV</span>
          <motion.span
            key={level}
            initial={reduce ? {} : { scale: 1.4, y: -6 }}
            animate={{ scale: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 620, damping: 22 }}
            className="font-pixel text-3xl text-white pixel-shadow"
            data-testid="partner-level-text"
          >
            {level}
          </motion.span>
        </div>
        <span className="font-pixel text-[9px] tracking-hud text-white/70" data-testid="partner-total-xp">{totalXp.toLocaleString()} XP</span>
      </div>
      <div className="relative rounded-[14px] bg-black/50 ring-2 ring-black/70 shadow-frameSm overflow-hidden">
        <div className="grid grid-cols-12 gap-[3px] p-[6px]">
          {Array.from({ length: 12 }).map((_, i) => {
            const segStart = i / 12;
            const segEnd = (i + 1) / 12;
            const seg = Math.max(0, Math.min(1, (displayFill - segStart) / (segEnd - segStart)));
            return (
              <div key={i} className="relative h-3 rounded-[6px] bg-white/10 overflow-hidden">
                <div className="absolute inset-0 origin-left transition-transform duration-150 ease-out"
                  style={{ background: color, transform: `scaleX(${seg})` }} />
                <div className="pointer-events-none absolute inset-y-0 -left-1/2 w-2/3 opacity-70"
                  style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent)", animation: "shine-sweep 2s ease-in-out infinite" }} />
              </div>
            );
          })}
        </div>
      </div>
      <div className="flex justify-between font-pixel text-[8px] tracking-hud text-white/70">
        <span data-testid="partner-xp-progress">{current.toLocaleString()} / {needed.toLocaleString()}</span>
        <span>NEXT LV</span>
      </div>
    </div>
  );
}

export default XPBar;
