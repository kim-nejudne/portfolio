import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useReducedMotionMedia } from "@/lib/motion";

// One smooth rounded fill that eases to its new width whenever XP arrives.
// `needed` of 0 means the engine has no next level to report (level cap).
export function XPBar({
  level,
  current = 0,
  needed = 0,
  totalXp = 0,
  animateKey = 0,   // increment when a new XP event has arrived to re-run the fill animation
  testId = "partner-xp-bar",
}) {
  const reduce = useReducedMotionMedia();
  const maxed = !(needed > 0);
  const fill = maxed ? 1 : Math.max(0, Math.min(1, current / needed));
  const [displayFill, setDisplayFill] = useState(fill);
  const raf = useRef(null);

  useEffect(() => {
    if (reduce) { setDisplayFill(fill); return; }
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

  const remaining = Math.max(0, needed - current);
  const label = maxed
    ? `Level ${level}, maximum level reached`
    : `Level ${level}: ${current.toLocaleString()} of ${needed.toLocaleString()} XP, ${remaining.toLocaleString()} to level ${level + 1}`;

  return (
    <div data-testid={testId} className="flex flex-col gap-2.5">
      <div className="flex items-end justify-between gap-3">
        <div className="flex items-baseline gap-1.5">
          <span className="font-body text-[14px] font-extrabold text-muted">Lv</span>
          <motion.span
            key={level}
            initial={reduce ? {} : { scale: 1.25, y: -4 }}
            animate={{ scale: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 620, damping: 22 }}
            className="font-display text-[44px] font-bold leading-none text-fg"
            data-testid="partner-level-text"
          >
            {level}
          </motion.span>
        </div>
        <span className="pb-1 font-body text-[14px] font-semibold text-muted" data-testid="partner-total-xp">
          {totalXp.toLocaleString()} XP total
        </span>
      </div>
      <div role="img" aria-label={label} className="h-[22px] rounded-chip bg-[var(--xp-track)] p-1">
        <div
          className="h-full rounded-chip bg-[var(--xp-fill)] shadow-[0_0_12px_var(--xp-glow)]"
          // Any progress at all shows at least a round dot; a rounded bar
          // narrower than it is tall collapses into a smear.
          style={{ width: `${displayFill * 100}%`, minWidth: displayFill > 0 ? 14 : 0 }}
        />
      </div>
      <div className="flex justify-between gap-3 font-body text-[13px] font-semibold text-muted" aria-hidden>
        <span data-testid="partner-xp-progress">
          {maxed ? "Max level" : `${current.toLocaleString()} / ${needed.toLocaleString()} XP`}
        </span>
        {!maxed && <span>{remaining.toLocaleString()} to Lv {level + 1}</span>}
      </div>
    </div>
  );
}

export default XPBar;
