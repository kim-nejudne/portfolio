import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "@/lib/api";
import GameFrame from "@/components/game/GameFrame";
import GameButton from "@/components/game/GameButton";
import { pushToast } from "@/components/game/Toaster";

export default function TeamSettings() {
  const { teamId } = useParams();
  const [team, setTeam] = useState(null);
  const [name, setName] = useState("");
  const nav = useNavigate();

  useEffect(() => {
    api.get(`/teams/${teamId}`).then(({ data }) => { setTeam(data); setName(data.name); });
  }, [teamId]);

  const save = async () => {
    try {
      await api.patch(`/teams/${teamId}`, { name });
      pushToast("Team renamed.");
      nav(`/teams/${teamId}`);
    } catch (err) { pushToast(err.response?.data?.detail || "Could not save"); }
  };

  if (!team) return null;
  return (
    <div className="max-w-lg mx-auto">
      <GameFrame className="p-6">
        <p className="font-pixel text-[11px] tracking-display text-white pixel-shadow" data-testid="team-settings-title">TEAM SETTINGS</p>
        <label className="block mt-4">
          <span className="font-pixel text-[9px] tracking-hud text-white/70">TEAM NAME</span>
          <input value={name} onChange={(e) => setName(e.target.value)}
            data-testid="team-settings-name"
            className="mt-1 w-full rounded-[10px] bg-black/40 text-white font-body px-3 py-2 ring-2 ring-black/70 border border-white/10" />
        </label>
        <div className="mt-5 flex justify-end gap-2">
          <GameButton variant="secondary" onClick={() => nav(`/teams/${teamId}`)} testId="team-settings-cancel">CANCEL</GameButton>
          <GameButton tone="grass" onClick={save} testId="team-settings-save">SAVE</GameButton>
        </div>
      </GameFrame>
    </div>
  );
}
