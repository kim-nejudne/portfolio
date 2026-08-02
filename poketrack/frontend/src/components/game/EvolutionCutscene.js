import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import DialogueBox from "./DialogueBox";
import { GameButton } from "./GameButton";
import { useReducedMotionMedia } from "@/lib/motion";
import { typeColor } from "@/lib/types";

// Full-screen evolution cutscene. Old sprite silhouettes and cross-fades to new sprite, with flashes, rays, confetti, dialogue.
export function EvolutionCutscene({ open, fromMon, toMon, onDone }) {
  const reduce = useReducedMotionMedia();
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onDone && onDone(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onDone]);

  const color = typeColor((toMon?.types || ["electric"])[0] || "electric");

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-sm grid place-items-center px-4"
          data-testid="evolution-cutscene"
          role="dialog"
          aria-modal="true"
        >
          {/* aurora backdrop */}
          <div className="pointer-events-none absolute inset-0"
            style={{ background: `radial-gradient(60% 40% at 50% 50%, ${color}55, transparent 70%)` }} />

          {/* rays */}
          {!reduce && (
            <div className="pointer-events-none absolute inset-0 grid place-items-center">
              <div className="h-[120vmax] w-[120vmax] animate-ray-burst opacity-70"
                style={{ background: `conic-gradient(from 0deg, rgba(255,255,255,0.0), ${color}88, rgba(255,255,255,0.0) 25%, ${color}88 50%, rgba(255,255,255,0.0) 75%, ${color}88)` }} />
            </div>
          )}

          {/* stage */}
          <div className="relative z-10 grid place-items-center">
            <div className="relative h-56 w-56 grid place-items-center">
              {/* old sprite */}
              <motion.img
                src={fromMon?.sprite}
                alt={fromMon?.name}
                className="sprite absolute h-40 w-40 object-contain"
                initial={{ opacity: 1 }}
                animate={reduce ? { opacity: 0 } : { opacity: [1, 1, 0.2, 0, 0, 0], filter: ["brightness(1)", "brightness(3)", "brightness(12)", "brightness(12)", "brightness(12)", "brightness(12)"], scale: [1, 1.05, 1.1, 1.15, 1.15, 1.1] }}
                transition={{ duration: 2.2, times: [0, 0.35, 0.5, 0.7, 0.9, 1] }}
              />
              {/* new sprite */}
              <motion.img
                src={toMon?.sprite}
                alt={toMon?.name}
                className="sprite absolute h-40 w-40 object-contain"
                initial={{ opacity: 0, scale: 1.05, filter: "brightness(12)" }}
                animate={reduce ? { opacity: 1, filter: "brightness(1)" } : { opacity: [0, 0, 0, 0.4, 1, 1], scale: [1.05, 1.05, 1.1, 1.1, 1.05, 1], filter: ["brightness(12)", "brightness(12)", "brightness(12)", "brightness(6)", "brightness(1.4)", "brightness(1)"] }}
                transition={{ duration: 2.4, times: [0, 0.3, 0.5, 0.7, 0.9, 1] }}
              />
              {/* flash */}
              {!reduce && (
                <motion.div
                  className="absolute inset-0 rounded-full bg-white"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0, 0.9, 0, 0.9, 0, 0.9, 0] }}
                  transition={{ duration: 2.2, times: [0, 0.2, 0.35, 0.5, 0.65, 0.8, 1] }}
                />
              )}
              {/* shadow ellipse */}
              <span className="absolute -bottom-6 h-3 w-40 rounded-full bg-black/60 blur-md" />
            </div>
          </div>

          {/* dialogue */}
          <motion.div
            className="relative z-20 mt-6 w-[min(720px,92vw)]"
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: reduce ? 0 : 2.2, duration: 0.4 }}
          >
            <DialogueBox
              text={`CONGRATULATIONS! YOUR ${String(fromMon?.name || "POKÉMON").toUpperCase()} EVOLVED INTO ${String(toMon?.name || "POKÉMON").toUpperCase()}!`}
            />
            <div className="mt-3 flex justify-end">
              <GameButton tone={(toMon?.types || ["electric"])[0]} onClick={onDone} testId="evolution-cutscene-continue-button">CONTINUE ▶</GameButton>
            </div>
          </motion.div>

          {/* confetti particles */}
          {!reduce && Array.from({ length: 30 }).map((_, i) => (
            <motion.span
              key={i}
              className="absolute rounded-sm"
              initial={{ opacity: 0, x: 0, y: 0 }}
              animate={{ opacity: [0, 1, 0], x: (Math.random() - 0.5) * 800, y: (Math.random() - 0.5) * 400, rotate: Math.random() * 360 }}
              transition={{ delay: 2.0 + Math.random() * 0.3, duration: 1.6, ease: "easeOut" }}
              style={{ left: "50%", top: "45%", width: 8, height: 12, background: ["#F7D02C", "#EE8130", "#7AC74C", "#6390F0", "#F95587"][i % 5] }}
            />
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default EvolutionCutscene;
