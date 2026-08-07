import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useReducedMotionMedia } from "@/lib/motion";

// LEVEL UP! banner that slams in with optional screen shake.
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
          initial={{ y: -20, opacity: 0, scale: 0.9 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: -12, opacity: 0 }}
          transition={{ type: "spring", stiffness: 760, damping: 26 }}
          className="pointer-events-none fixed left-1/2 top-16 z-[80] -translate-x-1/2"
          data-testid="level-up-banner"
        >
          <div className="relative rounded-[16px] bg-white text-black ring-4 ring-black shadow-frame px-6 py-3 font-pixel text-[12px] tracking-display">
            LEVEL UP! <span className="text-type-fire">LV {level}</span>
            <div className="pointer-events-none absolute inset-0 rounded-[16px]"
              style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.5), rgba(255,255,255,0) 60%)" }} />
            {!reduce && Array.from({ length: 10 }).map((_, i) => (
              <span key={i}
                className="absolute top-1/2 left-1/2 h-1 w-1 rounded-full bg-yellow-300 animate-ray-burst"
                style={{ transform: `rotate(${i * 36}deg) translate(30px)`, animationDelay: `${i * 40}ms` }}
              />
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default LevelUpBanner;
