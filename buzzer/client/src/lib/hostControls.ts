import type { ClientPayloads, Phase, ScreenView } from '../../../shared/types.js';
import type { HostCommand, HostEvent } from './useHostCommand.js';

/** What the host controls read. The host remote's HostView and the Screen's ScreenView both have it. */
export type ControlsView = Pick<
  ScreenView,
  'phase' | 'questionIndex' | 'questionCount' | 'showScoreboard' | 'canJudge' | 'canUndo'
>;

/** The host events the primary button sends without a payload. */
export type PrimaryEvent = 'host:start' | 'host:open' | 'host:reveal' | 'host:next';

/** Phases with a question on screen and its answer still hidden, where Skip applies. */
export const UNREVEALED: readonly Phase[] = ['QUESTION', 'OPEN', 'COLLECTING', 'BUZZED'];

const BY_PHASE: Partial<Record<Phase, { label: string; event: PrimaryEvent }>> = {
  LOBBY: { label: 'Start game', event: 'host:start' },
  QUESTION: { label: 'Open buzzers', event: 'host:open' },
  OPEN: { label: 'Reveal answer', event: 'host:reveal' },
  COLLECTING: { label: 'Reveal answer', event: 'host:reveal' },
};

/** The primary action for this phase, or null in BUZZED (Correct / Wrong) and FINAL. */
export function primaryFor(view: ControlsView): { label: string; event: PrimaryEvent } | null {
  if (view.phase === 'REVEAL') {
    // `host:next` after the last question shows the final results instead of another question.
    const last = view.questionIndex >= view.questionCount - 1;
    return { label: last ? 'Show final results' : 'Next question', event: 'host:next' };
  }
  return BY_PHASE[view.phase] ?? null;
}

/** A question is on screen: neither the lobby nor the final results. */
export function inGame(view: ControlsView): boolean {
  return view.phase !== 'LOBBY' && view.phase !== 'FINAL';
}

/** One host event and its payload, ready for `HostCommand.run`. */
export type HostCommandCall = {
  [E in HostEvent]: { event: E; payload: ClientPayloads[E] };
}[HostEvent];

/** Sends one call through the shared lock. */
export function runCall(command: HostCommand, call: HostCommandCall): void {
  // `run` is generic over a single event, so a union of calls has to be widened to reach it.
  const run = command.run as (event: HostEvent, payload: HostCommandCall['payload']) => void;
  run(call.event, call.payload);
}

/** Keys that act on this device only and send nothing. */
export type LocalShortcut = 'fullscreen' | 'bar' | 'sound' | 'help';

/** The Screen's keyboard shortcuts (UI spec, Screen host controls), as listed on the `?` overlay. */
export const SHORTCUTS: readonly { keys: string[]; action: string }[] = [
  { keys: ['Space'], action: 'Primary action (Start / Open buzzers / Reveal / Next)' },
  { keys: ['C'], action: 'Correct' },
  { keys: ['V'], action: 'Half points' },
  { keys: ['X'], action: 'Wrong' },
  { keys: ['R'], action: 'Reveal answer / skip' },
  { keys: ['N', '→'], action: 'Next question' },
  { keys: ['←'], action: 'Previous question' },
  { keys: ['S'], action: 'Toggle scoreboard' },
  { keys: ['U'], action: 'Undo last judgement' },
  { keys: ['F'], action: 'Toggle fullscreen' },
  { keys: ['H'], action: 'Show/hide control bar' },
  { keys: ['M'], action: 'Sound on / Quiet / Muted' },
  { keys: ['?'], action: 'Show/hide this help' },
];

/**
 * What a key does on the Screen right now: a host event, a local action, or null when the key is
 * not a shortcut or its button would be hidden or disabled. Keys follow the same rules as the
 * buttons, so a stray press never sends an action the server would refuse for its phase.
 */
export function shortcutFor(
  key: string,
  view: ControlsView,
): HostCommandCall | LocalShortcut | null {
  switch (key.length === 1 ? key.toLowerCase() : key) {
    case ' ': {
      // SPEC-QUESTION: in BUZZED Space does nothing; C, V and X judge. See DECISIONS (F23).
      const primary = primaryFor(view);
      return primary && { event: primary.event, payload: {} };
    }
    case 'c':
      return view.canJudge ? { event: 'host:judge', payload: { result: 'correct' } } : null;
    case 'v':
      return view.canJudge ? { event: 'host:judge', payload: { result: 'half' } } : null;
    case 'x':
      return view.canJudge ? { event: 'host:judge', payload: { result: 'wrong' } } : null;
    case 'r':
      return UNREVEALED.includes(view.phase) ? { event: 'host:reveal', payload: {} } : null;
    case 'n':
    case 'ArrowRight':
      return view.phase === 'REVEAL' ? { event: 'host:next', payload: {} } : null;
    case 'ArrowLeft':
      return inGame(view) && view.questionIndex > 0 ? { event: 'host:prev', payload: {} } : null;
    case 's':
      return { event: 'host:scoreboard', payload: { show: !view.showScoreboard } };
    case 'u':
      return view.canUndo ? { event: 'host:undo', payload: {} } : null;
    case 'f':
      return 'fullscreen';
    case 'h':
      return 'bar';
    case 'm':
      return 'sound';
    case '?':
      return 'help';
    default:
      return null;
  }
}
