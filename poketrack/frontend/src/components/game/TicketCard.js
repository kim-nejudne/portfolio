import React from "react";
import { motion } from "framer-motion";
import { useDraggable } from "@dnd-kit/core";
import { GameFrame } from "./GameFrame";

const POINT_COLORS = { 1: "#7AC74C", 2: "#96D9D6", 3: "#6390F0", 5: "#F7D02C", 8: "#EE8130", 13: "#F95587" };

// The card face, with no drag wiring of its own. Rendered twice: once in the
// column, once inside the DragOverlay while a drag is in flight.
function TicketFace({ ticket, assignee, onEdit, onMoveLeft, onMoveRight, handleProps, interactive = true }) {
  const pointColor = POINT_COLORS[ticket.story_points] || "#6390F0";
  return (
    <GameFrame className="p-0 relative" tone="panel2" rivets={false}>
      {/* type stripe */}
      <div className="absolute left-0 top-0 h-full w-[10px]" style={{ background: pointColor }} />
      <div className="pl-4 pr-3 py-3">
        <div className="flex items-start gap-2">
          <span data-testid="ticket-story-points-badge" style={{ background: pointColor, color: "#0B0D10" }} className="font-pixel text-[10px] px-2 py-1 rounded-chip ring-2 ring-black/70">{ticket.story_points}</span>
          <button onClick={interactive ? () => onEdit(ticket) : undefined} tabIndex={interactive ? undefined : -1} className="text-left flex-1 font-pixel text-[10px] tracking-wide text-game-ink hover:underline" data-testid={interactive ? `ticket-title-${ticket.id}` : undefined}>
            {ticket.title}
          </button>
        </div>
        {ticket.description && <p className="mt-1 font-body text-xs text-game-inkDim line-clamp-2">{ticket.description}</p>}
        <div className="mt-2 flex items-center justify-between">
          {assignee ? (
            <span className="inline-flex items-center gap-2 font-body text-xs text-white/80">
              <span className="grid place-items-center h-5 w-5 rounded-full bg-type-water text-type-water-ink font-pixel text-[8px] ring-2 ring-black/70">{(assignee.name || assignee.email || "?").slice(0, 1).toUpperCase()}</span>
              <span>{assignee.name || assignee.email}</span>
            </span>
          ) : <span className="font-body text-xs text-white/50">Unassigned</span>}
          <div className="flex items-center gap-1">
            <button aria-label="Move left" onClick={interactive ? () => onMoveLeft(ticket) : undefined} tabIndex={interactive ? undefined : -1} className="px-2 py-1 rounded-md ring-2 ring-black/70 bg-white/10 hover:bg-white/20 font-pixel text-[9px]" data-testid={interactive ? `ticket-move-left-${ticket.id}` : undefined}>←</button>
            <button aria-label="Move right" onClick={interactive ? () => onMoveRight(ticket) : undefined} tabIndex={interactive ? undefined : -1} className="px-2 py-1 rounded-md ring-2 ring-black/70 bg-white/10 hover:bg-white/20 font-pixel text-[9px]" data-testid={interactive ? `ticket-move-right-${ticket.id}` : undefined}>→</button>
            {/* touch-none: PointerSensor cannot start a drag on a phone until the
                browser stops claiming the gesture for scrolling. */}
            <span {...handleProps} className="px-2 py-1 touch-none cursor-grab active:cursor-grabbing rounded-md ring-2 ring-black/70 bg-white/5 font-pixel text-[9px] text-white/60" data-testid={interactive ? `ticket-drag-handle-${ticket.id}` : undefined}>DRAG</span>
          </div>
        </div>
      </div>
    </GameFrame>
  );
}

export function TicketCard({ ticket, assignee, onEdit, onMoveLeft, onMoveRight, keyboardHint }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: ticket.id, data: { status: ticket.status } });

  // No drag transform here, on purpose. The column's GameFrame and the board's
  // horizontal scroller both clip their overflow, so a card translated in flow
  // can never leave its own column — the thing that follows the pointer is the
  // DragOverlay copy (see Project.js) and this one just dims in place. Leaving
  // the transform off also keeps Framer Motion's `layout` out of the fight: it
  // re-measures on every render and would otherwise write a correction
  // transform that cancels the drag delta exactly, pinning the card still.
  return (
    <div
      ref={setNodeRef}
      style={{ opacity: isDragging ? 0.3 : 1 }}
      data-testid={`ticket-card-${ticket.id}`}
      data-status={ticket.status}
    >
      <motion.div
        layout
        whileHover={{ y: -4, filter: "brightness(1.08)" }}
        className="cursor-grab active:cursor-grabbing select-none"
      >
        <TicketFace
          ticket={ticket}
          assignee={assignee}
          onEdit={onEdit}
          onMoveLeft={onMoveLeft}
          onMoveRight={onMoveRight}
          handleProps={{ ...attributes, ...listeners }}
        />
      </motion.div>
    </div>
  );
}

// What the pointer actually carries. Rendered in a portal at the body, so
// nothing on the board can clip it.
export function TicketCardPreview({ ticket, assignee }) {
  return (
    <div className="cursor-grabbing select-none -rotate-2 scale-[1.03] drop-shadow-[0_12px_20px_rgba(0,0,0,0.55)]" aria-hidden>
      <TicketFace ticket={ticket} assignee={assignee} interactive={false} />
    </div>
  );
}

export default TicketCard;
