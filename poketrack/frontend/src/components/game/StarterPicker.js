import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { GameFrame } from "./GameFrame";
import { GameButton } from "./GameButton";
import { TypeChip } from "./TypeChip";
import { partnerGradient, typeColor } from "@/lib/types";

const GENERATIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

export function StarterPicker({ starters = [], onConfirm, loading, testIdPrefix = "starter" }) {
  const [gen, setGen] = useState(1);
  const [selected, setSelected] = useState(null);
  const [opened, setOpened] = useState({}); // species_id -> boolean

  const inGen = useMemo(() => starters.filter((s) => s.generation === gen), [starters, gen]);

  const selectedMon = useMemo(() => starters.find((s) => s.species_id === selected), [starters, selected]);
  const primaryType = selectedMon?.types?.[0] || "electric";

  return (
    <div className="w-full max-w-5xl mx-auto" data-testid="starter-picker">
      <GameFrame className="p-5" tone="panel">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <p className="font-pixel text-[12px] tracking-display text-white pixel-shadow">CHOOSE YOUR PARTNER</p>
            <p className="font-body text-sm text-white/70 mt-2">Professor Oak's lab is full of Poké Balls. Pick the one you'll level up as your team ships tickets.</p>
          </div>
          <div className="flex flex-wrap gap-1">
            {GENERATIONS.map((g) => (
              <button key={g}
                onClick={() => setGen(g)}
                data-testid={`${testIdPrefix}-gen-${g}`}
                className={`px-3 py-1 rounded-chip font-pixel text-[9px] tracking-hud ring-2 ring-black/70 ${gen === g ? "bg-type-electric text-type-electric-ink" : "bg-white/10 text-white"}`}>
                GEN {g}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-3 sm:grid-cols-3 gap-4">
          {inGen.map((mon, idx) => {
            const isOpen = opened[mon.species_id] || selected === mon.species_id;
            const color = typeColor(mon.types?.[0] || "normal");
            return (
              <motion.button
                key={mon.species_id}
                onClick={() => { setOpened((s) => ({ ...s, [mon.species_id]: true })); setSelected(mon.species_id); }}
                onMouseEnter={() => setOpened((s) => ({ ...s, [mon.species_id]: true }))}
                initial={{ y: 12, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: idx * 0.05, type: "spring", stiffness: 420, damping: 32 }}
                whileHover={{ scale: 1.02 }}
                className="relative text-left group"
                data-testid={`${testIdPrefix}-ball-${mon.species_id}`}
                aria-pressed={selected === mon.species_id}
              >
                <GameFrame className="p-4" tone="panel2" style={selected === mon.species_id ? { boxShadow: `0 0 0 4px ${color}, 0 10px 0 rgba(0,0,0,0.65)` } : undefined}>
                  <div className="h-32 grid place-items-center relative">
                    {!isOpen ? (
                      <div className="relative h-24 w-24 rounded-full ring-4 ring-black bg-[linear-gradient(to_bottom,#E53935_0_50%,#F7F7FB_50%_100%)] shadow-[0_8px_0_rgba(0,0,0,0.6)]">
                        <span className="absolute left-0 top-1/2 h-[6px] w-full -translate-y-1/2 bg-black" />
                        <span className="absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white ring-4 ring-black" />
                      </div>
                    ) : (
                      <>
                        <div className="absolute inset-0 rounded-full opacity-40 blur-2xl" style={{ background: color }} />
                        <img src={mon.sprite} alt={mon.name} className="sprite h-28 w-28 object-contain relative z-10 animate-idle-bob" />
                      </>
                    )}
                  </div>
                  <div className="mt-2 font-pixel text-[10px] tracking-hud capitalize text-white pixel-shadow">{mon.label || mon.name}</div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {mon.types?.map((t) => <TypeChip key={t} type={t} size="sm" />)}
                  </div>
                </GameFrame>
              </motion.button>
            );
          })}
        </div>

        {selectedMon && (
          <motion.div
            initial={{ y: 14, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            className="mt-6"
          >
            <GameFrame className="p-6" tone="panel2" style={{ background: partnerGradient(selectedMon.types) }}>
              <div className="grid md:grid-cols-[240px_1fr] gap-6 items-center bg-black/40 backdrop-blur-[2px] p-5 rounded-frameInner">
                <div className="relative grid place-items-center">
                  <div className="absolute inset-0 rounded-full opacity-50 blur-3xl" style={{ background: typeColor(primaryType) }} />
                  <img src={selectedMon.sprite} alt={selectedMon.name} className="sprite h-40 w-40 object-contain relative z-10 animate-idle-bob drop-shadow-[0_10px_0_rgba(0,0,0,0.55)]" />
                </div>
                <div>
                  <p className="font-pixel text-[14px] tracking-display text-white capitalize pixel-shadow">{selectedMon.name}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selectedMon.types?.map((t) => <TypeChip key={t} type={t} />)}
                  </div>
                  <p className="mt-4 font-body text-sm text-white/90">Every ticket your team ships will train {selectedMon.label || selectedMon.name}. Cross an evolution level and everything on screen erupts into a full-screen cutscene.</p>
                  <div className="mt-5">
                    <GameButton
                      tone={primaryType}
                      size="lg"
                      onClick={() => onConfirm(selectedMon.species_id)}
                      disabled={loading}
                      testId="starter-confirm-button"
                    >
                      {loading ? "CHOOSING…" : `I CHOOSE YOU, ${(selectedMon.label || selectedMon.name).toUpperCase()}!`}
                    </GameButton>
                  </div>
                </div>
              </div>
            </GameFrame>
          </motion.div>
        )}
      </GameFrame>
    </div>
  );
}

export default StarterPicker;
