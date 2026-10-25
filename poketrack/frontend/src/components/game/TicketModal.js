import React, { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { GameFrame } from "./GameFrame";
import { GameButton } from "./GameButton";
import { pointBadge } from "@/lib/palette";

const POINTS = [1, 2, 3, 5, 8, 13];
const STATUS_OPTIONS = [["backlog", "Backlog"], ["in_progress", "In battle"], ["done", "Victory"]];

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
        <motion.div className="fixed inset-0 z-[95] grid place-items-center overflow-y-auto bg-[color-mix(in_srgb,var(--shadow-hard)_80%,transparent)] px-4 py-6"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          role="dialog" aria-modal="true" aria-labelledby="ticket-modal-heading" data-testid="ticket-modal">
          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }}
            transition={{ type: "spring", stiffness: 460, damping: 32 }}
            className="w-[min(640px,96vw)]">
            <GameFrame className="p-6">
              <h2 id="ticket-modal-heading" className="font-display text-[26px] font-bold text-fg">{initial ? "Edit ticket" : "New ticket"}</h2>
              <label className="block mt-5">
                <span className="field-label">Title</span>
                <input value={title} onChange={(e) => setTitle(e.target.value)}
                  data-testid="ticket-modal-title"
                  className="field" />
              </label>
              <label className="block mt-4">
                <span className="field-label">Description</span>
                <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={3}
                  data-testid="ticket-modal-description"
                  className="field" />
              </label>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <span className="field-label">Story points</span>
                  <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Story points">
                    {POINTS.map((p) => (
                      <button key={p} type="button" onClick={() => setPoints(p)}
                        aria-pressed={points === p}
                        data-testid={`ticket-modal-points-${p}`}
                        style={points === p ? pointBadge(p) : undefined}
                        className={`grid h-10 w-10 place-items-center rounded-full font-display text-[16px] font-semibold ${points === p ? "shadow-hard" : "bg-surface-sunken text-muted hover:text-fg"}`}>{p}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <span className="field-label">Status</span>
                  <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Status">
                    {STATUS_OPTIONS.map(([s, label]) => (
                      <button key={s} type="button" onClick={() => setStatus(s)}
                        aria-pressed={status === s}
                        data-testid={`ticket-modal-status-${s}`}
                        data-col={s}
                        className={`h-10 rounded-chip px-4 font-body text-[14px] font-extrabold ${status === s ? "bg-col-bg text-col-icon shadow-[inset_0_0_0_2px_var(--col-icon)]" : "bg-surface-sunken text-muted hover:text-fg"}`}>{label}</button>
                    ))}
                  </div>
                </div>
              </div>
              <label className="block mt-4">
                <span className="field-label">Assignee</span>
                <select value={assignee} onChange={(e) => setAssignee(e.target.value)}
                  data-testid="ticket-modal-assignee"
                  className="field">
                  <option value="">Unassigned</option>
                  {members.map((m) => (
                    <option key={m.user_id} value={m.user_id}>{m.name} ({m.email})</option>
                  ))}
                </select>
              </label>
              <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                <div className="flex gap-2">
                  {initial && onDelete && (
                    <GameButton variant="danger" onClick={() => onDelete(initial.id)} testId="ticket-modal-delete">Delete</GameButton>
                  )}
                </div>
                <div className="flex gap-3">
                  <GameButton variant="secondary" onClick={onCancel} testId="ticket-modal-cancel">Cancel</GameButton>
                  <GameButton onClick={() => onSave({ title, description: desc, story_points: points, status, assignee_id: assignee || null })} disabled={!title.trim()} testId="ticket-modal-save">Save</GameButton>
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
