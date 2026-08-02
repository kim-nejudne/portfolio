import React from "react";
import { motion } from "framer-motion";
import { GameFrame } from "./GameFrame";
import { GameButton } from "./GameButton";
import { TypeChip } from "./TypeChip";
import { XPBar } from "./XPBar";
import { partnerGradient, typeColor } from "@/lib/types";

export function PartnerPanel({ mon, animateKey, onEvolveClick, onPrestigeClick }) {
  if (!mon) return null;
  const primaryType = (mon.types || ["electric"])[0];
  const sprite = mon.is_shiny ? (mon.shiny_sprite_url || mon.sprite_url) : mon.sprite_url;

  let nextHintText = "";
  if (mon.next_hint?.kind === "final") nextHintText = "final form";
  else if (mon.pending_evolution) nextHintText = "ready to evolve!";
  else if (mon.next_hint?.kind === "gated") nextHintText = `evolves at LV ${mon.next_hint.at_level}`;
  else if (mon.next_hint?.kind === "ready") nextHintText = "ready to evolve!";

  const fullyEvolved = mon.stage_index === mon.total_stages;

  return (
    <GameFrame className="p-0 overflow-hidden" testId="partner-panel" tone="panel">
      <div className="relative p-5" style={{ background: partnerGradient(mon.types) }}>
        <div className="absolute inset-0 bg-black/40" />
        <div className="relative flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <p className="font-pixel text-[11px] tracking-display text-white capitalize pixel-shadow" data-testid="partner-species-name">{mon.species_name}</p>
              {mon.is_shiny && <span className="font-pixel text-[10px] px-2 py-0.5 rounded-chip bg-yellow-300 text-black ring-2 ring-black/60" data-testid="shiny-badge">✨ SHINY</span>}
              {mon.prestige > 0 && <span className="font-pixel text-[9px] px-2 py-0.5 rounded-chip bg-white text-black ring-2 ring-black/60" data-testid="prestige-badge">⭐×{mon.prestige}</span>}
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {mon.types.map((t) => <TypeChip key={t} type={t} size="sm" />)}
            </div>
          </div>
          <div className="font-pixel text-[9px] text-white/80 pixel-shadow">{nextHintText}</div>
        </div>

        <div className="relative mt-4 grid place-items-center h-40">
          <div className="absolute inset-0 rounded-full opacity-50 blur-3xl" style={{ background: typeColor(primaryType) }} />
          <motion.img
            key={mon.current_species_id + (mon.is_shiny ? "-shiny" : "")}
            src={sprite}
            alt={mon.species_name}
            className="sprite h-40 w-40 object-contain relative z-10 animate-idle-bob drop-shadow-[0_10px_0_rgba(0,0,0,0.55)]"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 420, damping: 22 }}
            data-testid="partner-sprite"
          />
          <span className="absolute bottom-2 h-3 w-24 rounded-full bg-black/50 blur" />
        </div>
      </div>

      <div className="p-5 pt-4 space-y-4">
        <XPBar
          level={mon.level}
          types={mon.types}
          current={mon.xp_progress_current}
          needed={mon.xp_progress_needed || 1}
          totalXp={mon.total_xp}
          animateKey={animateKey}
        />

        {mon.pending_evolution && (
          <GameButton tone={primaryType} onClick={onEvolveClick} testId="partner-evolve-button">CHOOSE EVOLUTION →</GameButton>
        )}
        {fullyEvolved && !mon.pending_evolution && (
          <GameButton tone="psychic" onClick={onPrestigeClick} testId="partner-prestige-button">PRESTIGE → START OVER</GameButton>
        )}

        {mon.evolutions_history?.length > 0 && (
          <div>
            <p className="font-pixel text-[9px] tracking-hud text-white/60 mb-2">EVOLUTION HISTORY</p>
            <ul className="space-y-2" data-testid="evolution-history">
              {mon.evolutions_history.map((h, i) => (
                <li key={i} className="flex items-center gap-3 text-sm font-body text-white/90">
                  <span className="font-pixel text-[9px] tracking-hud text-type-electric">LV {h.at_level}</span>
                  <img src={h.from.sprite} className="sprite h-8 w-8" alt={h.from.name} />
                  <span className="capitalize">{h.from.name}</span>
                  <span className="opacity-60">→</span>
                  <img src={h.to.sprite} className="sprite h-8 w-8" alt={h.to.name} />
                  <span className="capitalize">{h.to.name}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </GameFrame>
  );
}

export default PartnerPanel;
