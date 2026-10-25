import React from "react";
import { useDraggable } from "@dnd-kit/core";
import { ChevronLeft, ChevronRight } from "./Icons";
import { avatarColors, pointBadge } from "@/lib/palette";

function Assignee({ assignee }) {
  if (!assignee) {
    return (
      <span className="inline-flex min-w-0 items-center gap-2 font-body text-[14px] font-semibold text-[var(--unassigned-text)]">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 border-dashed border-[var(--unassigned-border)] text-[13px] font-extrabold" aria-hidden>?</span>
        <span className="truncate">Unassigned</span>
      </span>
    );
  }
  const name = assignee.name || assignee.email || "?";
  return (
    <span className="inline-flex min-w-0 items-center gap-2 font-body text-[14px] font-semibold text-fg">
      <span style={avatarColors(assignee.user_id)} className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[13px] font-extrabold" aria-hidden>
        {name.slice(0, 1).toUpperCase()}
      </span>
      <span className="truncate">{name}</span>
    </span>
  );
}

// The card face, with no drag wiring of its own. Rendered twice: once in the
// column, once inside the DragOverlay while a drag is in flight — which is
// portalled to <body>, so the face carries its own data-col to keep the
// column theme.
function TicketFace({ ticket, assignee, onEdit, onMoveLeft, onMoveRight, interactive = true }) {
  // Disabled, not hidden, at the board's edges: the row keeps its shape and a
  // keyboard user still learns where they are.
  const canMoveLeft = ticket.status !== "backlog";
  const canMoveRight = ticket.status !== "done";
  const moveBtn = "grid h-10 w-10 shrink-0 place-items-center rounded-full transition-transform duration-100 active:translate-y-[2px] motion-reduce:active:translate-y-0 disabled:opacity-30 disabled:cursor-not-allowed disabled:active:translate-y-0";
  return (
    <div data-col={ticket.status} className="flex flex-col gap-2.5 rounded-card bg-col-card p-4 shadow-card">
      <div className="flex items-start gap-3">
        <span
          data-testid="ticket-story-points-badge"
          style={pointBadge(ticket.story_points)}
          className="grid h-[30px] min-w-[30px] shrink-0 place-items-center rounded-full px-1 font-display text-[15px] font-semibold"
          aria-label={`${ticket.story_points} points`}
        >
          {ticket.story_points}
        </span>
        <button
          type="button"
          onClick={interactive ? () => onEdit(ticket) : undefined}
          tabIndex={interactive ? undefined : -1}
          className="flex-1 rounded-md pt-0.5 text-left font-display text-[16px] font-semibold leading-[1.3] text-fg hover:underline decoration-2 underline-offset-2"
          data-testid={interactive ? `ticket-title-${ticket.id}` : undefined}
        >
          {ticket.title}
        </button>
      </div>
      {ticket.description && (
        <p className="line-clamp-2 font-body text-[14px] leading-snug text-col-desc">{ticket.description}</p>
      )}
      <div className="mt-0.5 flex items-center justify-between gap-2">
        <Assignee assignee={assignee} />
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            aria-label="Move back"
            disabled={!canMoveLeft}
            onClick={interactive ? () => onMoveLeft(ticket) : undefined}
            tabIndex={interactive ? undefined : -1}
            className={`${moveBtn} bg-col-back text-col-back-ink`}
            data-testid={interactive ? `ticket-move-left-${ticket.id}` : undefined}
          >
            <ChevronLeft />
          </button>
          <button
            type="button"
            aria-label="Move forward"
            disabled={!canMoveRight}
            onClick={interactive ? () => onMoveRight(ticket) : undefined}
            tabIndex={interactive ? undefined : -1}
            className={`${moveBtn} bg-accent text-accent-ink`}
            data-testid={interactive ? `ticket-move-right-${ticket.id}` : undefined}
          >
            <ChevronRight />
          </button>
        </div>
      </div>
    </div>
  );
}

export function TicketCard({ ticket, assignee, onEdit, onMoveLeft, onMoveRight }) {
  const { listeners, setNodeRef, isDragging } = useDraggable({ id: ticket.id, data: { status: ticket.status } });

  // The whole card is the drag target. Only the pointer listeners are spread,
  // not dnd-kit's `attributes`: those would make the card a focusable
  // role=button wrapped around three real buttons, and with no keyboard sensor
  // configured it would do nothing when activated. Keyboard users move tickets
  // with the back/forward buttons.
  //
  // No drag transform here, on purpose: the thing that follows the pointer is
  // the DragOverlay copy (see Project.js) and this one just dims in place.
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      style={{ opacity: isDragging ? 0.3 : 1 }}
      className="cursor-grab select-none transition-transform duration-150 ease-out hover:-translate-y-0.5 active:cursor-grabbing motion-reduce:hover:translate-y-0"
      data-testid={`ticket-card-${ticket.id}`}
      data-status={ticket.status}
    >
      <TicketFace
        ticket={ticket}
        assignee={assignee}
        onEdit={onEdit}
        onMoveLeft={onMoveLeft}
        onMoveRight={onMoveRight}
      />
    </div>
  );
}

// What the pointer actually carries. Rendered in a portal at the body, so
// nothing on the board can clip it.
export function TicketCardPreview({ ticket, assignee }) {
  return (
    <div className="cursor-grabbing select-none -rotate-2 scale-[1.03]" aria-hidden>
      <TicketFace ticket={ticket} assignee={assignee} interactive={false} />
    </div>
  );
}

export default TicketCard;
