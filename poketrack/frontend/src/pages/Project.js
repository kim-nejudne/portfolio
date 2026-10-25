import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { DndContext, DragOverlay, MouseSensor, TouchSensor, useSensor, useSensors, closestCenter, pointerWithin } from "@dnd-kit/core";
import { api, getUser } from "@/lib/api";
import GameFrame from "@/components/game/GameFrame";
import { Gear, Plus } from "@/components/game/Icons";
import PageTitle from "@/components/game/PageTitle";
import GameButton from "@/components/game/GameButton";
import PokeBallLoader from "@/components/game/PokeBallLoader";
import StarterPicker from "@/components/game/StarterPicker";
import PartnerPanel from "@/components/game/PartnerPanel";
import BoardColumn from "@/components/game/BoardColumn";
import TicketCard, { TicketCardPreview } from "@/components/game/TicketCard";
import TicketModal from "@/components/game/TicketModal";
import Leaderboard from "@/components/game/Leaderboard";
import EvolutionCutscene from "@/components/game/EvolutionCutscene";
import BranchChoiceModal from "@/components/game/BranchChoiceModal";
import LevelUpBanner from "@/components/game/LevelUpBanner";
import { pushToast } from "@/components/game/Toaster";
import { useReducedMotionMedia } from "@/lib/motion";
import { avatarColors, pointBadge } from "@/lib/palette";

const STATUSES = ["backlog", "in_progress", "done"];
const STATUS_LABEL = { backlog: "Backlog", in_progress: "In battle", done: "Victory" };
const TABS = [["board", "Board"], ["list", "List"], ["leaderboard", "Leaderboard"]];

// The column under the pointer wins. closestCenter alone measures from each
// column's centre, which only works while the columns share a height — once
// the grid wraps them onto separate rows on narrower screens, a long column's
// centre can sit thousands of pixels below the card being dropped at its top.
// It stays as the fallback for a release in the gap between columns.
const collisionDetection = (args) => {
  const hits = pointerWithin(args);
  return hits.length ? hits : closestCenter(args);
};

export default function ProjectPage() {
  const { projectId } = useParams();
  const me = getUser();
  const reduce = useReducedMotionMedia();

  const [project, setProject] = useState(null);
  const [mon, setMon] = useState(null);
  const [starters, setStarters] = useState([]);
  const [members, setMembers] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [tab, setTab] = useState("board");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalInitial, setModalInitial] = useState(null);

  // Board drag state — the id of the ticket currently under the pointer.
  const [draggingId, setDraggingId] = useState(null);

  // Cutscene state
  const [cutscene, setCutscene] = useState({ open: false, from: null, to: null });
  const [branchOpen, setBranchOpen] = useState(false);

  // Level up banner state
  const [levelUp, setLevelUp] = useState({ visible: false, level: 0 });
  const [xpKey, setXpKey] = useState(0);

  const prevLevelRef = useRef(0);
  const prevSpeciesRef = useRef(null);
  const prevPendingRef = useRef(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data: proj } = await api.get(`/projects/${projectId}`);
      setProject(proj);
      const [mems, monResp] = await Promise.all([
        api.get(`/teams/${proj.team_id}/members`),
        api.get(`/projects/${projectId}/me/pokemon`),
      ]);
      setMembers(mems.data);
      setMon(monResp.data);
      prevLevelRef.current = monResp.data?.level || 0;
      prevSpeciesRef.current = monResp.data?.current_species_id || null;
      prevPendingRef.current = !!monResp.data?.pending_evolution;
      if (!monResp.data) {
        const st = await api.get(`/projects/${projectId}/pokedex/starters`);
        setStarters(st.data);
      } else {
        const [tks, lb] = await Promise.all([
          api.get(`/projects/${projectId}/tickets`),
          api.get(`/projects/${projectId}/leaderboard`),
        ]);
        setTickets(tks.data);
        setLeaderboard(lb.data);
      }
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [projectId]);

  const refreshMon = async (opts = {}) => {
    const { data } = await api.get(`/projects/${projectId}/me/pokemon`);
    const prevLevel = prevLevelRef.current;
    const prevSpecies = prevSpeciesRef.current;
    const prevPending = prevPendingRef.current;
    setMon(data);
    setXpKey((k) => k + 1);
    // detect level up
    if (data && data.level > prevLevel) {
      setLevelUp({ visible: true, level: data.level });
    }
    // detect single-path auto evolution
    if (data && prevSpecies && data.current_species_id !== prevSpecies) {
      // fetch species data for cutscene
      try {
        const [from, to] = await Promise.all([
          api.get(`/projects/${projectId}/pokedex/species/${prevSpecies}`),
          api.get(`/projects/${projectId}/pokedex/species/${data.current_species_id}`),
        ]);
        setCutscene({ open: true, from: from.data, to: to.data });
      } catch (e) { /* ignore */ }
    }
    // detect new pending evolution branching
    if (data && !prevPending && data.pending_evolution && (opts.openBranchAutomatically !== false)) {
      setBranchOpen(true);
    }
    prevLevelRef.current = data?.level || 0;
    prevSpeciesRef.current = data?.current_species_id || null;
    prevPendingRef.current = !!data?.pending_evolution;
    // Also refresh leaderboard
    try {
      const lb = await api.get(`/projects/${projectId}/leaderboard`);
      setLeaderboard(lb.data);
    } catch { /* ignore */ }
    return data;
  };

  const chooseStarter = async (species_id) => {
    setBusy(true);
    try {
      const { data } = await api.post(`/projects/${projectId}/starter`, { species_id });
      const shiny = data.is_shiny;
      pushToast(shiny ? "A SHINY appeared! You have been chosen." : "Partner acquired! Now go ship some tickets.");
      await load();
    } catch (err) { pushToast(err.response?.data?.detail || "Could not pick starter"); } finally { setBusy(false); }
  };

  const openNewTicket = () => { setModalInitial(null); setModalOpen(true); };
  const openEditTicket = (t) => { setModalInitial(t); setModalOpen(true); };

  const saveTicket = async (payload) => {
    try {
      if (modalInitial) {
        await api.patch(`/projects/${projectId}/tickets/${modalInitial.id}`, payload);
      } else {
        await api.post(`/projects/${projectId}/tickets`, payload);
      }
      setModalOpen(false);
      const { data: tks } = await api.get(`/projects/${projectId}/tickets`);
      setTickets(tks);
      await refreshMon();
    } catch (err) { pushToast(err.response?.data?.detail || "Could not save ticket"); }
  };

  const deleteTicket = async (id) => {
    try {
      await api.delete(`/projects/${projectId}/tickets/${id}`);
      setModalOpen(false);
      const { data: tks } = await api.get(`/projects/${projectId}/tickets`);
      setTickets(tks);
      await refreshMon();
      pushToast("Ticket removed.");
    } catch (err) { pushToast(err.response?.data?.detail || "Could not delete ticket"); }
  };

  const moveTicket = async (ticket, newStatus) => {
    if (ticket.status === newStatus) return;
    // optimistic
    setTickets((ts) => ts.map((t) => t.id === ticket.id ? { ...t, status: newStatus } : t));
    try {
      await api.patch(`/projects/${projectId}/tickets/${ticket.id}`, { status: newStatus });
      if (newStatus === "done") pushToast("Victory! XP incoming!");
      await refreshMon();
    } catch (err) {
      pushToast(err.response?.data?.detail || "Move failed");
      const { data: tks } = await api.get(`/projects/${projectId}/tickets`);
      setTickets(tks);
    }
  };

  const moveLeft = (t) => {
    const idx = STATUSES.indexOf(t.status);
    if (idx > 0) moveTicket(t, STATUSES[idx - 1]);
  };
  const moveRight = (t) => {
    const idx = STATUSES.indexOf(t.status);
    if (idx < STATUSES.length - 1) moveTicket(t, STATUSES[idx + 1]);
  };

  const onDragStart = (event) => setDraggingId(event.active.id);

  const onDragEnd = (event) => {
    setDraggingId(null);
    const { active, over } = event;
    if (!over) return;
    const status = over.id;
    const t = tickets.find((x) => x.id === active.id);
    if (t) moveTicket(t, status);
  };

  const chooseBranch = async (species_id) => {
    const from = mon.current_species_id;
    setBranchOpen(false);
    try {
      await api.post(`/projects/${projectId}/evolution/choose`, { target_species_id: species_id });
      // open cutscene
      const [f, t] = await Promise.all([
        api.get(`/projects/${projectId}/pokedex/species/${from}`),
        api.get(`/projects/${projectId}/pokedex/species/${species_id}`),
      ]);
      setCutscene({ open: true, from: f.data, to: t.data });
      await refreshMon({ openBranchAutomatically: false });
    } catch (err) { pushToast(err.response?.data?.detail || "Could not evolve"); }
  };

  const doPrestige = async () => {
    if (!mon) return;
    // For simplicity, ask the user by opening the starter picker
    if (!window.confirm("Retire your partner and roll a fresh starter? Lifetime XP will be preserved on the leaderboard.")) return;
    setBusy(true);
    try {
      const st = await api.get(`/projects/${projectId}/pokedex/starters`);
      setStarters(st.data);
      setMon(null);
      setTab("prestige");
      // The starter picker on next screen will call the prestige endpoint.
    } finally { setBusy(false); }
  };

  const confirmPrestige = async (species_id) => {
    setBusy(true);
    try {
      const { data } = await api.post(`/projects/${projectId}/prestige`, { species_id });
      pushToast(data.is_shiny ? "A SHINY partner! Fortune favors the bold." : "New partner acquired — lifetime XP preserved.");
      await load();
    } catch (err) { pushToast(err.response?.data?.detail || "Could not prestige"); } finally { setBusy(false); }
  };

  // The whole card is the drag target, so touch cannot claim the gesture the
  // way the old handle did (touch-action: none) without stopping the board
  // from scrolling on a phone. Mouse drags after 6px, as before; touch drags
  // after a short press and scrolls otherwise.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  );

  if (loading) return <div className="grid place-items-center py-16"><PokeBallLoader label="Loading project" /></div>;
  if (!project) return null;

  // Prestige starter selection screen
  if (tab === "prestige") {
    return (
      <div className="mx-auto max-w-[1360px]">
        <div className="mb-6">
          <PageTitle label="Prestige" lede="Pick a new starter. Your lifetime XP stays on the leaderboard as a star badge.">Start over, keep the legend</PageTitle>
        </div>
        <StarterPicker starters={starters} onConfirm={confirmPrestige} loading={busy} testIdPrefix="prestige-starter" />
      </div>
    );
  }

  // Forced starter picker gate
  if (!mon) {
    return (
      <div className="mx-auto max-w-[1360px]">
        <div className="mb-6">
          <PageTitle label="First visit" testId="starter-gate-title" lede="You can't see the board until you've chosen a Pokémon partner. Every ticket you complete will level them up.">Pick your partner to continue</PageTitle>
        </div>
        <StarterPicker starters={starters} onConfirm={chooseStarter} loading={busy} />
      </div>
    );
  }

  const byStatus = (s) => tickets.filter((t) => t.status === s);
  const memberMap = Object.fromEntries(members.map((m) => [m.user_id, m]));
  const draggingTicket = draggingId ? tickets.find((t) => t.id === draggingId) : null;

  return (
    <div className="mx-auto max-w-[1360px]">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <PageTitle label="Project" testId="project-name">{project.name}</PageTitle>
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-chip bg-surface-raised p-[5px] shadow-hard" role="group" aria-label="View">
            {TABS.map(([k, label]) => (
              <button key={k} type="button" onClick={() => setTab(k)}
                aria-pressed={tab === k}
                data-testid={`tab-${k}`}
                className={`h-10 rounded-chip px-4 font-body text-[15px] font-extrabold transition-colors duration-150 ${tab === k ? "bg-accent text-accent-ink" : "text-tab hover:text-fg"}`}>{label}</button>
            ))}
          </div>
          <GameButton variant="success" onClick={openNewTicket} testId="new-ticket-button"><Plus /> New ticket</GameButton>
          <Link to={`/projects/${projectId}/settings`} data-testid="project-settings-link" aria-label="Project settings"
            className="grid h-[50px] w-[50px] place-items-center rounded-full bg-surface-raised text-fg shadow-hard transition-[transform,box-shadow] duration-100 hover:text-label active:translate-y-[2px] active:shadow-none motion-reduce:active:translate-y-0">
            <Gear />
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap items-start gap-6">
        <div className="min-w-0 flex-[1_1_300px] max-w-[360px]">
          <PartnerPanel mon={mon} animateKey={xpKey}
            onEvolveClick={() => setBranchOpen(true)}
            onPrestigeClick={doPrestige}
          />
        </div>

        {/* min-w-0 lets this flex item shrink below its content, so a wide
            table scrolls inside its own panel rather than pushing the page
            sideways. */}
        <div className="min-w-0 flex-[999_1_640px]">
          {tab === "board" && (
            <DndContext
              sensors={sensors}
              collisionDetection={collisionDetection}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onDragCancel={() => setDraggingId(null)}
            >
              <div className="grid grid-cols-[repeat(auto-fit,minmax(270px,1fr))] gap-[18px]" data-testid="board">
                {STATUSES.map((s) => (
                  <BoardColumn key={s} status={s} tickets={byStatus(s)}>
                    {byStatus(s).map((t) => (
                      <TicketCard key={t.id} ticket={t} assignee={memberMap[t.assignee_id]}
                        onEdit={openEditTicket} onMoveLeft={moveLeft} onMoveRight={moveRight} />
                    ))}
                  </BoardColumn>
                ))}
              </div>
              {/* Portalled to the body so nothing on the board can clip the
                  card while it travels. */}
              <DragOverlay dropAnimation={reduce ? null : undefined}>
                {draggingTicket && (
                  <TicketCardPreview ticket={draggingTicket} assignee={memberMap[draggingTicket.assignee_id]} />
                )}
              </DragOverlay>
            </DndContext>
          )}
          {tab === "list" && (
            <GameFrame className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] border-collapse" data-testid="tickets-list">
                  <thead>
                    <tr className="font-body text-[13px] font-extrabold uppercase tracking-[0.07em] text-label">
                      <th scope="col" className="px-5 pb-2 pt-5 text-left">Ticket</th>
                      <th scope="col" className="px-4 pb-2 pt-5 text-left">Status</th>
                      <th scope="col" className="px-4 pb-2 pt-5 text-right">Points</th>
                      <th scope="col" className="px-5 pb-2 pt-5 text-left">Assignee</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tickets.map((t) => {
                      const who = memberMap[t.assignee_id];
                      return (
                        <tr key={t.id} className="cursor-pointer border-t-2 border-bg hover:bg-surface-raised" onClick={() => openEditTicket(t)} data-testid={`list-row-${t.id}`}>
                          <td className="px-5 py-3">
                            <button type="button" className="rounded-md text-left font-display text-[16px] font-semibold leading-[1.3] text-fg hover:underline"
                              onClick={(e) => { e.stopPropagation(); openEditTicket(t); }}>{t.title}</button>
                          </td>
                          <td className="px-4 py-3">
                            <span data-col={t.status} className="whitespace-nowrap rounded-chip bg-col-bg px-3 py-1 font-body text-[13px] font-extrabold text-col-icon">{STATUS_LABEL[t.status] || t.status}</span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span style={pointBadge(t.story_points)} className="inline-grid h-[30px] min-w-[30px] place-items-center rounded-full px-1 font-display text-[15px] font-semibold">{t.story_points}</span>
                          </td>
                          <td className="px-5 py-3 font-body text-[14px] font-semibold">
                            {who ? (
                              <span className="inline-flex items-center gap-2 text-fg">
                                <span style={avatarColors(who.user_id)} className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[13px] font-extrabold" aria-hidden>{(who.name || who.email || "?").slice(0, 1).toUpperCase()}</span>
                                {who.name || who.email}
                              </span>
                            ) : <span className="text-[var(--unassigned-text)]">Unassigned</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {tickets.length === 0 && <p className="px-5 pb-6 pt-2 font-body text-[15px] text-muted">No tickets yet. Add one to get started.</p>}
            </GameFrame>
          )}
          {tab === "leaderboard" && (
            <Leaderboard rows={leaderboard} myUserId={me?.id} />
          )}
        </div>
      </div>

      <TicketModal open={modalOpen} initial={modalInitial} members={members}
        onCancel={() => setModalOpen(false)}
        onSave={saveTicket}
        onDelete={modalInitial ? deleteTicket : undefined}
      />

      <BranchChoiceModal open={branchOpen} options={mon.pending_options || []}
        onChoose={chooseBranch}
        onCancel={() => setBranchOpen(false)}
      />

      <EvolutionCutscene open={cutscene.open}
        fromMon={cutscene.from}
        toMon={cutscene.to}
        onDone={() => setCutscene({ open: false, from: null, to: null })}
      />

      <LevelUpBanner visible={levelUp.visible} level={levelUp.level} onDone={() => setLevelUp({ visible: false, level: 0 })} />
    </div>
  );
}
