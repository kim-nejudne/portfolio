// The host controls (Host controls): which controls the token Screen's bar and the crown phone's
// drawer show in each phase, what each keyboard shortcut does, and the "press twice within 2 s"
// confirmations. Presentation only: every action is a `host:*` event the server validates; the
// bar, drawer and keys mirror the spec's tables and render whatever the next snapshot carries.

import { GUESS_FEED_CHOICES } from '../../../shared/constants.js';
import type { ClientPayloads, RoomSettings, ScreenView } from '../../../shared/types.js';
import type { CopyKey } from './copy.js';

export type ControlId =
  | 'start'
  | 'pause'
  | 'resume'
  | 'skip'
  | 'next'
  | 'guessFeed'
  | 'end'
  | 'rematch'
  | 'backToLobby'
  | 'cancelRematch';

/** What the controls read from a snapshot: a Screen's or the crown holder's phone's. */
export type HostView = Pick<ScreenView, 'phase' | 'paused' | 'rematchInMs' | 'settings'>;

/** The local (non-server) shortcuts. */
export type LocalCommand = 'fullscreen' | 'sound' | 'help';

export type HostCommand =
  | { kind: 'send'; control: ControlId }
  | { kind: 'arm'; control: ControlId }
  | { kind: LocalCommand };

/** A first press of a two-press control, waiting for the second. */
export interface Armed {
  control: ControlId;
  at: number;
}

/** The window for the second press (or tap) of a two-press control. */
export const CONFIRM_MS = 2000;

/** A first tap of a two-tap action on one target (Kick on a player), waiting for the second. */
export interface ArmedTarget {
  target: string;
  at: number;
}

/** A tap of a two-tap action on `target`: the second within `CONFIRM_MS` confirms it. */
export function twoTap(
  target: string,
  armed: ArmedTarget | null,
  now: number,
): { confirmed: boolean; armed: ArmedTarget | null } {
  if (armed?.target === target && now - armed.at <= CONFIRM_MS)
    return { confirmed: true, armed: null };
  return { confirmed: false, armed: { target, at: now } };
}

const NEEDS_CONFIRM: readonly ControlId[] = ['skip', 'end', 'rematch', 'backToLobby'];

export type HostEvent =
  | 'host:start'
  | 'host:pause'
  | 'host:resume'
  | 'host:skip'
  | 'host:next'
  | 'host:settings'
  | 'host:end'
  | 'host:rematch'
  | 'host:rematchCancel'
  | 'host:backToLobby'
  | 'host:crown'
  | 'host:kick';

const EVENTS: Record<Exclude<ControlId, 'guessFeed'>, HostEvent> = {
  start: 'host:start',
  pause: 'host:pause',
  resume: 'host:resume',
  skip: 'host:skip',
  next: 'host:next',
  end: 'host:end',
  rematch: 'host:rematch',
  backToLobby: 'host:backToLobby',
  cancelRematch: 'host:rematchCancel',
};

export function nextGuessFeed(feed: RoomSettings['guessFeed']): RoomSettings['guessFeed'] {
  const i = GUESS_FEED_CHOICES.indexOf(feed);
  return GUESS_FEED_CHOICES[(i + 1) % GUESS_FEED_CHOICES.length]!;
}

/** The event (and payload) a control sends. `G` sends the feed after the snapshot's. */
export function controlEvent(
  control: ControlId,
  view: HostView,
): { event: HostEvent; payload: ClientPayloads[HostEvent] } {
  if (control === 'guessFeed')
    return {
      event: 'host:settings',
      payload: { guessFeed: nextGuessFeed(view.settings.guessFeed) },
    };
  return { event: EVENTS[control], payload: {} };
}

const counting = (view: HostView) => view.phase === 'FINAL' && view.rematchInMs !== null;

/**
 * Resume clears the host's own pause reason only. During the 3-2-1, or a pause for another reason
 * (F40, F41), the control is Pause, which holds the game for the host.
 */
const hostPaused = (view: HostView) => view.paused?.reasons.includes('host') ?? false;

/**
 * The bar's controls, as in the spec's drawer table. The lobby has none (Start is the lobby's own
 * button). Paused by the host: Resume in place of Pause. Paused at all: no Next (the server
 * refuses it).
 */
export function barControls(view: HostView): ControlId[] {
  const pause: ControlId = hostPaused(view) ? 'resume' : 'pause';
  switch (view.phase) {
    case 'LOBBY':
      return [];
    case 'CHOOSING':
    case 'DRAWING':
      return [pause, 'skip', 'guessFeed', 'end'];
    case 'REVEAL':
    case 'SCOREBOARD':
      return view.paused ? [pause, 'end'] : ['next', 'pause', 'end'];
    case 'FINAL':
      return counting(view) ? ['cancelRematch'] : ['rematch', 'backToLobby', 'end'];
  }
}

/**
 * The crown phone's drawer (the spec's drawer table): the bar's controls, with the guess feed as
 * its own All / Clean / Off row rather than a cycling button, and the players list (Give crown,
 * Kick) in CHOOSING, DRAWING and FINAL. In LOBBY the lobby itself is the host view.
 */
export function drawerSections(view: HostView): {
  controls: ControlId[];
  feed: boolean;
  players: boolean;
} {
  const controls = barControls(view).filter((c) => c !== 'guessFeed');
  const inTurn = view.phase === 'CHOOSING' || view.phase === 'DRAWING';
  return {
    controls,
    feed: inTurn,
    players: inTurn || (view.phase === 'FINAL' && !counting(view)),
  };
}

/** Space: Start / Next / Resume; on FINAL, Rematch; during a rematch countdown, Cancel. */
function primaryControl(view: HostView): ControlId | null {
  if (view.phase === 'FINAL') return counting(view) ? 'cancelRematch' : 'rematch';
  if (hostPaused(view)) return 'resume';
  if (view.paused) return null;
  if (view.phase === 'LOBBY') return 'start';
  if (view.phase === 'REVEAL' || view.phase === 'SCOREBOARD') return 'next';
  return null;
}

/** What a key (a `KeyboardEvent.key`) does in this snapshot, or null. Letters ignore case. */
export function keyControl(key: string, view: HostView): ControlId | LocalCommand | null {
  const shown = barControls(view);
  const ifShown = (control: ControlId) => (shown.includes(control) ? control : null);
  switch (key.length === 1 ? key.toLowerCase() : key) {
    case ' ':
      return primaryControl(view);
    case 'Escape':
      return ifShown('cancelRematch');
    case 'l':
      return ifShown('backToLobby');
    case 'p':
      return ifShown('pause') ?? ifShown('resume');
    case 's':
      return ifShown('skip');
    case 'e':
      return ifShown('end');
    case 'n':
      return ifShown('next');
    case 'g':
      // The server takes `guessFeed` in every phase (DECISIONS 45).
      return 'guessFeed';
    case 'f':
      return 'fullscreen';
    case 'm':
      return 'sound';
    case '?':
      return 'help';
    default:
      return null;
  }
}

/** A press (key) or tap (bar) of a control: two-press controls arm first, then send. */
export function press(
  control: ControlId,
  armed: Armed | null,
  now: number,
): { command: HostCommand; armed: Armed | null } {
  if (!NEEDS_CONFIRM.includes(control)) return { command: { kind: 'send', control }, armed: null };
  if (armed?.control === control && now - armed.at <= CONFIRM_MS)
    return { command: { kind: 'send', control }, armed: null };
  return { command: { kind: 'arm', control }, armed: { control, at: now } };
}

/** A key press. An unmapped key changes nothing; any other key disarms a first press. */
export function pressKey(
  key: string,
  view: HostView,
  armed: Armed | null,
  now: number,
): { command: HostCommand | null; armed: Armed | null } {
  const c = keyControl(key, view);
  if (c === null) return { command: null, armed };
  if (c === 'fullscreen' || c === 'sound' || c === 'help') return { command: { kind: c }, armed };
  return press(c, armed, now);
}

/**
 * Keys while a dialog is open: the `?` overlay takes only Esc and `?` (which close it); any other
 * modal (the lobby's settings panel) blocks every shortcut, so nothing acts behind it.
 */
export function dialogKey(
  key: string,
  dialog: 'help' | 'other' | null,
): 'closeHelp' | 'block' | 'pass' {
  if (dialog === 'help') return key === 'Escape' || key === '?' ? 'closeHelp' : 'block';
  return dialog === 'other' ? 'block' : 'pass';
}

/** Each control's button label. */
export const LABELS: Record<ControlId, CopyKey> = {
  start: 'startGame',
  pause: 'ctlPause',
  resume: 'ctlResume',
  skip: 'ctlSkip',
  next: 'next',
  guessFeed: 'ctlGuessFeed',
  end: 'ctlEnd',
  rematch: 'ctlRematch',
  backToLobby: 'ctlBackToLobby',
  cancelRematch: 'ctlCancel',
};

/** A two-tap control's label while its first tap waits for the second. */
export const CONFIRM_LABELS: Partial<Record<ControlId, CopyKey>> = {
  skip: 'ctlSkipConfirm',
  end: 'ctlEndConfirm',
  rematch: 'ctlRematchConfirm',
  backToLobby: 'ctlBackToLobbyConfirm',
};

export const FEED_LABELS: Record<RoomSettings['guessFeed'], CopyKey> = {
  all: 'optAll',
  clean: 'optClean',
  off: 'optOff',
};

/** The `?` overlay, in the spec's order. */
export const SHORTCUTS: readonly { keys: string; label: CopyKey }[] = [
  { keys: 'Space', label: 'keySpace' },
  { keys: 'Esc', label: 'keyEsc' },
  { keys: 'L, L', label: 'keyLobby' },
  { keys: 'P', label: 'keyPause' },
  { keys: 'S, S', label: 'keySkip' },
  { keys: 'E, E', label: 'keyEnd' },
  { keys: 'N', label: 'keyNext' },
  { keys: 'G', label: 'keyGuessFeed' },
  { keys: 'F', label: 'keyFullscreen' },
  { keys: 'M', label: 'keySound' },
  { keys: '?', label: 'keyHelp' },
];
