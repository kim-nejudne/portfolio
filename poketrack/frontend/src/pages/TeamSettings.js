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
      <GameFrame className="p-6 sm:p-7">
        <h1 className="font-display text-[32px] font-bold leading-tight text-fg" data-testid="team-settings-title">Team settings</h1>
        <label className="block mt-5">
          <span className="field-label">Team name</span>
          <input value={name} onChange={(e) => setName(e.target.value)}
            data-testid="team-settings-name"
            className="field" />
        </label>
        <div className="mt-6 flex justify-end gap-3">
          <GameButton variant="secondary" onClick={() => nav(`/teams/${teamId}`)} testId="team-settings-cancel">Cancel</GameButton>
          <GameButton onClick={save} testId="team-settings-save">Save</GameButton>
        </div>
      </GameFrame>
    </div>
  );
}
