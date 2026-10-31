import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ScreenView } from '../../../../shared/types.js';
import type { CopyKey, Translate } from '../../lib/copy.js';
import {
  CONFIRM_LABELS,
  CONFIRM_MS,
  FEED_LABELS,
  LABELS,
  SHORTCUTS,
  barControls,
  controlEvent,
  dialogKey,
  press,
  pressKey,
  type Armed,
  type ControlId,
  type HostCommand,
} from '../../lib/hostKeys.js';
import { hostRefusalCopy } from '../../lib/hostSend.js';
import type { GameSocket } from '../../lib/socket.js';
import { PlayersDialog } from './PlayersDialog.js';
import { sketchButtonClass, type SketchVariant } from '../sketch/SketchButton.js';
import { Tape } from '../sketch/Tape.js';
import {
  loadSoundLevel,
  nextSoundLevel,
  saveSoundLevel,
  type SoundLevel,
} from '../../lib/soundPref.js';

/** The bar hides after this long without mouse movement or touch. */
const AUTO_HIDE_MS = 3000;
/** How long a hint or a refusal stays up. */
const STATUS_MS = 3000;
const ACK_TIMEOUT_MS = 5000;

/** The hint after a first key press of a two-press shortcut. */
const PRESS_AGAIN: Partial<Record<ControlId, CopyKey>> = {
  skip: 'pressAgainSkip',
  end: 'pressAgainEnd',
  rematch: 'pressAgainRematch',
  backToLobby: 'pressAgainLobby',
};

const SOUND_LABELS: Record<SoundLevel, { label: CopyKey; icon: string }> = {
  on: { label: 'soundOn', icon: '🔊' },
  quiet: { label: 'soundQuiet', icon: '🔉' },
  muted: { label: 'soundMuted', icon: '🔇' },
};

/** Typing in a field, or Space on a focused button, keeps the key's own meaning. */
function keepsOwnMeaning(e: KeyboardEvent): boolean {
  const el = e.target instanceof Element ? e.target : null;
  if (!el) return false;
  if (el.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])'))
    return true;
  return e.key === ' ' && el.closest('button, a, [role="button"]') !== null;
}

/**
 * The token Screen's host controls (Host controls): a control bar along the bottom edge that
 * auto-hides after 3 s without mouse movement or touch, the keyboard shortcuts, and the `?`
 * overlay. Mounted only while the Screen holds the token (`view.host`); the server checks every
 * event again. Replaces F20's Next button.
 */
export function HostControls(props: { view: ScreenView; socket: GameSocket; t: Translate }) {
  return props.view.host ? <TokenScreenControls {...props} /> : null;
}

function TokenScreenControls({
  view,
  socket,
  t,
}: {
  view: ScreenView;
  socket: GameSocket;
  t: Translate;
}) {
  const [visible, setVisible] = useState(true);
  const [helpOpen, setHelpOpen] = useState(false);
  const [playersOpen, setPlayersOpen] = useState(false);
  const closePlayers = useCallback(() => setPlayersOpen(false), []);
  const [armedAt, setArmed] = useState<(Armed & { scope: string }) | null>(null);
  // A first press never carries over into another phase or turn: S in one turn and S in the next
  // must not skip the new one.
  const scope = `${view.phase}:${view.turn?.id ?? ''}`;
  const armed = armedAt?.scope === scope ? armedAt : null;
  const [sending, setSending] = useState<ControlId | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [sound, setSound] = useState<SoundLevel>(loadSoundLevel);
  const fullscreenSupported = typeof document !== 'undefined' && document.fullscreenEnabled;
  const [fullscreen, setFullscreen] = useState(false);

  const barRef = useRef<HTMLDivElement>(null);

  // The listeners are attached once; they read the latest snapshot and state through refs.
  const latest = useRef({ view, armed, helpOpen, scope });
  useLayoutEffect(() => {
    latest.current = { view, armed, helpOpen, scope };
  });

  // Auto-hide: any mouse movement, touch or Tab shows the bar for another 3 s.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    // Keyboard focus inside the bar keeps it up; focus left on a clicked button does not.
    const hide = () => {
      const active = document.activeElement;
      if (active && barRef.current?.contains(active) && active.matches(':focus-visible'))
        timer = setTimeout(hide, AUTO_HIDE_MS);
      else setVisible(false);
    };
    const wake = () => {
      setVisible(true);
      clearTimeout(timer);
      timer = setTimeout(hide, AUTO_HIDE_MS);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Tab') wake();
    };
    wake();
    window.addEventListener('pointermove', wake);
    window.addEventListener('pointerdown', wake);
    window.addEventListener('touchstart', wake, { passive: true });
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('pointermove', wake);
      window.removeEventListener('pointerdown', wake);
      window.removeEventListener('touchstart', wake);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  // A first press disarms after the confirm window; a status line goes after a few seconds.
  useEffect(() => {
    if (!armedAt) return;
    const timer = setTimeout(() => setArmed(null), CONFIRM_MS);
    return () => clearTimeout(timer);
  }, [armedAt]);
  useEffect(() => {
    if (!status) return;
    const timer = setTimeout(() => setStatus(null), STATUS_MS);
    return () => clearTimeout(timer);
  }, [status]);

  // A new guess feed is announced from the snapshot (never predicted), so `G` with the bar
  // hidden still shows what it switched to.
  const feed = view.settings.guessFeed;
  const shownFeed = useRef(feed);
  useEffect(() => {
    if (shownFeed.current === feed) return;
    shownFeed.current = feed;
    setStatus(t('guessFeedNow', { feed: t(FEED_LABELS[feed]) }));
  }, [feed, t]);

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement !== null);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const send = useCallback(
    async (control: ControlId) => {
      // Offline, Socket.IO would buffer the event and send it on reconnect: a Skip or End tapped
      // during a wifi blip must not land later.
      if (!socket.connected) return setStatus(t('hostActionFailed'));
      const { event, payload } = controlEvent(control, latest.current.view);
      setSending(control);
      try {
        const res = await socket.timeout(ACK_TIMEOUT_MS).emitWithAck(event, payload as never);
        // Other refusals (the phase moved on, a race) need no message: the next `state` shows it.
        const message = res.ok ? null : hostRefusalCopy(res.error);
        if (message) setStatus(t(message));
      } catch {
        setStatus(t('hostActionFailed'));
      } finally {
        setSending(null);
      }
    },
    [socket, t],
  );

  const toggleFullscreen = useCallback(() => {
    const done = document.fullscreenElement
      ? document.exitFullscreen()
      : document.documentElement.requestFullscreen();
    // Refused (no user gesture, or not allowed here): nothing to undo.
    done.catch(() => {});
  }, []);

  const cycleSound = useCallback(() => {
    const next = nextSoundLevel(sound);
    saveSoundLevel(next);
    setSound(next);
    setStatus(t('soundNow', { level: t(SOUND_LABELS[next].label) }));
  }, [sound, t]);

  const run = useCallback(
    (command: HostCommand, byKey: boolean, now: number) => {
      switch (command.kind) {
        case 'send':
          setArmed(null);
          setStatus(null);
          void send(command.control);
          return;
        case 'arm': {
          setArmed({ control: command.control, at: now, scope: latest.current.scope });
          // A tap's hint repeats the button's new label, so it is announced too.
          const hint = (byKey ? PRESS_AGAIN : CONFIRM_LABELS)[command.control];
          if (hint) setStatus(t(hint));
          return;
        }
        case 'fullscreen':
          return toggleFullscreen();
        case 'sound':
          return cycleSound();
        case 'help':
          return setHelpOpen((open) => !open);
      }
    },
    [send, t, toggleFullscreen, cycleSound],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat || e.isComposing || keepsOwnMeaning(e))
        return;
      const { view: v, armed: a, helpOpen: open } = latest.current;
      const otherDialog = document.querySelector('[role="dialog"][aria-modal="true"]') !== null;
      const gate = dialogKey(e.key, open ? 'help' : otherDialog ? 'other' : null);
      if (gate === 'closeHelp') {
        // Only the overlay closes: the settings panel's own Esc listener must not see it.
        e.preventDefault();
        e.stopImmediatePropagation();
        setHelpOpen(false);
      }
      if (gate !== 'pass') return;
      const now = performance.now();
      const { command } = pressKey(e.key, v, a, now);
      if (!command) return;
      e.preventDefault();
      run(command, true, now);
    };
    // Capture, so this runs before the settings panel's bubbling Esc listener.
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true });
  }, [run]);

  const tap = (control: ControlId) => {
    if (sending === control) return;
    const now = performance.now();
    run(press(control, armed, now).command, false, now);
  };

  const shown = visible || helpOpen || playersOpen;
  return (
    <>
      {/* The status line sits just above the bar's real height, however many rows it wraps to.
          The bar lies in the desk's margin under the book, over the code strip while it shows
          (DECISIONS 86). */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col items-center gap-[1.5vmin] pb-[max(0.8vmin,4px)]">
        {/* Always mounted, so screen readers announce each new line. */}
        <p
          role="status"
          className={
            status
              ? 'mx-[3vmin] sketch-border bg-sticky px-[3vmin] py-[1vmin] text-center text-[max(3vmin,16px)] text-ink shadow-[0.42vmin_0.56vmin_0_var(--color-ink)]'
              : 'sr-only'
          }
        >
          {status}
        </p>
        <div
          ref={barRef}
          inert={!shown || playersOpen}
          className={`w-full transition duration-300 motion-reduce:transition-none ${shown ? 'pointer-events-auto translate-y-0 opacity-100' : 'translate-y-full opacity-0'}`}
        >
          <ControlBar
            view={view}
            armed={armed?.control ?? null}
            sending={sending}
            sound={sound}
            fullscreen={fullscreenSupported ? fullscreen : null}
            onControl={tap}
            onFullscreen={toggleFullscreen}
            onSound={cycleSound}
            onHelp={() => setHelpOpen(true)}
            onPlayers={() => setPlayersOpen(true)}
            t={t}
          />
        </div>
      </div>
      {helpOpen && <ShortcutsHelp onClose={() => setHelpOpen(false)} t={t} />}
      {playersOpen && !helpOpen && (
        <PlayersDialog
          players={view.players}
          title={t('playersTitle')}
          socket={socket}
          t={t}
          onClose={closePlayers}
        />
      )}
    </>
  );
}

/**
 * A control on the bar or the `?` card: a small sketch button (hand-drawn border, hard shadow) in
 * vmin with a 44 px floor. `primary` is the highlighter, `ghost` paper, `armed` red pen.
 */
export const barButton = (variant: SketchVariant) =>
  `min-h-11 min-w-11 ${sketchButtonClass(variant)} min-h-11! gap-[0.5ch] px-[2.2vmin]! py-[0.6vmin]! text-[max(2.6vmin,16px)]! shadow-[0.28vmin_0.42vmin_0_var(--color-ink)]! not-disabled:active:shadow-none! aria-disabled:opacity-75`;

/** The bar itself: the phase's controls on the left, fullscreen, sound and `?` on the right. */
export function ControlBar({
  view,
  armed,
  sending,
  sound,
  fullscreen,
  onControl,
  onFullscreen,
  onSound,
  onHelp,
  onPlayers,
  t,
}: {
  view: ScreenView;
  armed: ControlId | null;
  sending: ControlId | null;
  sound: SoundLevel;
  /** Null where the Fullscreen API is missing (iPhone Safari). */
  fullscreen: boolean | null;
  onControl: (control: ControlId) => void;
  onFullscreen: () => void;
  onSound: () => void;
  onHelp: () => void;
  /** The players list (Give host crown, Kick); the lobby has its chips instead. */
  onPlayers?: () => void;
  t: Translate;
}) {
  const label = (control: ControlId) => {
    const confirm = CONFIRM_LABELS[control];
    if (armed === control && confirm) return t(confirm);
    if (control === 'guessFeed')
      return t('ctlGuessFeed', { feed: t(FEED_LABELS[view.settings.guessFeed]) });
    return t(LABELS[control]);
  };
  const primary = (control: ControlId) =>
    control === 'next' ||
    control === 'resume' ||
    control === 'rematch' ||
    control === 'cancelRematch';
  const soundLabel = SOUND_LABELS[sound];

  return (
    <div
      role="group"
      aria-label={t('hostControls')}
      data-host-bar
      className="relative mx-[2vmin] flex flex-wrap items-center justify-between gap-[1.5vmin] px-[3vmin] py-[1vmin]"
    >
      {/* A strip of masking tape stuck along the bottom edge; only the tape tilts. The desk under
          it is opaque, so the code strip it lies over doesn't show through while it is up. The backing tilts with the tape: it is part of the strip. */}
      <span aria-hidden className="pointer-events-none absolute inset-0 -rotate-[0.6deg] bg-desk" />
      <Tape place="wide" />
      <div className="relative z-[4] flex flex-wrap gap-[1.5vmin]">
        {barControls(view).map((control) => (
          <button
            key={control}
            type="button"
            onClick={() => onControl(control)}
            aria-disabled={sending === control}
            className={barButton(
              armed === control ? 'armed' : primary(control) ? 'primary' : 'ghost',
            )}
          >
            {label(control)}
          </button>
        ))}
        {onPlayers && view.phase !== 'LOBBY' && (
          <button
            type="button"
            onClick={onPlayers}
            aria-haspopup="dialog"
            className={barButton('ghost')}
          >
            {t('ctlPlayers')}
          </button>
        )}
      </div>
      <div className="relative z-[4] flex flex-wrap gap-[1.5vmin]">
        {fullscreen !== null && (
          <button type="button" onClick={onFullscreen} className={barButton('ghost')}>
            {t(fullscreen ? 'ctlExitFullscreen' : 'ctlFullscreen')}
          </button>
        )}
        <button type="button" onClick={onSound} className={barButton('ghost')}>
          <span aria-hidden="true">{soundLabel.icon}</span> {t(soundLabel.label)}
        </button>
        <button
          type="button"
          onClick={onHelp}
          aria-haspopup="dialog"
          className={barButton('ghost')}
        >
          <span aria-hidden="true">?</span> {t('ctlShortcuts')}
        </button>
      </div>
    </div>
  );
}

/**
 * The `?` overlay: every shortcut, in the spec's order, on a ruled index card taped to a paper veil
 * (F63): a red header line under the title, then one shortcut to a blue rule. Esc, `?`, Close or
 * the veil close it.
 */
export function ShortcutsHelp({ onClose, t }: { onClose: () => void; t: Translate }) {
  const closeButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const before = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButton.current?.focus();
    return () => before?.focus();
  }, []);

  return (
    <div
      className="absolute inset-0 z-40 flex cursor-pointer items-center justify-center bg-paper/80 p-[4vmin]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        // The only control is Close: Tab stays on it rather than leaving the dialog.
        onKeyDown={(e) => {
          if (e.key !== 'Tab') return;
          e.preventDefault();
          closeButton.current?.focus();
        }}
        aria-labelledby="shortcuts-title"
        data-index-card
        className="relative flex max-h-full max-w-[min(96vw,1200px)] cursor-auto flex-col rounded-[0.6vmin] border-[length:max(2px,0.28vmin)] border-ink bg-paper text-[max(2.8vmin,16px)] text-ink shadow-[0.8vmin_1vmin_0_var(--color-ink)]"
      >
        <Tape place="top" />
        <h2
          id="shortcuts-title"
          className="shrink-0 border-b-[length:max(2px,0.3vmin)] border-margin px-[4vmin] pt-[3vmin] pb-[1vmin] text-[max(4.4vmin,22px)] leading-tight"
        >
          {t('shortcutsTitle')}
        </h2>
        <div className="min-h-0 overflow-y-auto overscroll-contain px-[4vmin]">
          <table className="w-full">
            <tbody>
              {SHORTCUTS.map((s) => (
                <tr key={s.keys} className="border-b border-rule">
                  <th
                    scope="row"
                    className="py-[0.8vmin] pr-[3vmin] text-left align-top font-normal whitespace-nowrap"
                  >
                    {s.keys.split(', ').map((k, i) => (
                      <span key={i}>
                        {i > 0 && ', '}
                        <kbd className="inline-block min-w-[1.6em] rounded-[0.6vmin_0.3vmin_0.7vmin_0.3vmin] border-2 border-ink bg-paper px-[1vmin] text-center font-hand leading-snug shadow-[0.2vmin_0.3vmin_0_var(--color-ink)]">
                          {k}
                        </kbd>
                      </span>
                    ))}
                  </th>
                  <td className="py-[0.8vmin] align-top">{t(s.label)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex shrink-0 justify-end px-[4vmin] pt-[2vmin] pb-[3vmin]">
          <button
            ref={closeButton}
            type="button"
            onClick={onClose}
            className={barButton('primary')}
          >
            {t('close')}
          </button>
        </div>
      </div>
    </div>
  );
}
