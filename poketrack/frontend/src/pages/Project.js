import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, closestCenter } from "@dnd-kit/core";
import { motion } from "framer-motion";
import { api, getUser } from "@/lib/api";
import GameFrame from "@/components/game/GameFrame";
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

const STATUSES = ["backlog", "in_progress", "done"];

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

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  if (loading) return <div className="grid place-items-center py-16"><PokeBallLoader label="LOADING PROJECT" /></div>;
  if (!project) return null;

  // Prestige starter selection screen
  if (tab === "prestige") {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <p className="font-pixel text-[10px] tracking-display text-type-electric">PRESTIGE</p>
          <h1 className="font-pixel text-2xl tracking-display text-white pixel-shadow">START OVER, KEEP THE LEGEND</h1>
          <p className="mt-2 font-body text-sm text-white/70">Pick a new starter. Your lifetime XP stays on the leaderboard as a ⭐ badge.</p>
        </div>
        <StarterPicker starters={starters} onConfirm={confirmPrestige} loading={busy} testIdPrefix="prestige-starter" />
      </div>
    );
  }

  // Forced starter picker gate
  if (!mon) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <p className="font-pixel text-[10px] tracking-display text-type-electric">FIRST VISIT</p>
          <h1 className="font-pixel text-2xl tracking-display text-white pixel-shadow" data-testid="starter-gate-title">PICK YOUR PARTNER TO CONTINUE</h1>
          <p className="mt-2 font-body text-sm text-white/70">You can't see the board until you've chosen a Pokémon partner. Every ticket you complete will level them up.</p>
        </div>
        <StarterPicker starters={starters} onConfirm={chooseStarter} loading={busy} />
      </div>
    );
  }

  const byStatus = (s) => tickets.filter((t) => t.status === s);
  const memberMap = Object.fromEntries(members.map((m) => [m.user_id, m]));
  const draggingTicket = draggingId ? tickets.find((t) => t.id === draggingId) : null;

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-4">
        <div>
          <p className="font-pixel text-[9px] tracking-display text-type-electric">PROJECT</p>
          <h1 className="font-pixel text-2xl tracking-display text-white pixel-shadow" data-testid="project-name">{project.name}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1 rounded-[12px] p-1 bg-black/40 ring-2 ring-black/70">
            {[["board","BOARD"],["list","LIST"],["leaderboard","LEADERBOARD"]].map(([k,label]) => (
              <button key={k} onClick={() => setTab(k)}
                data-testid={`tab-${k}`}
                className={`px-3 py-1 rounded-[10px] font-pixel text-[9px] tracking-hud ${tab === k ? "bg-type-water text-type-water-ink" : "text-white/80"}`}>{label}</button>
            ))}
          </div>
          <GameButton size="sm" tone="grass" onClick={openNewTicket} testId="new-ticket-button">+ NEW TICKET</GameButton>
          <Link to={`/projects/${projectId}/settings`} data-testid="project-settings-link">
            <GameButton size="sm" variant="secondary">SETTINGS</GameButton>
          </Link>
        </div>
      </div>

      <div className="grid lg:grid-cols-[380px_1fr] gap-6">
        <div className="space-y-3">
          <PartnerPanel mon={mon} animateKey={xpKey}
            onEvolveClick={() => setBranchOpen(true)}
            onPrestigeClick={doPrestige}
          />
        </div>

        <div>
          {tab === "board" && (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onDragCancel={() => setDraggingId(null)}
            >
              <div className="flex gap-4 overflow-x-auto pb-4" data-testid="board">
                {STATUSES.map((s) => (
                  <BoardColumn key={s} status={s} tickets={byStatus(s)}>
                    {byStatus(s).map((t) => (
                      <TicketCard key={t.id} ticket={t} assignee={memberMap[t.assignee_id]}
                        onEdit={openEditTicket} onMoveLeft={moveLeft} onMoveRight={moveRight} />
                    ))}
                  </BoardColumn>
                ))}
              </div>
              {/* Portalled to the body: the columns and the board scroller both
                  clip their overflow, so the card has to travel outside them. */}
              <DragOverlay dropAnimation={reduce ? null : undefined}>
                {draggingTicket && (
                  <TicketCardPreview ticket={draggingTicket} assignee={memberMap[draggingTicket.assignee_id]} />
                )}
              </DragOverlay>
            </DndContext>
          )}
          {tab === "list" && (
            <GameFrame className="p-0 overflow-hidden">
              <table className="w-full border-collapse" data-testid="tickets-list">
                <thead>
                  <tr className="font-pixel text-[9px] tracking-hud text-white/70">
                    <th className="text-left px-4 py-2">Ticket</th>
                    <th className="text-left px-4 py-2">Status</th>
                    <th className="text-right px-4 py-2">Points</th>
                    <th className="text-left px-4 py-2">Assignee</th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((t) => (
                    <tr key={t.id} className="border-t border-white/5 hover:bg-white/5 cursor-pointer" onClick={() => openEditTicket(t)} data-testid={`list-row-${t.id}`}>
                      <td className="px-4 py-2 font-body text-sm text-white">{t.title}</td>
                      <td className="px-4 py-2 font-pixel text-[9px] tracking-hud uppercase text-white/70">{t.status.replace("_", " ")}</td>
                      <td className="px-4 py-2 text-right font-pixel text-[10px] text-white">{t.story_points}</td>
                      <td className="px-4 py-2 font-body text-xs text-white/70">{memberMap[t.assignee_id]?.name || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {tickets.length === 0 && <p className="font-body text-sm text-white/60 px-4 py-6">No tickets yet. Add one to get started.</p>}
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
