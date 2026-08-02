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
    <div className="max-w-2xl mx-auto space-y-5">
      <GameFrame className="p-6">
        <p className="font-pixel text-[11px] tracking-display text-white pixel-shadow" data-testid="project-settings-title">PROJECT SETTINGS</p>
        <label className="block mt-4">
          <span className="font-pixel text-[9px] tracking-hud text-white/70">PROJECT NAME</span>
          <input value={name} onChange={(e) => setName(e.target.value)}
            data-testid="project-settings-name"
            className="mt-1 w-full rounded-[10px] bg-black/40 text-white font-body px-3 py-2 ring-2 ring-black/70 border border-white/10" />
        </label>
        <label className="block mt-4">
          <span className="font-pixel text-[9px] tracking-hud text-white/70">XP PER STORY POINT ({xpPer})</span>
          <input type="range" min="1" max="200" value={xpPer} onChange={(e) => setXpPer(parseInt(e.target.value, 10))}
            data-testid="project-settings-xp-per-point"
            className="mt-2 w-full accent-yellow-300" />
        </label>
        <label className="block mt-3">
          <span className="font-pixel text-[9px] tracking-hud text-white/70">SYNTHETIC EVOLUTION LEVEL for non-level triggers ({synth})</span>
          <input type="range" min="5" max="90" value={synth} onChange={(e) => setSynth(parseInt(e.target.value, 10))}
            data-testid="project-settings-synth"
            className="mt-2 w-full accent-pink-400" />
        </label>
        <label className="block mt-3">
          <span className="font-pixel text-[9px] tracking-hud text-white/70">EVOLUTION LEVEL % (scales every gate) ({pct}%)</span>
          <input type="range" min="10" max="400" value={pct} onChange={(e) => setPct(parseInt(e.target.value, 10))}
            data-testid="project-settings-pct"
            className="mt-2 w-full accent-emerald-400" />
        </label>
        <div className="mt-5 flex justify-end gap-2">
          <GameButton variant="secondary" onClick={() => nav(`/projects/${projectId}`)} testId="project-settings-cancel">CANCEL</GameButton>
          <GameButton tone="grass" onClick={save} testId="project-settings-save">SAVE</GameButton>
        </div>
      </GameFrame>

      <GameFrame className="p-6">
        <p className="font-pixel text-[11px] tracking-display text-red-300 pixel-shadow">DANGER ZONE</p>
        <p className="mt-3 font-body text-sm text-white/80">Deleting this project removes every ticket, XP event, evolution history, and Pokémon associated with it.</p>
        <label className="block mt-3">
          <span className="font-pixel text-[9px] tracking-hud text-white/70">TYPE THE PROJECT NAME TO CONFIRM</span>
          <input value={confirmName} onChange={(e) => setConfirmName(e.target.value)}
            data-testid="project-settings-confirm-name"
            className="mt-1 w-full rounded-[10px] bg-black/40 text-white font-body px-3 py-2 ring-2 ring-black/70 border border-white/10" />
        </label>
        <div className="mt-3">
          <GameButton variant="danger" onClick={del} disabled={confirmName !== project.name} testId="project-settings-delete">DELETE PROJECT</GameButton>
        </div>
      </GameFrame>
    </div>
  );
}
