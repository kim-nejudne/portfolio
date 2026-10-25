import React from "react";
import { useDroppable } from "@dnd-kit/core";
import { Bolt, ListIcon, Trophy } from "./Icons";

const COL_META = {
  backlog:     { label: "Backlog",   Icon: ListIcon },
  in_progress: { label: "In battle", Icon: Bolt },
  done:        { label: "Victory",   Icon: Trophy },
};

export function BoardColumn({ status, tickets, children }) {
  const meta = COL_META[status] || COL_META.backlog;
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const { Icon } = meta;
  return (
    // data-col resolves the --col-* theme (index.css) for this column and
    // everything inside it.
    <section
      ref={setNodeRef}
      data-col={status}
      aria-label={meta.label}
      className={`min-w-0 flex flex-col gap-3 rounded-panel bg-col-bg p-3.5 transition-shadow duration-150 ${isOver ? "shadow-[inset_0_0_0_3px_var(--col-icon)]" : ""}`}
      data-testid={`board-column-${status}`}
    >
      <header className="flex items-center gap-3 px-0.5 pt-0.5">
        <span className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-xl bg-bg text-col-icon">
          <Icon />
        </span>
        <h2 className="flex-1 font-display text-[20px] font-semibold text-col-title">{meta.label}</h2>
        <span data-testid={`board-column-${status}-count`} className="min-w-[34px] rounded-chip bg-bg px-3 py-1 text-center font-body text-[14px] font-extrabold text-col-icon">
          {tickets.length}
        </span>
      </header>
      <div className="flex min-h-[180px] flex-col gap-3" data-testid={`board-column-body-${status}`}>
        {children}
        {tickets.length === 0 && (
          <p className="grid flex-1 place-items-center rounded-card py-8 text-center font-body text-[14px] text-col-desc shadow-[inset_0_0_0_2px_var(--col-back)]">
            Drop a ticket here
          </p>
        )}
      </div>
    </section>
  );
}

export default BoardColumn;
