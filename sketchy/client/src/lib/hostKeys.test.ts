import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../../../shared/constants.js';
import type { Phase, PausedView, ScreenView } from '../../../shared/types.js';
import {
  CONFIRM_MS,
  SHORTCUTS,
  barControls,
  controlEvent,
  dialogKey,
  drawerSections,
  keyControl,
  nextGuessFeed,
  press,
  pressKey,
  twoTap,
  type ControlId,
} from './hostKeys.js';

const PAUSED: PausedView = { reasons: ['host'], resumeInMs: null };

function view(
  phase: Phase,
  opts: { paused?: boolean; rematchInMs?: number; guessFeed?: 'all' | 'clean' | 'off' } = {},
): ScreenView {
  return {
    role: 'screen',
    code: 'KPRW',
    phase,
    paused: opts.paused ? PAUSED : null,
    rematchInMs: opts.rematchInMs ?? null,
    settings: { ...DEFAULT_SETTINGS, guessFeed: opts.guessFeed ?? 'all' },
    players: [],
    turn: null,
    host: { code: 'KPRW', customWordCount: 0 },
    feed: [],
    closeGuesses: [],
    awards: [],
    gallery: [],
  };
}

/** Presses `keys` in order at the given times and returns the controls sent. */
function sendsOf(v: ScreenView, presses: [string, number][]): ControlId[] {
  let armed = null;
  const sent: ControlId[] = [];
  for (const [key, at] of presses) {
    const r = pressKey(key, v, armed, at);
    armed = r.armed;
    if (r.command?.kind === 'send') sent.push(r.command.control);
  }
  return sent;
}

describe('host control bar (F24)', () => {
  it('shows the spec’s controls for each phase', () => {
    expect(barControls(view('LOBBY'))).toEqual([]);
    expect(barControls(view('CHOOSING'))).toEqual(['pause', 'skip', 'guessFeed', 'end']);
    expect(barControls(view('DRAWING'))).toEqual(['pause', 'skip', 'guessFeed', 'end']);
    expect(barControls(view('REVEAL'))).toEqual(['next', 'pause', 'end']);
    expect(barControls(view('SCOREBOARD'))).toEqual(['next', 'pause', 'end']);
    expect(barControls(view('FINAL'))).toEqual(['rematch', 'backToLobby', 'end']);
  });

  it('swaps Pause for Resume while paused, and drops Next', () => {
    expect(barControls(view('DRAWING', { paused: true }))).toEqual([
      'resume',
      'skip',
      'guessFeed',
      'end',
    ]);
    expect(barControls(view('REVEAL', { paused: true }))).toEqual(['resume', 'end']);
  });

  it('shows only Cancel during a rematch countdown', () => {
    expect(barControls(view('FINAL', { rematchInMs: 2000 }))).toEqual(['cancelRematch']);
  });

  it('maps each control to its host event', () => {
    const v = view('DRAWING');
    expect(controlEvent('start', v)).toEqual({ event: 'host:start', payload: {} });
    expect(controlEvent('pause', v)).toEqual({ event: 'host:pause', payload: {} });
    expect(controlEvent('resume', v)).toEqual({ event: 'host:resume', payload: {} });
    expect(controlEvent('skip', v)).toEqual({ event: 'host:skip', payload: {} });
    expect(controlEvent('next', v)).toEqual({ event: 'host:next', payload: {} });
    expect(controlEvent('end', v)).toEqual({ event: 'host:end', payload: {} });
    expect(controlEvent('rematch', v)).toEqual({ event: 'host:rematch', payload: {} });
    expect(controlEvent('cancelRematch', v)).toEqual({
      event: 'host:rematchCancel',
      payload: {},
    });
    expect(controlEvent('backToLobby', v)).toEqual({ event: 'host:backToLobby', payload: {} });
  });
});

describe('guess feed cycle (F24)', () => {
  it('G cycles All → Clean → Off → All', () => {
    expect(nextGuessFeed('all')).toBe('clean');
    expect(nextGuessFeed('clean')).toBe('off');
    expect(nextGuessFeed('off')).toBe('all');
  });

  it('sends the next guess feed from the current snapshot’s setting', () => {
    expect(controlEvent('guessFeed', view('DRAWING', { guessFeed: 'all' }))).toEqual({
      event: 'host:settings',
      payload: { guessFeed: 'clean' },
    });
    expect(controlEvent('guessFeed', view('REVEAL', { guessFeed: 'off' }))).toEqual({
      event: 'host:settings',
      payload: { guessFeed: 'all' },
    });
  });

  it('G works in every phase, one press', () => {
    for (const phase of ['LOBBY', 'CHOOSING', 'DRAWING', 'REVEAL', 'SCOREBOARD', 'FINAL'] as const)
      expect(sendsOf(view(phase), [['g', 0]])).toEqual(['guessFeed']);
  });
});

describe('keyboard shortcuts (F24)', () => {
  it('Space is the primary action: Start, Next, Resume', () => {
    expect(sendsOf(view('LOBBY'), [[' ', 0]])).toEqual(['start']);
    expect(sendsOf(view('REVEAL'), [[' ', 0]])).toEqual(['next']);
    expect(sendsOf(view('SCOREBOARD'), [[' ', 0]])).toEqual(['next']);
    expect(sendsOf(view('DRAWING', { paused: true }), [[' ', 0]])).toEqual(['resume']);
    expect(sendsOf(view('REVEAL', { paused: true }), [[' ', 0]])).toEqual(['resume']);
  });

  it('Space does nothing while a turn runs unpaused', () => {
    expect(keyControl(' ', view('CHOOSING'))).toBeNull();
    expect(keyControl(' ', view('DRAWING'))).toBeNull();
  });

  it('Space on FINAL rematches only when pressed twice within 2 s', () => {
    const first = pressKey(' ', view('FINAL'), null, 0);
    expect(first.command).toEqual({ kind: 'arm', control: 'rematch' });
    expect(
      sendsOf(view('FINAL'), [
        [' ', 0],
        [' ', CONFIRM_MS],
      ]),
    ).toEqual(['rematch']);
    expect(
      sendsOf(view('FINAL'), [
        [' ', 0],
        [' ', CONFIRM_MS + 1],
      ]),
    ).toEqual([]);
  });

  it('Space and Esc cancel a rematch countdown, one press', () => {
    const v = view('FINAL', { rematchInMs: 2500 });
    expect(sendsOf(v, [[' ', 0]])).toEqual(['cancelRematch']);
    expect(sendsOf(v, [['Escape', 0]])).toEqual(['cancelRematch']);
    expect(keyControl('Escape', view('FINAL'))).toBeNull();
    expect(keyControl('Escape', view('DRAWING'))).toBeNull();
  });

  it('S, S skips the turn; one S or a slow second S does not', () => {
    expect(sendsOf(view('DRAWING'), [['s', 0]])).toEqual([]);
    expect(
      sendsOf(view('DRAWING'), [
        ['s', 0],
        ['s', 1500],
      ]),
    ).toEqual(['skip']);
    expect(
      sendsOf(view('CHOOSING'), [
        ['S', 0],
        ['S', 10],
      ]),
    ).toEqual(['skip']);
    expect(
      sendsOf(view('DRAWING'), [
        ['s', 0],
        ['s', 2100],
      ]),
    ).toEqual([]);
    expect(keyControl('s', view('REVEAL'))).toBeNull();
  });

  it('a different key in between disarms the first press', () => {
    expect(
      sendsOf(view('DRAWING'), [
        ['s', 0],
        ['e', 100],
        ['s', 200],
      ]),
    ).toEqual([]);
  });

  it('a slow second press arms again, so a third press in time confirms', () => {
    expect(
      sendsOf(view('DRAWING'), [
        ['s', 0],
        ['s', 3000],
        ['s', 3500],
      ]),
    ).toEqual(['skip']);
  });

  it('E, E ends the game in every game phase, not in the lobby', () => {
    for (const phase of ['CHOOSING', 'DRAWING', 'REVEAL', 'SCOREBOARD', 'FINAL'] as const)
      expect(
        sendsOf(view(phase), [
          ['e', 0],
          ['e', 500],
        ]),
      ).toEqual(['end']);
    expect(keyControl('e', view('LOBBY'))).toBeNull();
  });

  it('L, L goes back to the lobby on FINAL only', () => {
    expect(
      sendsOf(view('FINAL'), [
        ['l', 0],
        ['l', 500],
      ]),
    ).toEqual(['backToLobby']);
    expect(sendsOf(view('FINAL'), [['l', 0]])).toEqual([]);
    expect(keyControl('l', view('SCOREBOARD'))).toBeNull();
    expect(keyControl('l', view('FINAL', { rematchInMs: 1000 }))).toBeNull();
  });

  it('P pauses and resumes during a game, not in the lobby or on FINAL', () => {
    expect(sendsOf(view('DRAWING'), [['p', 0]])).toEqual(['pause']);
    expect(sendsOf(view('SCOREBOARD'), [['p', 0]])).toEqual(['pause']);
    expect(sendsOf(view('DRAWING', { paused: true }), [['p', 0]])).toEqual(['resume']);
    expect(keyControl('p', view('LOBBY'))).toBeNull();
    expect(keyControl('p', view('FINAL'))).toBeNull();
  });

  it('N goes next in REVEAL and SCOREBOARD only, never while paused', () => {
    expect(sendsOf(view('REVEAL'), [['n', 0]])).toEqual(['next']);
    expect(sendsOf(view('SCOREBOARD'), [['N', 0]])).toEqual(['next']);
    expect(keyControl('n', view('DRAWING'))).toBeNull();
    expect(keyControl('n', view('REVEAL', { paused: true }))).toBeNull();
  });

  it('F, M and ? are local: fullscreen, sound and the help overlay', () => {
    for (const phase of ['LOBBY', 'DRAWING', 'FINAL'] as const) {
      expect(pressKey('f', view(phase), null, 0).command).toEqual({ kind: 'fullscreen' });
      expect(pressKey('m', view(phase), null, 0).command).toEqual({ kind: 'sound' });
      expect(pressKey('?', view(phase), null, 0).command).toEqual({ kind: 'help' });
    }
  });

  it('an unmapped key changes nothing, and keeps a first press armed', () => {
    const armed = pressKey('s', view('DRAWING'), null, 0).armed;
    const r = pressKey('Shift', view('DRAWING'), armed, 100);
    expect(r.command).toBeNull();
    expect(r.armed).toEqual(armed);
  });

  it('the help overlay lists every shortcut in the spec’s table', () => {
    expect(SHORTCUTS.map((s) => s.keys)).toEqual([
      'Space',
      'Esc',
      'L, L',
      'P',
      'S, S',
      'E, E',
      'N',
      'G',
      'F',
      'M',
      '?',
    ]);
  });
});

describe('two-tap buttons (F24)', () => {
  it('Skip, End, Rematch and Back to lobby take two taps within 2 s', () => {
    for (const control of ['skip', 'end', 'rematch', 'backToLobby'] as const) {
      const first = press(control, null, 0);
      expect(first.command).toEqual({ kind: 'arm', control });
      expect(press(control, first.armed, 1999).command).toEqual({ kind: 'send', control });
      expect(press(control, first.armed, 2001).command).toEqual({ kind: 'arm', control });
    }
  });

  it('the other controls send on one tap', () => {
    for (const control of ['pause', 'resume', 'next', 'guessFeed', 'cancelRematch'] as const)
      expect(press(control, null, 0)).toEqual({ command: { kind: 'send', control }, armed: null });
  });
});

describe('shortcuts under a dialog (F24)', () => {
  it('the ? overlay takes only Esc and ?, which close it', () => {
    expect(dialogKey('Escape', 'help')).toBe('closeHelp');
    expect(dialogKey('?', 'help')).toBe('closeHelp');
    for (const key of [' ', 'e', 's', 'n', 'p', 'g', 'l', 'f', 'm'])
      expect(dialogKey(key, 'help')).toBe('block');
  });

  it('the settings panel blocks every shortcut, Space’s Start included', () => {
    for (const key of [' ', 'Escape', '?', 'g', 'e']) expect(dialogKey(key, 'other')).toBe('block');
  });

  it('with no dialog open, keys pass to the shortcuts', () => {
    expect(dialogKey(' ', null)).toBe('pass');
    expect(dialogKey('?', null)).toBe('pass');
  });
});

describe('the crown phone’s drawer (F25)', () => {
  it('in CHOOSING and DRAWING: Pause, Skip, End, the guess feed row and the players list', () => {
    for (const phase of ['CHOOSING', 'DRAWING'] as const) {
      expect(drawerSections(view(phase))).toEqual({
        controls: ['pause', 'skip', 'end'],
        feed: true,
        players: true,
      });
      expect(drawerSections(view(phase, { paused: true })).controls[0]).toBe('resume');
    }
  });

  it('in REVEAL and SCOREBOARD: Next, Pause and End, no feed or players', () => {
    for (const phase of ['REVEAL', 'SCOREBOARD'] as const)
      expect(drawerSections(view(phase))).toEqual({
        controls: ['next', 'pause', 'end'],
        feed: false,
        players: false,
      });
  });

  it('in FINAL: Rematch, Back to lobby, End and the players list; a countdown only Cancel', () => {
    expect(drawerSections(view('FINAL'))).toEqual({
      controls: ['rematch', 'backToLobby', 'end'],
      feed: false,
      players: true,
    });
    expect(drawerSections(view('FINAL', { rematchInMs: 2000 }))).toEqual({
      controls: ['cancelRematch'],
      feed: false,
      players: false,
    });
  });

  it('in LOBBY: nothing (the lobby is the host view)', () => {
    expect(drawerSections(view('LOBBY'))).toEqual({ controls: [], feed: false, players: false });
  });
});

describe('two-tap actions on a target (Kick, F25)', () => {
  it('confirms on a second tap of the same target within 2 s', () => {
    const first = twoTap('jun', null, 1000);
    expect(first).toEqual({ confirmed: false, armed: { target: 'jun', at: 1000 } });
    expect(twoTap('jun', first.armed, 1000 + CONFIRM_MS)).toEqual({ confirmed: true, armed: null });
  });

  it('re-arms after 2 s, and on another target', () => {
    const first = twoTap('jun', null, 1000);
    expect(twoTap('jun', first.armed, 1001 + CONFIRM_MS).confirmed).toBe(false);
    expect(twoTap('ana', first.armed, 1500)).toEqual({
      confirmed: false,
      armed: { target: 'ana', at: 1500 },
    });
  });
});
