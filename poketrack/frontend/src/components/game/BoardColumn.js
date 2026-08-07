import React from "react";
import { useDroppable } from "@dnd-kit/core";
import { GameFrame } from "./GameFrame";
import { typeColor } from "@/lib/types";

const COL_META = {
  backlog:    { label: "BACKLOG",    icon: "📜", tone: "normal" },
  in_progress:{ label: "IN BATTLE",  icon: "⚔️", tone: "electric" },
  done:       { label: "VICTORY",    icon: "🏆", tone: "grass" },
};

export function BoardColumn({ status, tickets, children }) {
  const meta = COL_META[status] || COL_META.backlog;
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const color = typeColor(meta.tone);
  return (
    <div ref={setNodeRef} className="flex-1 min-w-[280px] max-w-full" data-testid={`board-column-${status}`}>
      <GameFrame className={`p-0 transition-shadow duration-200 ${isOver ? "ring-4 ring-white/70" : ""}`} tone="panel">
        <div className="flex items-center justify-between px-4 py-3 rounded-t-frameInner"
          style={{ background: `linear-gradient(180deg, ${color}, transparent 80%)` }}>
          <div className="flex items-center gap-2">
            <span className="text-lg" aria-hidden>{meta.icon}</span>
            <span className="font-pixel text-[10px] tracking-display text-white pixel-shadow">{meta.label}</span>
          </div>
          <span data-testid={`board-column-${status}-count`} className="font-pixel text-[9px] px-2 py-0.5 rounded-chip bg-black/70 text-white ring-2 ring-black/70">{tickets.length}</span>
        </div>
        <div className={`p-3 space-y-3 min-h-[220px] transition-colors duration-200 ${isOver ? "bg-white/5" : ""}`} data-testid={`board-column-body-${status}`}>
          {children}
          {tickets.length === 0 && <p className="font-body text-xs text-white/40 py-6 text-center">Drop a ticket here</p>}
        </div>
      </GameFrame>
    </div>
  );
}

export default BoardColumn;
