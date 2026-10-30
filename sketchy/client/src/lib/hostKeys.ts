// The token Screen's host controls (Host controls): which controls its bar shows in each phase,
// what each keyboard shortcut does, and the "press twice within 2 s" confirmations. Presentation
// only: every action is a `host:*` event the server validates; the bar and keys mirror the spec's
// tables and render whatever the next snapshot carries.

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

const NEEDS_CONFIRM: readonly ControlId[] = ['skip', 'end', 'rematch', 'backToLobby'];

type HostEvent =
  | 'host:start'
  | 'host:pause'
  | 'host:resume'
  | 'host:skip'
  | 'host:next'
  | 'host:settings'
  | 'host:end'
  | 'host:rematch'
  | 'host:rematchCancel'
  | 'host:backToLobby';

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
  view: ScreenView,
): { event: HostEvent; payload: ClientPayloads[HostEvent] } {
  if (control === 'guessFeed')
    return {
      event: 'host:settings',
      payload: { guessFeed: nextGuessFeed(view.settings.guessFeed) },
    };
  return { event: EVENTS[control], payload: {} };
}

const counting = (view: ScreenView) => view.phase === 'FINAL' && view.rematchInMs !== null;

/**
 * The bar's controls, as in the spec's drawer table. The lobby has none (Start is the lobby's own
 * button). Paused: Resume in place of Pause, and no Next (the server refuses it).
 */
export function barControls(view: ScreenView): ControlId[] {
  const pause: ControlId = view.paused ? 'resume' : 'pause';
  switch (view.phase) {
    case 'LOBBY':
      return [];
    case 'CHOOSING':
    case 'DRAWING':
      return [pause, 'skip', 'guessFeed', 'end'];
    case 'REVEAL':
    case 'SCOREBOARD':
      return view.paused ? ['resume', 'end'] : ['next', 'pause', 'end'];
    case 'FINAL':
      return counting(view) ? ['cancelRematch'] : ['rematch', 'backToLobby', 'end'];
  }
}

/** Space: Start / Next / Resume; on FINAL, Rematch; during a rematch countdown, Cancel. */
function primaryControl(view: ScreenView): ControlId | null {
  if (view.phase === 'FINAL') return counting(view) ? 'cancelRematch' : 'rematch';
  if (view.paused) return 'resume';
  if (view.phase === 'LOBBY') return 'start';
  if (view.phase === 'REVEAL' || view.phase === 'SCOREBOARD') return 'next';
  return null;
}

/** What a key (a `KeyboardEvent.key`) does in this snapshot, or null. Letters ignore case. */
export function keyControl(key: string, view: ScreenView): ControlId | LocalCommand | null {
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
  view: ScreenView,
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
