import { useCallback, useEffect, useRef, useState } from 'react';
import { LAST_SECONDS_MS } from '../../../../shared/constants.js';
import type { PlayerView } from '../../../../shared/types.js';
import type { DrawerInkLink } from '../../ink/drawerSync.js';
import type { PadState } from '../../ink/padTools.js';
import type { Translate } from '../../lib/copy.js';
import { DRAWER_BAR_PX, drawerPadSize, drawerSideways, inkNudge } from '../../lib/phone.js';
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
  /** Who is close, while "Bea is close!" is up (`closeAlert.ts`). */
  closePid: string | null;
  /**
   * The crown holder's 👑 Host pill sits at the end of the bar's first row. The page places it
   * (outside this view, so it stays in reach while paused); the bar keeps its room free.
   */
  hostButton?: boolean;
  t: Translate;
}

/** Room the bar leaves at its right end for the page's 👑 Host pill (`HostDrawer` "drawer"). */
export const HOST_PILL_ROOM = 'pr-[5.5rem]';

/**
 * The drawer's phone in DRAWING (UI by role and phase, Drawer phone and Drawer layout; Sketchbook
 * Drawer), on the page's dot grid: a 56 px bar with the word (16 px in `soft`, so the next person
 * on the couch can't read it), the Nunito clock (`red` in the last 10 s), "2 of 4 got it", room
 * for the 👑 Host pill, and the latest wrong guess (or "Bea is close!" on an amber swash for 2 s);
 * the square pad in its ink frame, with "Start with one big shape. Anything helps!" in `pen` at
 * its top edge if nothing is drawn 10 s in; two 48 px rows. Scroll, zoom and
 * pull-to-refresh are locked while it shows (`touch-none` on the whole view, so a pinch on the bar
 * or the toolbar doesn't zoom either). The screen stays on through the page's game-long Wake Lock
 * (`Play.tsx`, F37).
 *
 * Turned on its side, a phone's pad wouldn't fit: "Turn your phone upright" covers the view, the
 * stroke in hand ends and the tools wait. The pad stays mounted at its upright size, so the turn's
 * strokes and sender carry on when the phone turns back (Edge cases).
 */
export function DrawerTurn({
  view,
  receivedAt,
  ink,
  paused,
  closePid,
  hostButton = false,
  t,
}: Props) {
  useDrawLock(true);
  const boxRef = useRef<HTMLDivElement>(null);
  const [pad, setPad] = useState(0);
  const [sideways, setSideways] = useState(false);
  // Every turn starts with the black pen at M (Tools: defaults); a new turn remounts this view.
  const [tool, setTool] = useState(DEFAULT_TOOL);
  const [padState, setPadState] = useState<PadState>({
    ready: false,
    canUndo: false,
    canClear: false,
  });
  // Anything on the pad's stack this turn (a stroke begun, or ink from before a reload).
  const [drew, setDrew] = useState(false);
  const onPadState = useCallback((state: PadState) => {
    setPadState(state);
    if (state.canUndo) setDrew(true);
  }, []);
  const controlsRef = useRef<PadControls | null>(null);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const measure = () => {
      const { clientWidth: w, clientHeight: h } = box;
      const turned = drawerSideways(w, h);
      setSideways(turned);
      // A turn that starts sideways gets the pad it will have upright, so it binds to the turn now.
      setPad((prev) => (turned ? prev || drawerPadSize(h, w) : drawerPadSize(w, h)));
    };
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    measure();
    return () => observer.disconnect();
  }, []);

  const turn = view.turn!;
  const left = useCountdown(turn.timer, receivedAt);
  const word = view.secret?.word?.word ?? '';
  const last = view.lastGuess;
  const nameOf = (pid: string) => view.players.find((p) => p.pid === pid)?.name ?? '';
  const nudge = inkNudge(turn.timer, left, { ready: padState.ready, drew });
  const closeName = closePid !== null ? nameOf(closePid) : '';
  const low = left <= LAST_SECONDS_MS;

  return (
    <div
      ref={boxRef}
      className="relative flex h-full w-full touch-none flex-col items-center overflow-hidden select-none"
    >
      <header
        inert={sideways}
        style={{ height: DRAWER_BAR_PX }}
        className="flex w-full shrink-0 flex-col justify-center px-1.5"
      >
        {/* Only the first row makes room for the pill; its tap area hangs over row 2's end, which
            is text only. */}
        <p
          className={`flex h-7 items-center gap-2.5 text-base leading-7 ${hostButton ? HOST_PILL_ROOM : ''}`}
        >
          <strong className="min-w-0 truncate font-normal text-soft">{word}</strong>
          <span
            role="timer"
            className={`shrink-0 font-num text-xl font-black tabular-nums ${low ? 'text-red' : 'text-ink'}`}
          >
            {formatClock(left)}
          </span>
          <span className="truncate">
            {t('gotItCount', { guessed: turn.guessed.guessed, of: turn.guessed.of })}
          </span>
        </p>
        <GuessLine
          close={closeName || null}
          last={last ? { name: nameOf(last.pid), text: last.text } : null}
          t={t}
        />
      </header>
      <div inert={sideways} className="relative grid min-h-0 w-full flex-1 place-items-center">
        {pad > 0 && (
          <DrawPad
            turnId={turn.id}
            size={pad}
            ink={ink}
            disabled={paused || sideways}
            label={t('noInkYet')}
            tool={tool}
            controlsRef={controlsRef}
            onState={onPadState}
          />
        )}
        {nudge && (
          // 4 px above the centred pad (28 px tall), or over its top edge where there's no room
          // (24 px over at 360 × 560), so nothing moves; a touch on it goes through to the pad.
          <p
            aria-hidden
            style={{ top: `max(4px, calc(50% - ${pad / 2}px - 32px))` }}
            className="pointer-events-none absolute inset-x-2 mx-auto w-fit max-w-full rounded-full bg-paper px-3 py-1 text-center text-base leading-5 text-pen"
          >
            {t('startBigShape')}
          </p>
        )}
        {/* Always mounted, so screen readers announce the nudge when it fills. */}
        <p role="status" className="sr-only">
          {nudge ? t('startBigShape') : ''}
        </p>
      </div>
      <div inert={sideways} className="w-full">
        <DrawToolbar
          tool={tool}
          onTool={setTool}
          pad={padState}
          onUndo={() => controlsRef.current?.undo()}
          onClear={() => controlsRef.current?.clear()}
          disabled={paused || sideways}
          t={t}
        />
      </div>
      {sideways && <TurnUpright clock={formatClock(left)} t={t} />}
    </div>
  );
}

/**
 * The second line of the drawer's top bar: "Bea is close!" on an amber highlighter swash while an
 * alert is up, else the latest wrong guess as the view masked it ("•••" when masked). Polite, so it
 * never interrupts.
 */
export function GuessLine({
  close,
  last,
  t,
}: {
  close: string | null;
  last: { name: string; text: string | null } | null;
  t: Translate;
}) {
  return (
    <p aria-live="polite" className="h-6 truncate text-[17px] leading-6 text-ink">
      {close !== null ? (
        // The swash is the `highlight` utility with its colour switched to `amber`.
        <strong className="highlight font-normal [--color-hl:var(--color-amber)]">
          {t('isClose', { name: close })}
        </strong>
      ) : last ? (
        `${last.name}: ${last.text ?? '•••'}`
      ) : (
        ''
      )}
    </p>
  );
}

/**
 * "Turn your phone upright" over the drawer's view while the phone is on its side. The clock stays
 * in sight (the turn runs on); the word doesn't.
 */
export function TurnUpright({ clock, t }: { clock: string; t: Translate }) {
  return (
    <div
      role="alert"
      className="paper-dots absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-paper px-6 text-center font-hand text-ink"
    >
      <svg aria-hidden viewBox="0 0 48 48" className="size-16" fill="none" stroke="currentColor">
        <rect x="14" y="6" width="20" height="36" rx="3" strokeWidth="3" />
        <path d="M40 18a16 16 0 0 1-4 18" strokeWidth="3" strokeLinecap="round" />
        <path d="M36 36l-1-6m1 6l5-3" strokeWidth="3" strokeLinecap="round" />
      </svg>
      <p className="text-[30px] leading-tight">{t('turnUpright')}</p>
      <p className="text-lg text-soft">{t('drawingIsSafe')}</p>
      <p className="font-num text-2xl font-black tabular-nums">◔ {clock}</p>
    </div>
  );
}
