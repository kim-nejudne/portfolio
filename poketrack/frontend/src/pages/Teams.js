import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import GameFrame from "@/components/game/GameFrame";
import GameButton from "@/components/game/GameButton";
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
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <p className="font-pixel text-[10px] tracking-widest text-type-electric">TRAINER HQ</p>
          <h1 className="font-pixel text-2xl tracking-widest text-white pixel-shadow" data-testid="teams-title">YOUR TEAMS</h1>
        </div>
        <form onSubmit={create} className="flex items-end gap-2" data-testid="teams-create-form">
          <label className="flex-1">
            <span className="font-pixel text-[9px] tracking-widest text-white/70">NEW TEAM NAME</span>
            <input value={name} onChange={(e) => setName(e.target.value)}
              data-testid="teams-create-name"
              className="mt-1 w-64 max-w-[70vw] rounded-[10px] bg-black/40 text-white font-body px-3 py-2 ring-2 ring-black/70 border border-white/10" />
          </label>
          <GameButton type="submit" tone="grass" testId="teams-create-submit">FORM TEAM</GameButton>
        </form>
      </div>

      <div className="mt-6">
        {loading ? <PokeBallLoader /> : teams.length === 0 ? (
          <GameFrame className="p-8 text-center">
            <p className="font-pixel text-[12px] tracking-widest text-white pixel-shadow">WELCOME, NEW TRAINER!</p>
            <p className="mt-3 font-body text-sm text-white/70">Every great adventure starts with a team. Form one above to begin — you'll be its owner.</p>
          </GameFrame>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {teams.map((t) => (
              <Link key={t.id} to={`/teams/${t.id}`} className="block" data-testid={`team-card-${t.id}`}>
                <GameFrame className="p-4 hover:brightness-110 transition-[filter] duration-150">
                  <p className="font-pixel text-[12px] tracking-widest text-white pixel-shadow">{t.name}</p>
                  <p className="mt-2 font-body text-sm text-white/70 uppercase">You are {t.my_role}</p>
                </GameFrame>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
