import React, { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { GameFrame } from "./GameFrame";
import { GameButton } from "./GameButton";

const POINTS = [1, 2, 3, 5, 8, 13];

export function TicketModal({ open, initial, members = [], onCancel, onSave, onDelete }) {
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [points, setPoints] = useState(3);
  const [status, setStatus] = useState("backlog");
  const [assignee, setAssignee] = useState("");

  useEffect(() => {
    if (!open) return;
    setTitle(initial?.title || "");
    setDesc(initial?.description || "");
    setPoints(initial?.story_points || 3);
    setStatus(initial?.status || "backlog");
    setAssignee(initial?.assignee_id || "");
  }, [open, initial]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[95] bg-black/70 backdrop-blur-sm grid place-items-center px-3 py-4 overflow-y-auto"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          role="dialog" aria-modal="true" data-testid="ticket-modal">
          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }}
            transition={{ type: "spring", stiffness: 460, damping: 32 }}
            className="w-[min(640px,96vw)]">
            <GameFrame className="p-5">
              <p className="font-pixel text-[12px] tracking-widest text-white pixel-shadow">{initial ? "EDIT TICKET" : "NEW TICKET"}</p>
              <label className="block mt-4">
                <span className="font-pixel text-[9px] tracking-widest text-white/70">TITLE</span>
                <input value={title} onChange={(e) => setTitle(e.target.value)}
                  data-testid="ticket-modal-title"
                  className="mt-1 w-full rounded-[10px] bg-black/40 text-white font-body px-3 py-2 ring-2 ring-black/70 border border-white/10" />
              </label>
              <label className="block mt-3">
                <span className="font-pixel text-[9px] tracking-widest text-white/70">DESCRIPTION</span>
                <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={3}
                  data-testid="ticket-modal-description"
                  className="mt-1 w-full rounded-[10px] bg-black/40 text-white font-body px-3 py-2 ring-2 ring-black/70 border border-white/10" />
              </label>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <span className="font-pixel text-[9px] tracking-widest text-white/70">STORY POINTS</span>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {POINTS.map((p) => (
                      <button key={p} onClick={() => setPoints(p)}
                        data-testid={`ticket-modal-points-${p}`}
                        className={`px-3 py-1 rounded-chip font-pixel text-[9px] ring-2 ring-black/70 ${points === p ? "bg-type-electric text-type-electric-ink" : "bg-white/10 text-white"}`}>{p}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <span className="font-pixel text-[9px] tracking-widest text-white/70">STATUS</span>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {["backlog", "in_progress", "done"].map((s) => (
                      <button key={s} onClick={() => setStatus(s)}
                        data-testid={`ticket-modal-status-${s}`}
                        className={`px-3 py-1 rounded-chip font-pixel text-[9px] ring-2 ring-black/70 uppercase ${status === s ? "bg-type-water text-type-water-ink" : "bg-white/10 text-white"}`}>{s.replace("_", " ")}</button>
                    ))}
                  </div>
                </div>
              </div>
              <label className="block mt-3">
                <span className="font-pixel text-[9px] tracking-widest text-white/70">ASSIGNEE</span>
                <select value={assignee} onChange={(e) => setAssignee(e.target.value)}
                  data-testid="ticket-modal-assignee"
                  className="mt-1 w-full rounded-[10px] bg-black/40 text-white font-body px-3 py-2 ring-2 ring-black/70 border border-white/10">
                  <option value="">Unassigned</option>
                  {members.map((m) => (
                    <option key={m.user_id} value={m.user_id}>{m.name} ({m.email})</option>
                  ))}
                </select>
              </label>
              <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
                <div className="flex gap-2">
                  {initial && onDelete && (
                    <GameButton variant="danger" onClick={() => onDelete(initial.id)} testId="ticket-modal-delete">DELETE</GameButton>
                  )}
                </div>
                <div className="flex gap-2">
                  <GameButton variant="secondary" onClick={onCancel} testId="ticket-modal-cancel">CANCEL</GameButton>
                  <GameButton onClick={() => onSave({ title, description: desc, story_points: points, status, assignee_id: assignee || null })} disabled={!title.trim()} tone="grass" testId="ticket-modal-save">SAVE</GameButton>
                </div>
              </div>
            </GameFrame>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default TicketModal;
