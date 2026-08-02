import React from "react";
import { motion } from "framer-motion";
import { useDraggable } from "@dnd-kit/core";
import { GameFrame } from "./GameFrame";
import { typeColor } from "@/lib/types";

const POINT_COLORS = { 1: "#7AC74C", 2: "#96D9D6", 3: "#6390F0", 5: "#F7D02C", 8: "#EE8130", 13: "#F95587" };

export function TicketCard({ ticket, assignee, onEdit, onMoveLeft, onMoveRight, keyboardHint }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: ticket.id, data: { status: ticket.status } });
  const pointColor = POINT_COLORS[ticket.story_points] || "#6390F0";

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0) rotate(${isDragging ? -2 : 0}deg) scale(${isDragging ? 1.03 : 1})`,
    zIndex: isDragging ? 60 : "auto",
  } : undefined;

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      layout
      whileHover={{ y: -4, filter: "brightness(1.08)" }}
      className="cursor-grab active:cursor-grabbing select-none"
      data-testid={`ticket-card-${ticket.id}`}
      data-status={ticket.status}
    >
      <GameFrame className="p-0 relative" tone="panel2" rivets={false}>
        {/* type stripe */}
        <div className="absolute left-0 top-0 h-full w-[10px]" style={{ background: pointColor }} />
        <div className="pl-4 pr-3 py-3">
          <div className="flex items-start gap-2">
            <span data-testid="ticket-story-points-badge" style={{ background: pointColor, color: "#0B0D10" }} className="font-pixel text-[10px] px-2 py-1 rounded-chip ring-2 ring-black/70">{ticket.story_points}</span>
            <button onClick={() => onEdit(ticket)} className="text-left flex-1 font-pixel text-[10px] tracking-wide text-game-ink hover:underline" data-testid={`ticket-title-${ticket.id}`}>
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
              <button aria-label="Move left" onClick={() => onMoveLeft(ticket)} className="px-2 py-1 rounded-md ring-2 ring-black/70 bg-white/10 hover:bg-white/20 font-pixel text-[9px]" data-testid={`ticket-move-left-${ticket.id}`}>←</button>
              <button aria-label="Move right" onClick={() => onMoveRight(ticket)} className="px-2 py-1 rounded-md ring-2 ring-black/70 bg-white/10 hover:bg-white/20 font-pixel text-[9px]" data-testid={`ticket-move-right-${ticket.id}`}>→</button>
              <span {...attributes} {...listeners} className="px-2 py-1 cursor-grab active:cursor-grabbing rounded-md ring-2 ring-black/70 bg-white/5 font-pixel text-[9px] text-white/60" data-testid={`ticket-drag-handle-${ticket.id}`}>DRAG</span>
            </div>
          </div>
        </div>
      </GameFrame>
    </motion.div>
  );
}

export default TicketCard;
