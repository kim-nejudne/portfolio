import {
  useEffect,
  useEffectEvent,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { Link } from 'react-router';
import { HOVER } from '../lib/hover.js';
import { DANGER } from '../lib/ui.js';

/** One entry of an `OverflowMenu`: a route, an action, or a destructive action to confirm. */
export type MenuItem =
  | { label: string; to: string }
  | {
      label: string;
      onSelect: () => void;
      disabled?: boolean;
      /** The key that does the same, shown at the item's end, such as "U" (F101). */
      keyHint?: string;
    }
  | {
      label: string;
      /** The armed item's text, such as "Confirm delete". The item is red and goes last (FND-07). */
      confirmLabel: string;
      onSelect: () => void;
      disabled?: boolean;
    };

interface OverflowMenuProps {
  /** The trigger's accessible name, such as "More actions for Pub quiz". */
  label: string;
  /** What the trigger shows: `⋯`, or "Backup ▾". */
  trigger: ReactNode;
  triggerClassName: string;
  items: readonly MenuItem[];
  disabled?: boolean;
  /** Where the menu opens: under the trigger, or above it for a bar along the bottom edge. */
  placement?: 'below' | 'above';
  /** The items' text size; the Screen's host bar sizes it with the viewport. */
  itemText?: string;
  /** Told when the menu opens or closes, so a bar that hides itself can stay up meanwhile. */
  onOpenChange?: (open: boolean) => void;
}

const ITEM = `flex min-h-11 w-full items-center rounded-lg border-2 border-transparent px-3 text-left font-bold whitespace-nowrap focus:outline-2 focus:outline-accent aria-disabled:opacity-40`;

/**
 * A button that opens a short menu of a card's or a page's less common actions (LIB-02). Arrow
 * keys, Home and End move through it; Esc closes it and focus returns to the trigger, as does
 * choosing an item. A destructive item asks again in place before it acts.
 */
export function OverflowMenu({
  label,
  trigger,
  triggerClassName,
  items,
  disabled,
  placement = 'below',
  itemText = 'text-base',
  onOpenChange,
}: OverflowMenuProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  // The index of the destructive item waiting for its second press.
  const [armed, setArmed] = useState<number | null>(null);
  // The item to focus: the first on opening, the Confirm item once armed, Delete again on Cancel.
  const [focusAt, setFocusAt] = useState(0);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  function openAt(index: number) {
    setOpen(true);
    arm(null, index);
  }

  function close(refocus: boolean) {
    setOpen(false);
    setArmed(null);
    if (refocus) triggerRef.current?.focus();
  }

  // A press anywhere else closes the menu, as does focus leaving it (handled in `onBlur`).
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) close(false);
    };
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
  }, [open]);

  useEffect(() => {
    if (open) focusable(menuRef)[focusAt]?.focus();
  }, [open, armed, focusAt]);

  const reportOpen = useEffectEvent((isOpen: boolean) => onOpenChange?.(isOpen));
  useEffect(() => {
    reportOpen(open);
  }, [open]);

  function arm(index: number | null, focus: number) {
    setArmed(index);
    setFocusAt(focus);
  }

  function onMenuKey(event: KeyboardEvent<HTMLDivElement>) {
    const all = focusable(menuRef);
    const at = all.indexOf(document.activeElement as HTMLElement);
    const move = (index: number) => {
      event.preventDefault();
      all[(index + all.length) % all.length]?.focus();
    };
    if (event.key === 'ArrowDown') move(at + 1);
    else if (event.key === 'ArrowUp') move(at - 1);
    else if (event.key === 'Home') move(0);
    else if (event.key === 'End') move(all.length - 1);
    else if (event.key === 'Escape') {
      event.preventDefault();
      // Esc closes only this menu, not a dialog round it.
      event.stopPropagation();
      close(true);
    } else if (event.key === 'Tab') close(false);
  }

  function choose(item: MenuItem, index: number) {
    if ('to' in item) {
      close(false);
      return;
    }
    if (item.disabled) return;
    if ('confirmLabel' in item && armed !== index) {
      arm(index, index);
      return;
    }
    close(true);
    item.onSelect();
  }

  function entry(item: MenuItem, index: number): ReactNode {
    if ('to' in item) {
      return (
        <Link
          key={item.label}
          to={item.to}
          role="menuitem"
          tabIndex={-1}
          onClick={() => choose(item, index)}
          className={`${ITEM} ${itemText} ${HOVER}`}
        >
          {item.label}
        </Link>
      );
    }
    const danger = 'confirmLabel' in item;
    const tone = danger ? DANGER : HOVER;
    if (danger && armed === index) {
      return [
        <button
          key={`${item.label}-confirm`}
          type="button"
          role="menuitem"
          tabIndex={-1}
          onClick={() => choose(item, index)}
          className={`${ITEM} ${itemText} border-buzz ${DANGER}`}
        >
          {item.confirmLabel}
        </button>,
        <button
          key={`${item.label}-cancel`}
          type="button"
          role="menuitem"
          tabIndex={-1}
          // Back to the item it came from, in the Confirm button's place.
          onClick={() => arm(null, index)}
          className={`${ITEM} ${itemText} ${HOVER}`}
        >
          Cancel
        </button>,
      ];
    }
    return (
      <button
        key={item.label}
        type="button"
        role="menuitem"
        tabIndex={-1}
        aria-disabled={item.disabled || undefined}
        onClick={() => choose(item, index)}
        className={`${ITEM} ${itemText} ${tone}`}
      >
        {item.label}
        {'keyHint' in item && item.keyHint && (
          <kbd
            aria-hidden
            className="ml-auto pl-[1.5em] font-mono text-[max(14px,0.8em)] opacity-70"
          >
            {item.keyHint}
          </kbd>
        )}
      </button>
    );
  }

  return (
    <div
      ref={wrapperRef}
      className="relative"
      onBlur={(event) => {
        if (open && !wrapperRef.current?.contains(event.relatedTarget as Node | null)) {
          // Focus left for another control (Tab, a click elsewhere): close without pulling it back.
          if (event.relatedTarget !== null) close(false);
        }
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        disabled={disabled}
        onClick={() => (open ? close(false) : openAt(0))}
        onKeyDown={(event) => {
          if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
          event.preventDefault();
          openAt(event.key === 'ArrowDown' ? 0 : items.length - 1);
        }}
        className={triggerClassName}
      >
        {trigger}
      </button>
      {open && (
        <div
          ref={menuRef}
          id={id}
          role="menu"
          aria-label={label}
          onKeyDown={onMenuKey}
          className={`absolute right-0 z-30 flex min-w-48 flex-col gap-1 rounded-xl border-2 border-edge bg-surface p-1 shadow-lg ${placement === 'above' ? 'bottom-full mb-2' : 'top-full mt-2'}`}
        >
          {items.map(entry)}
        </div>
      )}
    </div>
  );
}

/** The menu's items, in order. */
function focusable(menuRef: RefObject<HTMLDivElement | null>): HTMLElement[] {
  return [...(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
}
