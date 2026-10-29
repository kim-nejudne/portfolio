import { useCallback, useEffect, useEffectEvent, useRef, useState, type ReactNode } from 'react';
import type { ScreenView } from '../../../shared/types.js';
import { boardDone, moveCursor, tileAt, type BoardCursor } from '../lib/boardCursor.js';
import {
  canGoBack,
  inGame,
  primaryFor,
  runCall,
  shortcutFor,
  SHORTCUTS,
  UNREVEALED,
  type HostCommandCall,
} from '../lib/hostControls.js';
import { toggleFullscreen } from '../lib/fullscreen.js';
import { HOVER } from '../lib/hover.js';
import { cardFromRoom } from '../lib/resultsCard.js';
import { cycleSoundLevel, SOUND_LEVEL_LABEL } from '../lib/sounds.js';
import type { HostCommand } from '../lib/useHostCommand.js';
import { useSoundLevel } from '../lib/useSoundLevel.js';
import { ConfirmButton } from './ConfirmButton.js';
import { ShareResults } from './ShareResults.js';

/** The bar hides after this long without mouse movement (UI spec, Screen host controls). */
export const BAR_IDLE_MS = 3000;

interface ScreenHostControlsProps {
  view: ScreenView;
  /** Shared with the lobby's settings, so one press anywhere waits for the next snapshot. */
  command: HostCommand;
  /** Opens the New game picker, offered in FINAL (DECISIONS F50). */
  onNewGame: () => void;
  /** The tile the arrow keys are on in BOARD, and how to move it (F90). */
  boardCursor: BoardCursor;
  onBoardCursor: (cursor: BoardCursor) => void;
}

/**
 * Host controls on a Screen that holds the hostToken: a bar along the bottom edge and keyboard
 * shortcuts, with a `?` help overlay. They act on the ScreenView, which never carries the answer
 * before reveal, so nothing here can show it (DECISIONS #2).
 */
export function ScreenHostControls({
  view,
  command,
  onNewGame,
  boardCursor,
  onBoardCursor,
}: ScreenHostControlsProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [help, setHelp] = useState(false);
  const { moved, poke } = useRecentPointer(BAR_IDLE_MS);
  const barVisible = !collapsed && (moved || hovering);
  const soundLevel = useSoundLevel();
  // The bar unmounts without a pointerleave, so hovering has to be cleared here.
  const collapse = () => {
    setCollapsed(true);
    setHovering(false);
  };

  const onKey = useEffectEvent((e: KeyboardEvent) => {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return;
    if (e.key === 'Escape' && help) return setHelp(false);
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
    if (action === 'fullscreen') return toggleFullscreen();
    if (action === 'sound') return cycleSoundLevel();
    if (action === 'help') return setHelp((open) => !open);
    if (action === 'bar') {
      // H acts on what the host can see: it hides a showing bar and brings back a hidden one.
      if (barVisible) return collapse();
      setCollapsed(false);
      return poke();
    }
    if (!command.busy) runCall(command, action);
  });

  useEffect(() => {
    const listener = (e: KeyboardEvent) => onKey(e);
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, []);

  return (
    <>
      {barVisible ? (
        <div
          role="toolbar"
          aria-label="Host controls"
          onPointerEnter={() => setHovering(true)}
          onPointerLeave={() => setHovering(false)}
          className="absolute inset-x-0 bottom-0 flex flex-wrap items-center gap-[0.8vw] border-t-2 border-edge bg-bg-deep/95 px-[2vw] py-[1.2vh] text-[clamp(0.875rem,1.1vw,1.75rem)]"
        >
          <GameButtons
            view={view}
            command={command}
            onNewGame={onNewGame}
            boardCursor={boardCursor}
          />
          <span className="ml-auto flex gap-[0.8vw]">
            <BarButton keyHint="M" onClick={cycleSoundLevel}>
              {SOUND_LEVEL_LABEL[soundLevel]}
            </BarButton>
            <BarButton keyHint="F" onClick={toggleFullscreen}>
              Fullscreen
            </BarButton>
            <BarButton keyHint="?" onClick={() => setHelp((open) => !open)}>
              Shortcuts
            </BarButton>
            <BarButton keyHint="H" onClick={collapse}>
              Hide controls
            </BarButton>
          </span>
        </div>
      ) : (
        collapsed &&
        moved && (
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            className={`absolute right-[2vw] bottom-[1.2vh] rounded-full border-2 border-edge bg-surface px-[1.2vw] py-[0.6vh] text-[clamp(0.875rem,1.1vw,1.75rem)] ${HOVER}`}
          >
            Show controls <Kbd>H</Kbd>
          </button>
        )
      )}
      {help && <HelpOverlay onClose={() => setHelp(false)} />}
    </>
  );
}

/** The bar's game actions, with the same rules as the remote's (UI spec, Host remote). */
function GameButtons({
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
  const primary = primaryFor(view);
  const playing = inGame(view);

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
      {view.phase === 'FINAL' && (
        // A laptop has no share sheet worth opening: the card downloads (F78).
        <ShareResults
          card={() => cardFromRoom(view, new Date())}
          mode="download"
          className={`${barButton} border-edge bg-bg`}
        />
      )}
      {UNREVEALED.includes(view.phase) && (
        <BarButton keyHint="R" onClick={act({ event: 'host:reveal', payload: {} })} disabled={busy}>
          Skip question
        </BarButton>
      )}
      {playing && view.phase !== 'BOARD' && (
        <BarButton
          keyHint="←"
          onClick={act({ event: 'host:prev', payload: {} })}
          disabled={busy || !canGoBack(view)}
        >
          Previous
        </BarButton>
      )}
      {playing && (
        <BarButton
          keyHint="U"
          onClick={act({ event: 'host:undo', payload: {} })}
          disabled={busy || !view.canUndo}
        >
          Undo
        </BarButton>
      )}
      <BarButton
        keyHint="S"
        pressed={view.showScoreboard}
        onClick={act({ event: 'host:scoreboard', payload: { show: !view.showScoreboard } })}
        disabled={busy}
      >
        Scoreboard
      </BarButton>
      {view.phase !== 'FINAL' && (
        <ConfirmButton
          // A new phase or question disarms it, so a stale Confirm end can't be clicked later.
          key={`${view.phase}-${view.questionIndex}`}
          label="End game"
          confirmLabel="Confirm end"
          onConfirm={() => runCall(command, { event: 'host:end', payload: {} })}
          disabled={busy}
          className={`${barButton} border-edge`}
        />
      )}
    </>
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
  if (boardDone(board)) return <span className="text-muted">Every tile played: End game</span>;
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

const barButton = `rounded-[min(1.1vw,2vh)] border-2 px-[1vw] py-[0.6vh] transition disabled:opacity-40 ${HOVER}`;

interface BarButtonProps {
  children: ReactNode;
  keyHint?: string;
  onClick?: () => void;
  disabled?: boolean;
  pressed?: boolean;
  /** Background, text and border colours; a plain button by default. */
  tone?: string;
}

function BarButton({ children, keyHint, onClick, disabled, pressed, tone }: BarButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={pressed}
      aria-keyshortcuts={keyHint && ariaKey(keyHint)}
      className={`${barButton} ${tone ?? (pressed ? 'border-accent bg-edge' : 'border-edge bg-bg')}`}
    >
      {children}
      {keyHint && <Kbd>{keyHint}</Kbd>}
    </button>
  );
}

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd aria-hidden className="ml-[0.5vw] font-mono text-[0.8em] opacity-70">
      {children}
    </kbd>
  );
}

/** The `?` overlay listing every shortcut, readable from across the room. */
function HelpOverlay({ onClose }: { onClose: () => void }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-bg/80">
      <div
        role="dialog"
        aria-label="Keyboard shortcuts"
        className="flex flex-col gap-[2vh] rounded-[2vh] border-2 border-edge bg-surface px-[3vw] py-[3vh] text-[clamp(1rem,1.6vw,2.5rem)]"
      >
        <h2 className="font-display text-[1.4em]">Keyboard shortcuts</h2>
        <table>
          <tbody>
            {SHORTCUTS.map(({ keys, action }) => (
              <tr key={action}>
                <td className="pr-[2vw] font-mono whitespace-nowrap text-accent">
                  {keys.join(' or ')}
                </td>
                <td>{action}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <button
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
 * `moved` is true until `ms` after the last pointer movement (and for `ms` after mount). `poke`
 * restarts the wait as if the pointer had moved.
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
    return () => {
      window.removeEventListener('pointermove', poke);
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

/** `aria-keyshortcuts` uses key names, not symbols. */
function ariaKey(hint: string): string {
  return { '←': 'ArrowLeft', '?': 'Shift+?' }[hint] ?? hint;
}
