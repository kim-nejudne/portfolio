import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GameButton } from "./GameButton";
import { TypeChip } from "./TypeChip";
import { typeTint } from "@/lib/types";

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
          className="fixed inset-0 z-[90] overflow-y-auto bg-[color-mix(in_srgb,var(--bg)_92%,transparent)] px-4 py-8"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          data-testid="branch-choice-modal"
          role="dialog" aria-modal="true" aria-labelledby="branch-choice-heading"
        >
          <div className="mx-auto max-w-6xl">
            <div className="mb-6 text-center">
              <p className="font-body text-[13px] font-extrabold uppercase tracking-[0.07em] text-label">Evolution</p>
              <h2 id="branch-choice-heading" className="mt-1 font-display text-[32px] font-bold text-fg">Choose your evolution</h2>
              <p className="mx-auto mt-2 max-w-xl font-body text-[15px] text-muted">Your partner is ready to evolve. Pick a path — this choice is permanent (until XP reversals!).</p>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
              {options.map((mon, i) => (
                <motion.button
                  key={mon.species_id}
                  type="button"
                  onClick={() => onChoose(mon.species_id)}
                  initial={{ y: 16, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.05 * i, type: "spring", stiffness: 420, damping: 32 }}
                  className="flex flex-col rounded-card bg-surface-raised p-4 text-left shadow-hard-lg transition-transform duration-150 hover:-translate-y-0.5 motion-reduce:hover:translate-y-0"
                  data-testid={`branch-option-${mon.species_id}`}
                >
                  <div className="mx-auto grid h-32 w-32 place-items-center rounded-full" style={{ background: typeTint(mon.types?.[0], 22) }}>
                    <img src={mon.sprite} alt="" className="sprite h-28 w-28 object-contain animate-idle-bob" />
                  </div>
                  <div className="mt-3 font-display text-[20px] font-bold capitalize text-fg">{mon.name}</div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {mon.types.map((t) => <TypeChip key={t} type={t} size="sm" />)}
                  </div>
                </motion.button>
              ))}
            </div>
            {onCancel && (
              <div className="mt-8 text-center">
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
