import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, getUser } from "@/lib/api";
import GameFrame from "@/components/game/GameFrame";
import GameButton from "@/components/game/GameButton";
import { pushToast } from "@/components/game/Toaster";
import PokeBallLoader from "@/components/game/PokeBallLoader";
import PageTitle from "@/components/game/PageTitle";
import { Gear } from "@/components/game/Icons";
import { avatarColors } from "@/lib/palette";

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
      <div className="flex items-end justify-between gap-4">
        <PageTitle label="Team" testId="team-name">{team.name}</PageTitle>
        {isOwner && (
          <Link to={`/teams/${teamId}/settings`} data-testid="team-settings-link" aria-label="Team settings"
            className="grid h-[50px] w-[50px] shrink-0 place-items-center rounded-full bg-surface-raised text-fg shadow-hard transition-[transform,box-shadow] duration-100 hover:text-label active:translate-y-[2px] active:shadow-none motion-reduce:active:translate-y-0">
            <Gear />
          </Link>
        )}
      </div>

      <div className="grid items-start gap-6 md:grid-cols-2">
        <GameFrame className="p-5 sm:p-6">
          <h2 className="font-display text-[24px] font-bold text-fg">Projects</h2>
          <div className="mt-3 space-y-2">
            {projects.length === 0 ? <p className="font-body text-[15px] text-muted">No projects yet.</p> :
              projects.map((p) => (
                <Link key={p.id} to={`/projects/${p.id}`} className="block rounded-card transition-transform duration-150 hover:-translate-y-0.5 motion-reduce:hover:translate-y-0" data-testid={`project-card-${p.id}`}>
                  <div className="rounded-card bg-surface-sunken px-4 py-3 font-display text-[16px] font-semibold text-fg shadow-hard">{p.name}</div>
                </Link>
              ))
            }
          </div>
          <form onSubmit={createProject} className="mt-5 flex items-end gap-3" data-testid="project-create-form">
            <label className="min-w-0 flex-1">
              <span className="field-label">New project</span>
              <input value={pname} onChange={(e) => setPname(e.target.value)}
                data-testid="project-create-name"
                className="field" />
            </label>
            <GameButton disabled={busy} type="submit" variant="success" testId="project-create-submit">Create</GameButton>
          </form>
        </GameFrame>

        <GameFrame className="p-5 sm:p-6">
          <h2 className="font-display text-[24px] font-bold text-fg">Roster</h2>
          <ul className="mt-3 space-y-2" data-testid="members-list">
            {members.map((m) => (
              <li key={m.user_id} className="flex items-center justify-between gap-3 rounded-2xl bg-surface-sunken px-3 py-2.5">
                <div className="flex min-w-0 items-center gap-3">
                  <span style={avatarColors(m.user_id)} className="grid h-9 w-9 shrink-0 place-items-center rounded-full font-body text-[15px] font-extrabold" aria-hidden>{(m.name || m.email || "?").slice(0, 1).toUpperCase()}</span>
                  <div className="min-w-0">
                    <p className="truncate font-body text-[15px] font-bold text-fg">{m.name}</p>
                    <p className="truncate font-body text-[13px] text-muted">{m.email}</p>
                  </div>
                </div>
                <span className="shrink-0 rounded-chip bg-bg px-3 py-1 font-body text-[13px] font-extrabold capitalize text-label">{m.role}</span>
              </li>
            ))}
          </ul>

          {isOwner && (
            <div className="mt-6 border-t-2 border-bg pt-5">
              <label htmlFor="invite-email" className="field-label">Invite teammate</label>
              <form onSubmit={invite} className="mt-2 flex items-start gap-3" data-testid="invite-form">
                <input id="invite-email" value={iemail} onChange={(e) => setIemail(e.target.value)} type="email" placeholder="friend@team.com"
                  data-testid="invite-email"
                  className="field mt-0 min-w-0 flex-1" />
                <GameButton disabled={busy} type="submit" testId="invite-submit">Invite</GameButton>
              </form>
              {invites.length > 0 && (
                <ul className="mt-3 space-y-2" data-testid="invites-list">
                  {invites.map((iv) => {
                    const link = `${window.location.origin}/invite/${iv.token}`;
                    return (
                      <li key={iv.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-surface-sunken px-3 py-2.5">
                        <div className="min-w-0">
                          <p className="font-body text-[15px] font-bold text-fg">{iv.email}</p>
                          <p className="break-all font-body text-[13px] text-muted">{link}</p>
                        </div>
                        <div className="flex gap-2">
                          <GameButton size="sm" variant="secondary" onClick={() => { navigator.clipboard?.writeText(link); pushToast("Link copied"); }} testId={`invite-copy-${iv.id}`}>Copy</GameButton>
                          <GameButton size="sm" variant="danger" onClick={() => revoke(iv.id)} testId={`invite-revoke-${iv.id}`}>Revoke</GameButton>
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
