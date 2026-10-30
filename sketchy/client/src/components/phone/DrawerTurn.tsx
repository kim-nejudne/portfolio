import { useEffect, useRef, useState } from 'react';
import type { PlayerView } from '../../../../shared/types.js';
import type { DrawerInkLink } from '../../ink/drawerSync.js';
import type { PadState } from '../../ink/padTools.js';
import type { Translate } from '../../lib/copy.js';
import { DRAWER_BAR_PX, drawerPadSize } from '../../lib/phone.js';
import { formatClock } from '../../lib/screen.js';
import { DEFAULT_TOOL } from '../../lib/tools.js';
import { useCountdown } from '../../lib/useCountdown.js';
import { useDrawLock } from '../../lib/useDrawLock.js';
import { DrawPad, type PadControls } from './DrawPad.js';
import { DrawToolbar } from './DrawToolbar.js';

interface Props {
  view: PlayerView;
  receivedAt: number;
  ink: DrawerInkLink;
  /** A pause ends the stroke in hand and stops drawing until it lifts. */
  paused: boolean;
  t: Translate;
}

/**
 * The drawer's phone in DRAWING (UI by role and phase, Drawer phone and Drawer layout): a 56 px
 * bar with the word (small, so the next person on the couch can't read it), the clock, "2 of 4 got
 * it" and the latest wrong guess; the square pad; two 48 px toolbar rows. Scroll, zoom and
 * pull-to-refresh are locked while it shows.
 */
export function DrawerTurn({ view, receivedAt, ink, paused, t }: Props) {
  useDrawLock(true);
  const boxRef = useRef<HTMLDivElement>(null);
  const [pad, setPad] = useState(0);
  // Every turn starts with the black pen at M (Tools: defaults); a new turn remounts this view.
  const [tool, setTool] = useState(DEFAULT_TOOL);
  const [padState, setPadState] = useState<PadState>({ canUndo: false, canClear: false });
  const controlsRef = useRef<PadControls | null>(null);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const measure = () => setPad(drawerPadSize(box.clientWidth, box.clientHeight));
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    measure();
    return () => observer.disconnect();
  }, []);

  const turn = view.turn!;
  const left = useCountdown(turn.timer, receivedAt);
  const word = view.secret?.word?.word ?? '';
  const last = view.lastGuess;
  const lastName = last ? (view.players.find((p) => p.pid === last.pid)?.name ?? '') : '';

  return (
    <div ref={boxRef} className="flex h-full w-full flex-col items-center select-none">
      <header
        style={{ height: DRAWER_BAR_PX }}
        className="flex w-full shrink-0 flex-col justify-center px-3"
      >
        <p className="flex items-baseline gap-2 text-base leading-6">
          <strong className="min-w-0 truncate font-semibold">{word}</strong>
          <span aria-hidden>·</span>
          <span className={`tabular-nums ${left <= 10_000 ? 'text-[#FF8F5E]' : ''}`}>
            ◔ {formatClock(left)}
          </span>
          <span aria-hidden>·</span>
          <span className="truncate">
            {t('gotItCount', { guessed: turn.guessed.guessed, of: turn.guessed.of })}
          </span>
        </p>
        <p className="h-5 truncate text-sm leading-5 text-white/70">
          {last ? `${lastName}: ${last.text ?? '•••'}` : ''}
        </p>
      </header>
      <div className="grid min-h-0 w-full flex-1 place-items-center">
        {pad > 0 && (
          <DrawPad
            turnId={turn.id}
            size={pad}
            ink={ink}
            disabled={paused}
            label={t('noInkYet')}
            tool={tool}
            controlsRef={controlsRef}
            onState={setPadState}
          />
        )}
      </div>
      <DrawToolbar
        tool={tool}
        onTool={setTool}
        pad={padState}
        onUndo={() => controlsRef.current?.undo()}
        onClear={() => controlsRef.current?.clear()}
        disabled={paused}
        t={t}
      />
    </div>
  );
}
