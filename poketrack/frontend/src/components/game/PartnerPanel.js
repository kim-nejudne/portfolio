import React from "react";
import { motion } from "framer-motion";
import { GameButton } from "./GameButton";
import { TypeChip } from "./TypeChip";
import { XPBar } from "./XPBar";
import { ArrowRight, Restart, Sparkle, Star } from "./Icons";

export function PartnerPanel({ mon, animateKey, onEvolveClick, onPrestigeClick }) {
  if (!mon) return null;
  const sprite = mon.is_shiny ? (mon.shiny_sprite_url || mon.sprite_url) : mon.sprite_url;

  let hint = "";
  if (mon.pending_evolution || mon.next_hint?.kind === "ready") hint = "Ready to evolve";
  else if (mon.next_hint?.kind === "final") hint = "Final form";
  else if (mon.next_hint?.kind === "gated") hint = `Evolves at Lv ${mon.next_hint.at_level}`;

  const fullyEvolved = mon.stage_index === mon.total_stages;

  return (
    <section className="flex flex-col gap-4 rounded-panel bg-surface p-5 shadow-hard-lg" data-testid="partner-panel" aria-label="Partner">
      <div className="relative rounded-hero bg-hero p-4">
        {/* Wraps rather than overlaps: at the panel's 300px floor a long
            name and an "Evolves at Lv 36" pill do not fit on one line. */}
        <div className="flex flex-wrap-reverse items-start justify-between gap-x-3 gap-y-2">
          <div className="min-w-0">
            <h2 className="break-words font-display text-[24px] font-bold capitalize leading-tight text-fg" data-testid="partner-species-name">{mon.species_name}</h2>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {mon.types.map((t) => <TypeChip key={t} type={t} size="sm" />)}
              {mon.is_shiny && (
                <span className="inline-flex items-center gap-1 rounded-chip bg-[var(--pts-5-bg)] px-2.5 py-0.5 font-body text-[12px] font-extrabold text-[var(--pts-5-ink)]" data-testid="shiny-badge">
                  <Sparkle className="h-3.5 w-3.5" /> Shiny
                </span>
              )}
              {mon.prestige > 0 && (
                <span className="inline-flex items-center gap-1 rounded-chip bg-[var(--prestige)] px-2.5 py-0.5 font-body text-[12px] font-extrabold text-[var(--prestige-ink)]" data-testid="prestige-badge" aria-label={`Prestige ${mon.prestige}`}>
                  <Star className="h-3.5 w-3.5" /> {mon.prestige}
                </span>
              )}
            </div>
          </div>
          {hint && (
            <span className="ml-auto shrink-0 rounded-chip bg-bg px-3 py-1 font-body text-[13px] font-extrabold text-hero-accent">{hint}</span>
          )}
        </div>

        <div className="mt-4 grid place-items-center">
          <div className="grid h-[176px] w-[176px] place-items-center rounded-full bg-hero-sprite">
            <motion.img
              key={mon.current_species_id + (mon.is_shiny ? "-shiny" : "")}
              src={sprite}
              alt={mon.species_name}
              className="sprite h-40 w-40 object-contain animate-idle-bob"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 420, damping: 22 }}
              data-testid="partner-sprite"
            />
          </div>
        </div>
      </div>

      <XPBar
        level={mon.level}
        current={mon.xp_progress_current}
        needed={mon.xp_progress_needed}
        totalXp={mon.total_xp}
        animateKey={animateKey}
      />

      {mon.pending_evolution && (
        <GameButton className="w-full" onClick={onEvolveClick} testId="partner-evolve-button">
          Choose evolution <ArrowRight />
        </GameButton>
      )}
      {fullyEvolved && !mon.pending_evolution && (
        <GameButton variant="prestige" className="w-full" onClick={onPrestigeClick} testId="partner-prestige-button">
          <Restart /> Prestige: start over
        </GameButton>
      )}

      {mon.evolutions_history?.length > 0 && (
        <div>
          <h3 className="mb-2.5 font-body text-[13px] font-extrabold uppercase tracking-[0.07em] text-label">Evolution history</h3>
          <ul className="flex flex-col gap-2" data-testid="evolution-history">
            {mon.evolutions_history.map((h, i) => (
              // The level pill and the from → to pair wrap onto two lines when
              // the panel is at its narrowest, rather than truncating names.
              <li key={i} className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-2xl bg-surface-sunken px-2.5 py-2 font-body text-[14px] font-semibold text-fg">
                <span className="shrink-0 rounded-chip bg-bg px-2.5 py-0.5 text-[12px] font-extrabold text-label">Lv {h.at_level}</span>
                <span className="flex min-w-0 items-center gap-1">
                  <span className="flex min-w-0 items-center">
                    <img src={h.from.sprite} className="sprite h-7 w-7 shrink-0" alt="" />
                    <span className="truncate capitalize">{h.from.name}</span>
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted" />
                  <span className="sr-only">evolved into</span>
                  <span className="flex min-w-0 items-center">
                    <img src={h.to.sprite} className="sprite h-7 w-7 shrink-0" alt="" />
                    <span className="truncate capitalize">{h.to.name}</span>
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

export default PartnerPanel;
