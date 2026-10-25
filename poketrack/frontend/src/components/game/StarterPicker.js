import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { GameFrame } from "./GameFrame";
import { GameButton } from "./GameButton";
import { TypeChip } from "./TypeChip";
import PokeBall from "./PokeBall";
import { typeColor, typeTint } from "@/lib/types";

const GENERATIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

export function StarterPicker({ starters = [], onConfirm, loading, testIdPrefix = "starter" }) {
  const [gen, setGen] = useState(1);
  const [selected, setSelected] = useState(null);
  const [opened, setOpened] = useState({}); // species_id -> boolean

  const inGen = useMemo(() => starters.filter((s) => s.generation === gen), [starters, gen]);

  const selectedMon = useMemo(() => starters.find((s) => s.species_id === selected), [starters, selected]);
  const selectedName = selectedMon ? String(selectedMon.label || selectedMon.name) : "";
  const shoutName = selectedName.charAt(0).toUpperCase() + selectedName.slice(1);

  return (
    <div className="mx-auto w-full max-w-5xl" data-testid="starter-picker">
      <GameFrame className="p-5 sm:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-display text-[24px] font-bold text-fg">Choose your partner</h2>
            <p className="mt-1 font-body text-[15px] text-muted">Professor Oak's lab is full of Poké Balls. Pick the one you'll level up as your team ships tickets.</p>
          </div>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Generation">
            {GENERATIONS.map((g) => (
              <button key={g} type="button"
                onClick={() => setGen(g)}
                aria-pressed={gen === g}
                data-testid={`${testIdPrefix}-gen-${g}`}
                className={`h-9 whitespace-nowrap rounded-chip px-3 font-body text-[14px] font-extrabold ${gen === g ? "bg-accent text-accent-ink" : "bg-surface-sunken text-tab hover:text-fg"}`}>
                Gen {g}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 min-[420px]:grid-cols-3">
          {inGen.map((mon, idx) => {
            const isOpen = opened[mon.species_id] || selected === mon.species_id;
            const isSelected = selected === mon.species_id;
            return (
              <motion.button
                key={mon.species_id}
                type="button"
                onClick={() => { setOpened((s) => ({ ...s, [mon.species_id]: true })); setSelected(mon.species_id); }}
                onMouseEnter={() => setOpened((s) => ({ ...s, [mon.species_id]: true }))}
                initial={{ y: 12, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: idx * 0.05, type: "spring", stiffness: 420, damping: 32 }}
                className="rounded-card bg-surface-sunken p-4 text-left shadow-hard transition-transform duration-150 hover:-translate-y-0.5 motion-reduce:hover:translate-y-0"
                style={isSelected ? { boxShadow: `inset 0 0 0 3px ${typeColor(mon.types?.[0])}, 0 2px 0 var(--shadow-hard)` } : undefined}
                data-testid={`${testIdPrefix}-ball-${mon.species_id}`}
                aria-pressed={isSelected}
              >
                <div className="relative grid h-32 place-items-center">
                  {!isOpen ? (
                    <PokeBall size={88} />
                  ) : (
                    <div className="grid h-32 w-32 place-items-center rounded-full" style={{ background: typeTint(mon.types?.[0], 22) }}>
                      <img src={mon.sprite} alt="" className="sprite h-28 w-28 object-contain animate-idle-bob" />
                    </div>
                  )}
                </div>
                <div className="mt-3 font-display text-[18px] font-semibold capitalize text-fg">{mon.label || mon.name}</div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {mon.types?.map((t) => <TypeChip key={t} type={t} size="sm" />)}
                </div>
              </motion.button>
            );
          })}
        </div>

        {selectedMon && (
          <motion.div
            initial={{ y: 14, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            className="mt-6 grid items-center gap-6 rounded-hero bg-hero p-5 md:grid-cols-[200px_1fr]"
          >
            <div className="mx-auto grid h-[176px] w-[176px] place-items-center rounded-full bg-hero-sprite">
              <img src={selectedMon.sprite} alt={selectedMon.name} className="sprite h-40 w-40 object-contain animate-idle-bob" />
            </div>
            <div>
              <p className="font-display text-[28px] font-bold capitalize text-fg">{selectedMon.name}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {selectedMon.types?.map((t) => <TypeChip key={t} type={t} />)}
              </div>
              <p className="mt-4 font-body text-[15px] text-fg">Every ticket your team ships will train {selectedMon.label || selectedMon.name}. Cross an evolution level and everything on screen erupts into a full-screen cutscene.</p>
              <div className="mt-5">
                <GameButton
                  size="lg"
                  className="max-w-full"
                  onClick={() => onConfirm(selectedMon.species_id)}
                  disabled={loading}
                  testId="starter-confirm-button"
                >
                  {loading ? "Choosing…" : `I choose you, ${shoutName}!`}
                </GameButton>
              </div>
            </div>
          </motion.div>
        )}
      </GameFrame>
    </div>
  );
}

export default StarterPicker;
