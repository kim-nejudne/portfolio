import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "@/lib/api";
import GameFrame from "@/components/game/GameFrame";
import GameButton from "@/components/game/GameButton";
import { pushToast } from "@/components/game/Toaster";

export default function ProjectSettings() {
  const { projectId } = useParams();
  const [project, setProject] = useState(null);
  const [name, setName] = useState("");
  const [xpPer, setXpPer] = useState(10);
  const [synth, setSynth] = useState(30);
  const [pct, setPct] = useState(100);
  const [confirmName, setConfirmName] = useState("");
  const nav = useNavigate();

  useEffect(() => {
    api.get(`/projects/${projectId}`).then(({ data }) => {
      setProject(data);
      setName(data.name);
      setXpPer(data.xp_per_point);
      setSynth(data.synthetic_evolution_level);
      setPct(data.evolution_level_pct);
    });
  }, [projectId]);

  const save = async () => {
    try {
      await api.patch(`/projects/${projectId}`, {
        name, xp_per_point: xpPer, synthetic_evolution_level: synth, evolution_level_pct: pct,
      });
      pushToast("Project saved.");
      nav(`/projects/${projectId}`);
    } catch (err) { pushToast(err.response?.data?.detail || "Save failed"); }
  };

  const del = async () => {
    if (!project) return;
    try {
      await api.delete(`/projects/${projectId}`, { params: { confirm_name: confirmName } });
      pushToast("Project deleted.");
      nav(`/teams/${project.team_id}`);
    } catch (err) { pushToast(err.response?.data?.detail || "Delete failed"); }
  };

  if (!project) return null;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <GameFrame className="p-6 sm:p-7">
        <h1 className="font-display text-[32px] font-bold leading-tight text-fg" data-testid="project-settings-title">Project settings</h1>
        <label className="block mt-5">
          <span className="field-label">Project name</span>
          <input value={name} onChange={(e) => setName(e.target.value)}
            data-testid="project-settings-name"
            className="field" />
        </label>
        <label className="block mt-5">
          <span className="field-label">XP per story point ({xpPer})</span>
          <input type="range" min="1" max="200" value={xpPer} onChange={(e) => setXpPer(parseInt(e.target.value, 10))}
            data-testid="project-settings-xp-per-point"
            className="mt-3 w-full accent-[var(--accent)]" />
        </label>
        <label className="block mt-5">
          <span className="field-label">Synthetic evolution level for non-level triggers ({synth})</span>
          <input type="range" min="5" max="90" value={synth} onChange={(e) => setSynth(parseInt(e.target.value, 10))}
            data-testid="project-settings-synth"
            className="mt-3 w-full accent-[var(--prestige)]" />
        </label>
        <label className="block mt-5">
          <span className="field-label">Evolution level % (scales every gate) ({pct}%)</span>
          <input type="range" min="10" max="400" value={pct} onChange={(e) => setPct(parseInt(e.target.value, 10))}
            data-testid="project-settings-pct"
            className="mt-3 w-full accent-[var(--success)]" />
        </label>
        <div className="mt-6 flex justify-end gap-3">
          <GameButton variant="secondary" onClick={() => nav(`/projects/${projectId}`)} testId="project-settings-cancel">Cancel</GameButton>
          <GameButton onClick={save} testId="project-settings-save">Save</GameButton>
        </div>
      </GameFrame>

      <GameFrame className="p-6 sm:p-7">
        <h2 className="font-display text-[24px] font-bold text-danger-text">Danger zone</h2>
        <p className="mt-2 font-body text-[15px] text-muted">Deleting this project removes every ticket, XP event, evolution history, and Pokémon associated with it.</p>
        <label className="block mt-4">
          <span className="field-label">Type the project name to confirm</span>
          <input value={confirmName} onChange={(e) => setConfirmName(e.target.value)}
            data-testid="project-settings-confirm-name"
            className="field" />
        </label>
        <div className="mt-4">
          <GameButton variant="danger" onClick={del} disabled={confirmName !== project.name} testId="project-settings-delete">Delete project</GameButton>
        </div>
      </GameFrame>
    </div>
  );
}
