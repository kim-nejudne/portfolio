import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useReducedMotionMedia } from "@/lib/motion";

// "Level up!" pill that pops in under the top bar.
export function LevelUpBanner({ level, visible, onDone }) {
  const reduce = useReducedMotionMedia();
  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => onDone && onDone(), 1600);
    return () => clearTimeout(t);
  }, [visible, onDone]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key={level}
          initial={reduce ? { opacity: 0 } : { y: -20, opacity: 0, scale: 0.9 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: reduce ? 0 : -12, opacity: 0 }}
          transition={{ type: "spring", stiffness: 760, damping: 26 }}
          className="pointer-events-none fixed left-1/2 top-20 z-[80] -translate-x-1/2"
          data-testid="level-up-banner"
          role="status"
        >
          <div className="relative whitespace-nowrap rounded-chip bg-accent px-6 py-3 font-display text-[20px] font-bold text-accent-ink shadow-[0_4px_0_var(--accent-shadow)]">
            Level up! <span className="ml-1 rounded-chip bg-accent-ink px-2.5 py-0.5 text-[16px] text-accent">Lv {level}</span>
            {!reduce && Array.from({ length: 10 }).map((_, i) => (
              <span key={i}
                className="absolute left-1/2 top-1/2 h-1.5 w-1.5 rounded-full bg-[var(--pts-5-bg)] animate-ray-burst"
                style={{ transform: `rotate(${i * 36}deg) translate(40px)`, animationDelay: `${i * 40}ms` }}
              />
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default LevelUpBanner;
