import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, getUser } from "@/lib/api";
import GameFrame from "@/components/game/GameFrame";
import GameButton from "@/components/game/GameButton";
import { pushToast } from "@/components/game/Toaster";
import PokeBallLoader from "@/components/game/PokeBallLoader";

export default function TeamDetail() {
  const { teamId } = useParams();
  const [team, setTeam] = useState(null);
  const [projects, setProjects] = useState([]);
  const [members, setMembers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [pname, setPname] = useState("");
  const [iemail, setIemail] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [t, p, m] = await Promise.all([
        api.get(`/teams/${teamId}`),
        api.get(`/teams/${teamId}/projects`),
        api.get(`/teams/${teamId}/members`),
      ]);
      setTeam(t.data);
      setProjects(p.data);
      setMembers(m.data);
      if (t.data.my_role === "owner") {
        try {
          const inv = await api.get(`/teams/${teamId}/invites`);
          setInvites(inv.data);
        } catch { /* not owner */ }
      }
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [teamId]);

  const createProject = async (e) => {
    e.preventDefault();
    if (!pname.trim()) return;
    setBusy(true);
    try {
      await api.post(`/teams/${teamId}/projects`, { name: pname });
      setPname("");
      await load();
      pushToast("Project created. Your team's arena awaits!");
    } catch (err) {
      pushToast(err.response?.data?.detail || "Could not create project");
    } finally { setBusy(false); }
  };

  const invite = async (e) => {
    e.preventDefault();
    if (!iemail.trim()) return;
    setBusy(true);
    try {
      const { data } = await api.post(`/teams/${teamId}/invites`, { email: iemail });
      setIemail("");
      await load();
      const link = `${window.location.origin}/invite/${data.token}`;
      await navigator.clipboard?.writeText(link).catch(() => {});
      pushToast("Invite created — link copied to clipboard.");
    } catch (err) {
      pushToast(err.response?.data?.detail || "Could not create invite");
    } finally { setBusy(false); }
  };

  const revoke = async (id) => {
    try {
      await api.post(`/teams/${teamId}/invites/${id}/revoke`);
      await load();
      pushToast("Invite revoked.");
    } catch (err) { pushToast(err.response?.data?.detail || "Could not revoke"); }
  };

  if (loading) return <div className="grid place-items-center py-16"><PokeBallLoader /></div>;
  if (!team) return null;
  const isOwner = team.my_role === "owner";

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-baseline justify-between">
        <div>
          <p className="font-pixel text-[9px] tracking-display text-type-electric">TEAM</p>
          <h1 className="font-pixel text-2xl tracking-display text-white pixel-shadow" data-testid="team-name">{team.name}</h1>
        </div>
        {isOwner && (
          <Link to={`/teams/${teamId}/settings`} data-testid="team-settings-link">
            <GameButton size="sm" variant="secondary">SETTINGS</GameButton>
          </Link>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        <GameFrame className="p-5">
          <div className="flex items-center justify-between">
            <p className="font-pixel text-[11px] tracking-display text-white pixel-shadow">PROJECTS</p>
          </div>
          <div className="mt-3 space-y-2">
            {projects.length === 0 ? <p className="font-body text-sm text-white/70">No projects yet.</p> :
              projects.map((p) => (
                <Link key={p.id} to={`/projects/${p.id}`} className="block" data-testid={`project-card-${p.id}`}>
                  <div className="rounded-[12px] px-4 py-3 ring-2 ring-black/70 bg-white/5 hover:bg-white/10 font-pixel text-[10px] tracking-hud">{p.name}</div>
                </Link>
              ))
            }
          </div>
          <form onSubmit={createProject} className="mt-4 flex items-end gap-2" data-testid="project-create-form">
            <label className="flex-1">
              <span className="font-pixel text-[9px] tracking-hud text-white/70">NEW PROJECT</span>
              <input value={pname} onChange={(e) => setPname(e.target.value)}
                data-testid="project-create-name"
                className="mt-1 w-full rounded-[10px] bg-black/40 text-white font-body px-3 py-2 ring-2 ring-black/70 border border-white/10" />
            </label>
            <GameButton disabled={busy} type="submit" tone="electric" testId="project-create-submit">CREATE</GameButton>
          </form>
        </GameFrame>

        <GameFrame className="p-5">
          <p className="font-pixel text-[11px] tracking-display text-white pixel-shadow">ROSTER</p>
          <ul className="mt-3 space-y-2" data-testid="members-list">
            {members.map((m) => (
              <li key={m.user_id} className="flex items-center justify-between rounded-[10px] px-3 py-2 ring-2 ring-black/70 bg-white/5">
                <div>
                  <p className="font-pixel text-[10px] tracking-hud text-white">{m.name}</p>
                  <p className="font-body text-xs text-white/60">{m.email}</p>
                </div>
                <span className="font-pixel text-[9px] px-2 py-0.5 rounded-chip bg-white/10 text-white ring-2 ring-black/70 uppercase">{m.role}</span>
              </li>
            ))}
          </ul>

          {isOwner && (
            <div className="mt-5 border-t border-white/10 pt-5">
              <p className="font-pixel text-[10px] tracking-display text-white/70">INVITE TEAMMATE</p>
              <form onSubmit={invite} className="mt-2 flex gap-2" data-testid="invite-form">
                <input value={iemail} onChange={(e) => setIemail(e.target.value)} type="email" placeholder="friend@team.com"
                  data-testid="invite-email"
                  className="flex-1 rounded-[10px] bg-black/40 text-white font-body px-3 py-2 ring-2 ring-black/70 border border-white/10" />
                <GameButton disabled={busy} type="submit" tone="water" testId="invite-submit">INVITE</GameButton>
              </form>
              {invites.length > 0 && (
                <ul className="mt-3 space-y-2" data-testid="invites-list">
                  {invites.map((iv) => {
                    const link = `${window.location.origin}/invite/${iv.token}`;
                    return (
                      <li key={iv.id} className="rounded-[10px] px-3 py-2 ring-2 ring-black/70 bg-white/5 flex items-center justify-between gap-2 flex-wrap">
                        <div>
                          <p className="font-body text-sm text-white/90">{iv.email}</p>
                          <p className="font-body text-xs text-white/50 break-all">{link}</p>
                        </div>
                        <div className="flex gap-2">
                          <GameButton size="sm" variant="secondary" onClick={() => { navigator.clipboard?.writeText(link); pushToast("Link copied"); }} testId={`invite-copy-${iv.id}`}>COPY</GameButton>
                          <GameButton size="sm" variant="danger" onClick={() => revoke(iv.id)} testId={`invite-revoke-${iv.id}`}>REVOKE</GameButton>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </GameFrame>
      </div>
    </div>
  );
}
