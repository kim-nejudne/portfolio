import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import GameFrame from "@/components/game/GameFrame";
import GameButton from "@/components/game/GameButton";
import DialogueBox from "@/components/game/DialogueBox";
import { ChevronRight } from "@/components/game/Icons";
import { api, getToken } from "@/lib/api";
import { typeTint } from "@/lib/types";

const FLOATING_MONS = [
  { id: 4, type: "fire",    url: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/4.png" },
  { id: 1, type: "grass",   url: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/1.png" },
  { id: 7, type: "water",   url: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/7.png" },
  { id: 25,type: "electric",url: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/25.png" },
  { id: 133, type: "normal", url: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/133.png" },
  { id: 906, type: "grass",  url: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/906.png" },
  { id: 909, type: "fire",   url: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/909.png" },
  { id: 912, type: "water",  url: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/912.png" },
];

export default function Landing() {
  const signedIn = !!getToken();
  // Both CTAs above ask for an account. Anyone who just wants to look needs a
  // way past that, but only when there is actually a demo world to look at.
  const [hasDemos, setHasDemos] = useState(false);
  useEffect(() => {
    if (signedIn) return undefined;
    let live = true;
    api.get("/auth/demo-accounts")
      .then(({ data }) => { if (live) setHasDemos(Array.isArray(data) && data.length > 0); })
      .catch(() => { /* absent is the same as none */ });
    return () => { live = false; };
  }, [signedIn]);

  return (
    <div className="mx-auto max-w-6xl">
      <section className="grid lg:grid-cols-[1.4fr_1fr] gap-8 items-center py-6 lg:py-16" data-testid="landing-hero">
        <div>
          <motion.p
            initial={{ y: 14, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            className="mb-3 font-body text-[13px] font-extrabold uppercase tracking-[0.07em] text-label">A new adventure begins</motion.p>
          <motion.h1
            initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.05, type: "spring", stiffness: 420, damping: 32 }}
            className="font-display text-[44px] font-bold leading-[1.05] text-fg sm:text-[56px] lg:text-[68px]">
            Level up<br />your team.
          </motion.h1>
          <motion.p
            initial={{ y: 14, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.12 }}
            className="mt-5 max-w-xl font-body text-[18px] text-muted">
            Every story point you ship becomes real XP for your Pokémon partner. Cross the right level and it evolves — with the full-screen cutscene.
          </motion.p>
          <div className="mt-8 flex flex-wrap gap-3">
            <GameButton size="lg" as={Link} to={signedIn ? "/teams" : "/sign-up"} testId="landing-cta-start">
              {signedIn ? "Open my teams" : "Choose your partner"} <ChevronRight />
            </GameButton>
            <GameButton size="lg" variant="secondary" as={Link} to={signedIn ? "/teams" : "/sign-in"} testId="landing-cta-signin">
              {signedIn ? "Continue" : "Sign in"}
            </GameButton>
          </div>
          {hasDemos && (
            <p className="mt-5 font-body text-[15px] text-muted" data-testid="landing-demo-hint">
              Don't want an account?{" "}
              <Link to="/sign-in" className="font-bold text-label underline underline-offset-2" data-testid="landing-demo-link">
                Sign in as a demo trainer
              </Link>{" "}
              — a team, four months of tickets and a partner mid-evolution, already set up.
            </p>
          )}
          <div className="mt-8">
            <DialogueBox text={`Welcome to PokeTrack!\nComplete tickets, earn XP, evolve your team.\nOak's watching — don't disappoint him.`} />
          </div>
        </div>

        <div className="relative h-[420px]">
          {FLOATING_MONS.map((m, i) => (
            <motion.div
              key={m.id}
              className="absolute"
              style={{ left: `${(i * 12) % 90}%`, top: `${(i * 22) % 80}%` }}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.1 + i * 0.08, type: "spring", stiffness: 420, damping: 30 }}
            >
              <div className="relative">
                <div className="absolute inset-0 rounded-full blur-2xl animate-float-up" style={{ background: typeTint(m.type, 35) }} />
                <img src={m.url} alt="" className="sprite h-24 w-24 relative z-10 animate-float-up" style={{ animationDelay: `${i * 0.4}s` }} />
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="mt-6 grid gap-6 md:grid-cols-3" data-testid="landing-features">
        {[{
          t: "Real XP tables", d: "Growth rates come from PokeAPI. Bulbasaur, Charmander and Squirtle all use their actual level curves."
        }, {
          t: "Authentic evolutions", d: "Charmander -> Charmeleon at 16. Charizard at 36. Eevee stalls at LV 30 with all 8 branches to choose from."
        }, {
          t: "Clean reversals", d: "Un-check a Done ticket and your Pokemon devolves cleanly — history rolls back, no ledger mutation."
        }].map((f) => (
          <GameFrame key={f.t} className="p-6">
            <h2 className="font-display text-[20px] font-semibold text-fg">{f.t}</h2>
            <p className="mt-2 font-body text-[15px] text-muted">{f.d}</p>
          </GameFrame>
        ))}
      </section>

      {/*
        The way back to the portfolio. The hub links out to every spoke; until
        2026-08-06 nothing linked back, so anyone who arrived on this domain
        from a shared link had no route to the write-up or the other four.

        `text-muted`, at full strength. A translucent white here once came out
        at 3.77:1 over the ground, under AA's 4.5, and axe-core over production
        found it on 2026-08-07: three violations, which was every violation
        this spoke had. --text-muted on --bg is well clear of 4.5, so this
        footer should not be dimmed further.

        Worth noting what it was failing: the two links in this footer are the
        only route from this domain back to the rest of the portfolio, and they
        were the hardest thing on the page to read.
      */}
      <footer className="mt-12 pb-6 text-center font-body text-[14px] text-muted">
        <p>A hobby project. Pokémon are Nintendo IP — sprites via PokeAPI.</p>
        <p className="mt-2 flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
          <a
            href="https://kimnejudne.dev/work/poketrack/"
            className="underline underline-offset-2 transition-colors hover:text-label"
          >
            Read the case study
          </a>
          <span aria-hidden="true">·</span>
          <a
            href="https://kimnejudne.dev/"
            className="underline underline-offset-2 transition-colors hover:text-label"
          >
            More work by Kim Nejudne
          </a>
        </p>
      </footer>
    </div>
  );
}
