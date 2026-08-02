import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import GameFrame from "@/components/game/GameFrame";
import GameButton from "@/components/game/GameButton";
import DialogueBox from "@/components/game/DialogueBox";
import { api, getToken } from "@/lib/api";

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

const TYPE_HEX = {
  fire: "#EE8130", water: "#6390F0", grass: "#7AC74C", electric: "#F7D02C", normal: "#A8A77A",
};

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
    <div className="max-w-6xl mx-auto">
      <section className="grid lg:grid-cols-[1.4fr_1fr] gap-8 items-center py-6 lg:py-16" data-testid="landing-hero">
        <div>
          <motion.p
            initial={{ y: 14, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            className="font-pixel text-[10px] tracking-display text-type-electric mb-3">A NEW ADVENTURE BEGINS</motion.p>
          <motion.h1
            initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.05, type: "spring", stiffness: 420, damping: 32 }}
            className="font-pixel text-3xl sm:text-4xl lg:text-5xl leading-[1.35] tracking-display text-white pixel-shadow">
            LEVEL UP<br />YOUR TEAM.
          </motion.h1>
          <motion.p
            initial={{ y: 14, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.12 }}
            className="mt-5 font-body text-lg text-white/85 max-w-xl">
            Every story point you ship becomes real XP for your Pokémon partner. Cross the right level and it evolves — with the full-screen cutscene.
          </motion.p>
          <div className="mt-8 flex flex-wrap gap-3">
            <GameButton size="lg" tone="electric" as={Link} to={signedIn ? "/teams" : "/sign-up"} testId="landing-cta-start">
              {signedIn ? "OPEN MY TEAMS ▶" : "CHOOSE YOUR PARTNER ▶"}
            </GameButton>
            <GameButton size="lg" variant="secondary" as={Link} to={signedIn ? "/teams" : "/sign-in"} testId="landing-cta-signin">
              {signedIn ? "CONTINUE" : "SIGN IN"}
            </GameButton>
          </div>
          {hasDemos && (
            <p className="mt-4 font-body text-sm text-white/60" data-testid="landing-demo-hint">
              Don't want an account?{" "}
              <Link to="/sign-in" className="underline text-type-electric" data-testid="landing-demo-link">
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
                <div className="absolute inset-0 rounded-full blur-3xl opacity-70 animate-float-up" style={{ background: TYPE_HEX[m.type] || "#6390F0" }} />
                <img src={m.url} alt="pokemon" className="sprite h-24 w-24 relative z-10 animate-float-up" style={{ animationDelay: `${i * 0.4}s` }} />
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="grid md:grid-cols-3 gap-5 mt-6" data-testid="landing-features">
        {[{
          t: "REAL XP TABLES", d: "Growth rates come from PokeAPI. Bulbasaur, Charmander and Squirtle all use their actual level curves."
        }, {
          t: "AUTHENTIC EVOLUTIONS", d: "Charmander -> Charmeleon at 16. Charizard at 36. Eevee stalls at LV 30 with all 8 branches to choose from."
        }, {
          t: "CLEAN REVERSALS", d: "Un-check a Done ticket and your Pokemon devolves cleanly — history rolls back, no ledger mutation."
        }].map((f) => (
          <GameFrame key={f.t} className="p-5">
            <p className="font-pixel text-[11px] tracking-display text-type-electric">{f.t}</p>
            <p className="mt-3 font-body text-sm text-white/85">{f.d}</p>
          </GameFrame>
        ))}
      </section>

      <footer className="text-center text-white/40 text-xs font-body mt-10 pb-6">
        A hobby project. Pokémon are Nintendo IP — sprites via PokeAPI.
      </footer>
    </div>
  );
}
