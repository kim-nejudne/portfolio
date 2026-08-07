import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GameFrame } from "./GameFrame";
import { GameButton } from "./GameButton";
import { TypeChip } from "./TypeChip";
import { partnerGradient } from "@/lib/types";

export function BranchChoiceModal({ open, options = [], onChoose, onCancel }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onCancel && onCancel(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[90] bg-black/80 backdrop-blur-sm px-4 py-8 overflow-y-auto"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          data-testid="branch-choice-modal"
          role="dialog" aria-modal="true"
        >
          <div className="mx-auto max-w-6xl">
            <div className="text-center mb-4">
              <p className="font-pixel text-[12px] tracking-display text-white/90 pixel-shadow">CHOOSE YOUR EVOLUTION!</p>
              <p className="font-body text-sm text-white/70 mt-2">Your partner is ready to evolve. Pick a path — this choice is permanent (until XP reversals!).</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {options.map((mon, i) => (
                <motion.button
                  key={mon.species_id}
                  onClick={() => onChoose(mon.species_id)}
                  initial={{ y: 16, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.05 * i, type: "spring", stiffness: 420, damping: 32 }}
                  whileHover={{ scale: 1.05, y: -4 }}
                  className="text-left"
                  data-testid={`branch-option-${mon.species_id}`}
                >
                  <GameFrame className="h-full" tone="panel2" style={{ background: partnerGradient(mon.types) }}>
                    <div className="p-4 backdrop-blur-[2px] bg-black/25">
                      <div className="grid place-items-center h-32">
                        <img src={mon.sprite} alt={mon.name} className="sprite h-28 w-28 object-contain drop-shadow-[0_6px_0_rgba(0,0,0,0.5)] animate-idle-bob" />
                      </div>
                      <div className="mt-2 font-pixel text-[11px] tracking-display capitalize text-white pixel-shadow">{mon.name}</div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {mon.types.map((t) => <TypeChip key={t} type={t} size="sm" />)}
                      </div>
                    </div>
                  </GameFrame>
                </motion.button>
              ))}
            </div>
            {onCancel && (
              <div className="mt-6 text-center">
                <GameButton variant="secondary" onClick={onCancel} testId="branch-choice-cancel">Not now</GameButton>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default BranchChoiceModal;
