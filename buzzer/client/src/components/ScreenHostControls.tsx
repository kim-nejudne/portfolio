import {
  useCallback,
  useEffect,
  useEffectEvent,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import type { ScreenView } from '../../../shared/types.js';
import { boardDone, moveCursor, tileAt, type BoardCursor } from '../lib/boardCursor.js';
import {
  canGoBack,
  inGame,
  keyName,
  primaryFor,
  runCall,
  shortcutFor,
  shortcutLabel,
  SHORTCUTS,
  UNREVEALED,
  type HostCommandCall,
} from '../lib/hostControls.js';
import { toggleFullscreen } from '../lib/fullscreen.js';
import { HOVER } from '../lib/hover.js';
import { cardFromRoom } from '../lib/resultsCard.js';
import { cycleSoundLevel, getSoundLevel, SOUND_LEVEL_LABEL } from '../lib/sounds.js';
import type { HostCommand } from '../lib/useHostCommand.js';
import { usePointerCoarse } from '../lib/usePointerFine.js';
import { useSoundLevel } from '../lib/useSoundLevel.js';
import { OverflowMenu, type MenuItem } from './OverflowMenu.js';
import { ShareResults } from './ShareResults.js';

/** The bar hides after this long without mouse movement (UI spec, Screen host controls). */
export const BAR_IDLE_MS = 3000;
/** How long a shortcut's "Correct (C)" chip shows (SCR-13). */
export const FEEDBACK_MS = 600;

interface ScreenHostControlsProps {
  view: ScreenView;
  /** Shared with the lobby's settings, so one press anywhere waits for the next snapshot. */
  command: HostCommand;
  /** Opens the New game picker, offered in FINAL (DECISIONS F50). */
  onNewGame: () => void;
  /** The tile the arrow keys are on in BOARD, and how to move it (F90). */
  boardCursor: BoardCursor;
  onBoardCursor: (cursor: BoardCursor) => void;
  /** The bar's height in px while it shows, else 0: the Screen keeps that much clear (SCR-09). */
  onHeight: (px: number) => void;
}

/**
 * Host controls on a Screen that holds the hostToken: a one-row bar along the bottom edge and
 * keyboard shortcuts, with a `?` help dialog. They act on the ScreenView, which never carries the
 * answer before reveal, so nothing here can show it (DECISIONS #2).
 */
export function ScreenHostControls({
  view,
  command,
  onNewGame,
  boardCursor,
  onBoardCursor,
  onHeight,
}: ScreenHostControlsProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [help, setHelp] = useState(false);
  const helpClose = useRef<HTMLButtonElement>(null);
  const { moved, poke } = useRecentPointer(BAR_IDLE_MS);
  // A finger neither hovers nor moves without touching, so on touch the bar stays until the host
  // hides it (SCR-12). An open More menu keeps it up too.
  const coarse = usePointerCoarse();
  const barVisible = !collapsed && (coarse || moved || hovering || menuOpen);
  const [feedback, setFeedback] = useState<{ text: string; id: number } | null>(null);
  const say = (text: string) => setFeedback((current) => ({ text, id: (current?.id ?? 0) + 1 }));
  // The bar unmounts without a pointerleave, so hovering has to be cleared here.
  const collapse = () => {
    setCollapsed(true);
    setHovering(false);
  };

  useEffect(() => {
    if (!feedback) return;
    const timer = setTimeout(() => setFeedback(null), FEEDBACK_MS);
    return () => clearTimeout(timer);
  }, [feedback]);

  // On touch, a tap anywhere brings a hidden bar back.
  useEffect(() => {
    if (!coarse || !collapsed) return;
    const show = () => setCollapsed(false);
    window.addEventListener('pointerdown', show);
    return () => window.removeEventListener('pointerdown', show);
  }, [coarse, collapsed]);

  const bar = useRef<HTMLDivElement>(null);
  const reportHeight = useEffectEvent((px: number) => onHeight(px));
  useLayoutEffect(() => {
    const el = bar.current;
    if (!el) return;
    reportHeight(el.offsetHeight);
    // Wrapping on a narrow stage, or a new label, changes the height.
    const observer =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(() => reportHeight(el.offsetHeight));
    observer?.observe(el);
    return () => {
      observer?.disconnect();
      reportHeight(0);
    };
  }, [barVisible]);

  const onKey = useEffectEvent((e: KeyboardEvent) => {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    // The help is modal: only its own keys work, and Tab stays on its Close button.
    if (help) {
      if (e.key === 'Escape' || e.key === '?') {
        e.preventDefault();
        setHelp(false);
      } else if (e.key === 'Tab') {
        e.preventDefault();
        helpClose.current?.focus();
      }
      return;
    }
    // The More menu handles its own arrows, Enter and Esc.
    if (isTyping(e.target) || inMenu(e.target)) return;
    // On the board the arrows move between tiles and Enter picks one (F90). Previous and Next
    // don't apply there, so the arrows are free.
    if (view.phase === 'BOARD' && view.board) {
      const moved = moveCursor(view.board, boardCursor, e.key);
      if (moved) {
        e.preventDefault();
        return onBoardCursor(moved);
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        const tile = tileAt(view.board, boardCursor);
        if (tile && !tile.used && !command.busy) {
          const title = view.board.columns[boardCursor.column]?.title ?? '';
          say(`Pick ${title} ${tile.points} (Enter)`);
          command.run('host:pick', { questionIndex: tile.questionIndex });
        }
        return;
      }
    }
    const action = shortcutFor(e.key, view);
    if (!action) return;
    e.preventDefault();
    // A bar button keeps focus after a click; Space would press it on keyup as well.
    if (e.key === ' ' && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    const label = shortcutLabel(e.key, view);
    const echo = () => label && say(`${label} (${keyName(e.key)})`);
    if (action === 'fullscreen') {
      echo();
      return toggleFullscreen();
    }
    if (action === 'sound') {
      cycleSoundLevel();
      return say(`${SOUND_LEVEL_LABEL[getSoundLevel()]} (M)`);
    }
    if (action === 'help') return setHelp(true);
    if (action === 'bar') {
      // H acts on what the host can see: it hides a showing bar and brings back a hidden one.
      if (barVisible) return collapse();
      setCollapsed(false);
      return poke();
    }
    if (command.busy) return;
    echo();
    runCall(command, action);
  });

  useEffect(() => {
    const listener = (e: KeyboardEvent) => onKey(e);
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, []);

  const toolbar = (
    <div
      ref={bar}
      role="toolbar"
      aria-label="Host controls"
      onPointerEnter={() => setHovering(true)}
      onPointerLeave={() => setHovering(false)}
      // One row, so it never grows over the content (SCR-09). Only a narrow or portrait stage,
      // where one row cannot fit, lets it wrap: the content then stops above its measured height.
      className={`absolute inset-x-0 bottom-0 flex flex-nowrap items-center gap-[min(0.8vw,1.43vh)] border-t-2 border-edge bg-bg-deep/95 px-[min(2vw,3.56vh)] py-[1.2vh] ${BAR_TEXT} whitespace-nowrap stage-narrow:flex-wrap`}
    >
      <span className="flex items-center gap-[min(0.8vw,1.43vh)]">
        <MainButtons
          view={view}
          command={command}
          onNewGame={onNewGame}
          boardCursor={boardCursor}
        />
      </span>
      <span className="flex items-center gap-[min(0.8vw,1.43vh)]">
        <SideButtons view={view} command={command} />
      </span>
      <span className="ml-auto flex items-center gap-[min(0.8vw,1.43vh)]">
        <MoreMenu view={view} command={command} onOpenChange={setMenuOpen} />
        <BarButton keyHint="?" onClick={() => setHelp(true)}>
          Shortcuts
        </BarButton>
        <BarButton keyHint="H" onClick={collapse}>
          Hide controls
        </BarButton>
      </span>
    </div>
  );

  return (
    <>
      {barVisible
        ? toolbar
        : collapsed &&
          (coarse || moved) && (
            <button
              type="button"
              onClick={() => setCollapsed(false)}
              className={`absolute right-[min(2vw,3.56vh)] bottom-[1.2vh] rounded-full border-2 border-edge bg-surface px-[min(1.2vw,2.14vh)] py-[0.6vh] ${BAR_TEXT} ${HOVER}`}
            >
              {coarse ? (
                'Controls'
              ) : (
                <>
                  Show controls <Kbd>H</Kbd>
                </>
              )}
            </button>
          )}
      {/* With the bar out of sight, a faint reminder in the bottom rail that the keys still work
          (SCR-13). A keyboard is needed for it to mean anything, so not on touch. */}
      {!barVisible && !coarse && !help && (
        <button
          type="button"
          aria-label="Keyboard shortcuts"
          aria-keyshortcuts="Shift+?"
          onClick={() => setHelp(true)}
          // Centred on the rail (half its height), an opaque pill over the bulbs, its text faint.
          className={`absolute top-[calc(100%+min(1.57vw,2.79vh))] left-[min(3.75vw,6.67vh)] z-10 -translate-y-1/2 rounded-full border-2 border-edge bg-bg-deep px-[0.8em] text-[max(var(--screen-min-label),min(0.9vw,1.6vh))] text-ink/40 hover:text-ink focus-visible:text-ink ${HOVER}`}
        >
          <span aria-hidden className="font-mono">
            ?
          </span>{' '}
          Shortcuts
        </button>
      )}
      {feedback && (
        // A visual echo of a key press; the action's own result is what is announced.
        <p
          key={feedback.id}
          aria-hidden
          data-shortcut-feedback
          className="pointer-events-none absolute right-[min(2vw,3.56vh)] bottom-[calc(var(--bar-reserve,0px)+2vh)] z-40 rounded-full border-2 border-accent bg-surface px-[0.8em] py-[0.3em] font-display text-[max(var(--screen-min-body),min(1.4vw,2.5vh))] motion-safe:animate-pop-in"
        >
          {feedback.text}
        </p>
      )}
      {help && <HelpOverlay onClose={() => setHelp(false)} closeRef={helpClose} />}
    </>
  );
}

/** The bar's text: 14px at least, about 21px at 1080p. */
const BAR_TEXT = 'text-[clamp(0.875rem,1.1vw,1.75rem)]';

/**
 * The bar's left end: the phase's primary action, or the judge buttons, or the board's pick, or
 * New game. In the lobby Start game is left to Game setup's own button, so there is one (SCR-11).
 */
function MainButtons({
  view,
  command,
  onNewGame,
  boardCursor,
}: {
  view: ScreenView;
  command: HostCommand;
  onNewGame: () => void;
  boardCursor: BoardCursor;
}) {
  const { busy } = command;
  const act = (call: HostCommandCall) => () => runCall(command, call);
  const primary = view.phase === 'LOBBY' ? null : primaryFor(view);

  return (
    <>
      {view.phase === 'BUZZED' &&
        (view.canJudge ? (
          <>
            <BarButton
              keyHint="C"
              onClick={act({ event: 'host:judge', payload: { result: 'correct' } })}
              disabled={busy}
              tone="bg-win text-win-ink border-win font-display"
            >
              Correct
            </BarButton>
            <BarButton
              keyHint="V"
              onClick={act({ event: 'host:judge', payload: { result: 'half' } })}
              disabled={busy}
              tone="bg-accent text-accent-ink border-accent font-display"
            >
              Half
            </BarButton>
            <BarButton
              keyHint="X"
              onClick={act({ event: 'host:judge', payload: { result: 'wrong' } })}
              disabled={busy}
              tone="bg-buzz-ink text-ink border-buzz font-display"
            >
              Wrong
            </BarButton>
          </>
        ) : (
          <BarButton disabled>Reopening buzzers…</BarButton>
        ))}
      {primary && (
        <BarButton
          keyHint="Space"
          onClick={act({ event: primary.event, payload: {} })}
          disabled={busy}
          tone="bg-accent text-accent-ink border-accent font-display"
        >
          {primary.label}
        </BarButton>
      )}
      {view.phase === 'BOARD' && view.board && (
        <BoardPick view={view} command={command} cursor={boardCursor} />
      )}
      {view.phase === 'FINAL' && (
        <BarButton
          onClick={onNewGame}
          disabled={busy}
          tone="bg-accent text-accent-ink border-accent font-display"
        >
          New game
        </BarButton>
      )}
    </>
  );
}

/** The middle: the secondary actions used most, Skip question or the results card (SCR-09). */
function SideButtons({ view, command }: { view: ScreenView; command: HostCommand }) {
  return (
    <>
      {view.phase === 'FINAL' && (
        // A laptop has no share sheet worth opening: the card downloads (F78).
        <ShareResults
          card={() => cardFromRoom(view, new Date())}
          mode="download"
          className={`${barButton} border-edge bg-bg`}
        />
      )}
      {UNREVEALED.includes(view.phase) && (
        <BarButton
          keyHint="R"
          onClick={() => runCall(command, { event: 'host:reveal', payload: {} })}
          disabled={command.busy}
        >
          Skip question
        </BarButton>
      )}
    </>
  );
}

/**
 * **More ▾**: the rest of the host's actions, End game last and red (SCR-09, FND-07). Every one
 * keeps its key, which the menu shows.
 */
function MoreMenu({
  view,
  command,
  onOpenChange,
}: {
  view: ScreenView;
  command: HostCommand;
  onOpenChange: (open: boolean) => void;
}) {
  const { busy } = command;
  const soundLevel = useSoundLevel();
  const coarse = usePointerCoarse();
  const hint = (key: string) => (coarse ? undefined : key);
  const send = (call: HostCommandCall) => () => runCall(command, call);
  const playing = inGame(view);
  const items: MenuItem[] = [
    ...(playing
      ? [
          {
            label: 'Undo',
            keyHint: hint('U'),
            onSelect: send({ event: 'host:undo', payload: {} }),
            disabled: busy || !view.canUndo,
          },
        ]
      : []),
    ...(playing && view.phase !== 'BOARD'
      ? [
          {
            label: 'Previous',
            keyHint: hint('←'),
            onSelect: send({ event: 'host:prev', payload: {} }),
            disabled: busy || !canGoBack(view),
          },
        ]
      : []),
    {
      label: view.showScoreboard ? 'Hide scoreboard' : 'Show scoreboard',
      keyHint: hint('S'),
      onSelect: send({ event: 'host:scoreboard', payload: { show: !view.showScoreboard } }),
      disabled: busy,
    },
    { label: SOUND_LEVEL_LABEL[soundLevel], keyHint: hint('M'), onSelect: cycleSoundLevel },
    { label: 'Fullscreen', keyHint: hint('F'), onSelect: toggleFullscreen },
    ...(view.phase !== 'FINAL'
      ? [
          {
            label: 'End game',
            confirmLabel: 'Confirm end',
            onSelect: send({ event: 'host:end', payload: {} }),
            disabled: busy,
          },
        ]
      : []),
  ];
  return (
    <OverflowMenu
      // A new phase or question closes the menu and disarms End game, so a stale Confirm end
      // can't be pressed later.
      key={`${view.phase}-${view.questionIndex}`}
      label="More"
      trigger={
        <>
          More <span aria-hidden>▾</span>
        </>
      }
      triggerClassName={`${barButton} border-edge bg-bg`}
      items={items}
      placement="above"
      itemText={BAR_TEXT}
      onOpenChange={onOpenChange}
    />
  );
}

/**
 * In BOARD: "Pick Animals 200" for the tile under the arrow keys' cursor, or, once every tile is
 * played (after a Previous from the last one), a pointer to End game (DECISIONS F89).
 */
function BoardPick({
  view,
  command,
  cursor,
}: {
  view: ScreenView;
  command: HostCommand;
  cursor: BoardCursor;
}) {
  const board = view.board!;
  if (boardDone(board)) {
    return <span className="text-muted">Every tile played: End game is under More</span>;
  }
  const tile = tileAt(board, cursor);
  const title = board.columns[cursor.column]?.title ?? '';
  return (
    <BarButton
      keyHint="Enter"
      onClick={() => tile && command.run('host:pick', { questionIndex: tile.questionIndex })}
      disabled={command.busy || !tile || tile.used}
      tone="bg-accent text-accent-ink border-accent font-display"
    >
      {tile?.used ? `${title} ${tile.points} played` : `Pick ${title} ${tile?.points ?? ''}`}
    </BarButton>
  );
}

const BAR_BUTTON_SHAPE =
  'rounded-[min(1.1vw,2vh)] border-2 px-[min(1vw,1.78vh)] py-[0.6vh] transition disabled:opacity-40';
const barButton = `${BAR_BUTTON_SHAPE} ${HOVER}`;

interface BarButtonProps {
  children: ReactNode;
  keyHint?: string;
  onClick?: () => void;
  disabled?: boolean;
  /** Background, text and border colours; a plain button by default. */
  tone?: string;
}

function BarButton({ children, keyHint, onClick, disabled, tone }: BarButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-keyshortcuts={keyHint && ariaKey(keyHint)}
      className={`${barButton} ${tone ?? 'border-edge bg-bg'}`}
    >
      {children}
      {keyHint && <Kbd>{keyHint}</Kbd>}
    </button>
  );
}

/** A key hint after a label; none on touch, where there is no keyboard to press it (SCR-12). */
function Kbd({ children }: { children: ReactNode }) {
  const coarse = usePointerCoarse();
  if (coarse) return null;
  return (
    <kbd
      aria-hidden
      className="ml-[min(0.5vw,0.89vh)] font-mono text-[max(var(--screen-min-label),0.8em)] opacity-70"
    >
      {children}
    </kbd>
  );
}

/**
 * The `?` dialog listing every shortcut, readable from across the room. Modal: focus moves to its
 * heading and returns on close. Two columns on a landscape display, so all of it fits at 720p, and
 * it scrolls only as a safety net (SCR-10).
 */
function HelpOverlay({
  onClose,
  closeRef,
}: {
  onClose: () => void;
  closeRef: RefObject<HTMLButtonElement | null>;
}) {
  const headingId = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const before = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    heading.current?.focus();
    return () => {
      if (before?.isConnected) before.focus();
    };
  }, []);
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-bg/80 p-[2vh]">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        className="flex max-h-full w-full max-w-[52em] flex-col gap-[2vh] overflow-y-auto rounded-[2vh] border-2 border-edge bg-surface px-[min(3vw,5.34vh)] py-[3vh] text-[clamp(1rem,1.6vw,2.5rem)]"
      >
        <h2
          ref={heading}
          id={headingId}
          tabIndex={-1}
          className="font-display text-[1.4em] focus:outline-none"
        >
          Keyboard shortcuts
        </h2>
        <dl className="gap-x-[min(3vw,5.34vh)] landscape:columns-2">
          {SHORTCUTS.map(({ keys, action }) => (
            <div key={action} className="flex gap-[min(1.5vw,2.67vh)] pb-[1vh] break-inside-avoid">
              <dt className="w-[5.5em] shrink-0 font-mono whitespace-nowrap text-accent">
                {keys.join(' or ')}
              </dt>
              <dd>{action}</dd>
            </div>
          ))}
        </dl>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          className={`${barButton} self-end border-edge bg-bg`}
        >
          Close <Kbd>Esc</Kbd>
        </button>
      </div>
    </div>
  );
}

/**
 * `moved` is true until `ms` after the last pointer movement or press (and for `ms` after mount):
 * a tap on a touch screen may send no `pointermove` (SCR-12). `poke` restarts the wait as if the
 * pointer had moved.
 */
function useRecentPointer(ms: number): { moved: boolean; poke: () => void } {
  const [moved, setMoved] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const poke = useCallback(() => {
    clearTimeout(timer.current);
    setMoved(true);
    timer.current = setTimeout(() => setMoved(false), ms);
  }, [ms]);

  useEffect(() => {
    // `moved` starts true, so mounting only has to start the wait.
    timer.current = setTimeout(() => setMoved(false), ms);
    window.addEventListener('pointermove', poke);
    window.addEventListener('pointerdown', poke);
    return () => {
      window.removeEventListener('pointermove', poke);
      window.removeEventListener('pointerdown', poke);
      clearTimeout(timer.current);
    };
  }, [ms, poke]);

  return { moved, poke };
}

function isTyping(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
  );
}

function inMenu(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && target.closest('[role="menu"]') !== null;
}

/** `aria-keyshortcuts` uses key names, not symbols. */
function ariaKey(hint: string): string {
  return { '←': 'ArrowLeft', '?': 'Shift+?' }[hint] ?? hint;
}
