import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import GameFrame from "@/components/game/GameFrame";
import GameButton from "@/components/game/GameButton";
import PageTitle from "@/components/game/PageTitle";
import PokeBallLoader from "@/components/game/PokeBallLoader";
import { pushToast } from "@/components/game/Toaster";

export default function Teams() {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/teams");
      setTeams(data);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const create = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await api.post("/teams", { name });
      setName("");
      await load();
      pushToast("Team assembled! Now build a project.");
    } catch (err) {
      pushToast(err.response?.data?.detail || "Could not create team");
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <PageTitle label="Trainer HQ" testId="teams-title">Your teams</PageTitle>
        <form onSubmit={create} className="flex items-end gap-3" data-testid="teams-create-form">
          {/* min-w-0 lets this shrink below the input's 16rem basis; without it the
              flex item floors at its content and pushes FORM TEAM off-screen.
              The cap is max-w-full, not a vw unit — 70vw knows nothing about the
              button sharing this row or the page padding, so it overflowed on a
              360px screen. */}
          <label className="flex-1 min-w-0">
            <span className="field-label">New team name</span>
            <input value={name} onChange={(e) => setName(e.target.value)}
              data-testid="teams-create-name"
              className="field w-64 max-w-full" />
          </label>
          <GameButton type="submit" variant="success" testId="teams-create-submit">Form team</GameButton>
        </form>
      </div>

      <div className="mt-6">
        {loading ? <PokeBallLoader /> : teams.length === 0 ? (
          <GameFrame className="p-8 text-center">
            <h2 className="font-display text-[24px] font-bold text-fg">Welcome, new trainer!</h2>
            <p className="mt-2 font-body text-[15px] text-muted">Every great adventure starts with a team. Form one above to begin — you'll be its owner.</p>
          </GameFrame>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {teams.map((t) => (
              <Link key={t.id} to={`/teams/${t.id}`} className="block rounded-card transition-transform duration-150 hover:-translate-y-0.5 motion-reduce:hover:translate-y-0" data-testid={`team-card-${t.id}`}>
                <GameFrame shape="card" tone="raised" className="p-5">
                  <p className="font-display text-[20px] font-semibold text-fg">{t.name}</p>
                  <p className="mt-1 font-body text-[14px] font-semibold text-muted">You are {t.my_role}</p>
                </GameFrame>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
