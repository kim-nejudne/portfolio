import { describe, expect, it } from 'vitest';
import type { ChoiceView, Phase, TypedView } from '../../../shared/types.js';
import { primaryFor, shortcutFor, SHORTCUTS, type ControlsView } from './hostControls.js';

function view(phase: Phase, overrides: Partial<ControlsView> = {}): ControlsView {
  return {
    phase,
    questionIndex: phase === 'LOBBY' ? -1 : 2,
    questionCount: 10,
    showScoreboard: false,
    canJudge: false,
    canUndo: false,
    choice: null,
    typed: null,
    ...overrides,
  };
}

const CHOICE: ChoiceView = {
  choices: ['Paris', 'Rome'],
  answered: 1,
  expected: 3,
  timer: { seconds: 10 },
};

describe('primaryFor: choice questions (F86)', () => {
  it('reads "Open answers" on a choice question before the answering starts', () => {
    expect(primaryFor(view('QUESTION', { choice: CHOICE }))).toEqual({
      label: 'Open answers',
      event: 'host:open',
    });
    expect(primaryFor(view('QUESTION'))).toEqual({ label: 'Open buzzers', event: 'host:open' });
  });

  it('reads "Close answers" during ANSWERING and sends host:reveal', () => {
    expect(primaryFor(view('ANSWERING', { choice: CHOICE }))).toEqual({
      label: 'Close answers',
      event: 'host:reveal',
    });
  });

  it('moves on from a revealed choice question as from any other', () => {
    expect(primaryFor(view('REVEAL', { choice: CHOICE }))).toEqual({
      label: 'Next question',
      event: 'host:next',
    });
  });
});

describe('primaryFor: typed questions (F87)', () => {
  const TYPED: TypedView = { answered: 0, expected: 2, timer: null, closed: false };

  it('reads "Open answers" before the answering starts, and "Close answers" during it', () => {
    expect(primaryFor(view('QUESTION', { typed: TYPED }))).toEqual({
      label: 'Open answers',
      event: 'host:open',
    });
    expect(primaryFor(view('ANSWERING', { typed: { ...TYPED, closed: true } }))).toEqual({
      label: 'Close answers',
      event: 'host:reveal',
    });
  });
});

describe('shortcutFor: Space is the primary action', () => {
  it.each([
    ['LOBBY', 'host:start'],
    ['QUESTION', 'host:open'],
    ['OPEN', 'host:reveal'],
    ['COLLECTING', 'host:reveal'],
    ['ANSWERING', 'host:reveal'],
    ['REVEAL', 'host:next'],
  ] as const)('in %s it sends %s', (phase, event) => {
    expect(shortcutFor(' ', view(phase))).toEqual({ event, payload: {} });
  });

  it('does nothing in BUZZED, where C and X judge, or in FINAL', () => {
    expect(shortcutFor(' ', view('BUZZED', { canJudge: true }))).toBeNull();
    expect(shortcutFor(' ', view('FINAL'))).toBeNull();
  });
});

describe('shortcutFor: judging', () => {
  it('C is correct, V is half and X is wrong while the view allows judging', () => {
    const buzzed = view('BUZZED', { canJudge: true });
    expect(shortcutFor('c', buzzed)).toEqual({
      event: 'host:judge',
      payload: { result: 'correct' },
    });
    expect(shortcutFor('v', buzzed)).toEqual({ event: 'host:judge', payload: { result: 'half' } });
    expect(shortcutFor('x', buzzed)).toEqual({ event: 'host:judge', payload: { result: 'wrong' } });
  });

  it('works with Caps Lock or Shift held', () => {
    expect(shortcutFor('C', view('BUZZED', { canJudge: true }))).toMatchObject({
      payload: { result: 'correct' },
    });
  });

  it('C, V and X do nothing during the wait before a reopen', () => {
    expect(shortcutFor('c', view('BUZZED', { canJudge: false }))).toBeNull();
    expect(shortcutFor('v', view('BUZZED', { canJudge: false }))).toBeNull();
    expect(shortcutFor('x', view('BUZZED', { canJudge: false }))).toBeNull();
  });
});

describe('shortcutFor: moving through questions', () => {
  it.each(['QUESTION', 'OPEN', 'COLLECTING', 'BUZZED', 'ANSWERING'] as const)(
    'R reveals or skips in %s',
    (phase) => {
      expect(shortcutFor('r', view(phase))).toEqual({ event: 'host:reveal', payload: {} });
    },
  );

  it.each(['LOBBY', 'REVEAL', 'FINAL'] as const)('R does nothing in %s', (phase) => {
    expect(shortcutFor('r', view(phase))).toBeNull();
  });

  it('N and → go to the next question from REVEAL only', () => {
    for (const key of ['n', 'ArrowRight']) {
      expect(shortcutFor(key, view('REVEAL'))).toEqual({ event: 'host:next', payload: {} });
      expect(shortcutFor(key, view('OPEN'))).toBeNull();
    }
  });

  it('← goes back during a game, but not from the first question or the lobby', () => {
    expect(shortcutFor('ArrowLeft', view('OPEN'))).toEqual({ event: 'host:prev', payload: {} });
    expect(shortcutFor('ArrowLeft', view('REVEAL', { questionIndex: 0 }))).toBeNull();
    expect(shortcutFor('ArrowLeft', view('LOBBY'))).toBeNull();
    expect(shortcutFor('ArrowLeft', view('FINAL'))).toBeNull();
  });
});

describe('shortcutFor: scoreboard, undo and local keys', () => {
  it('S toggles the scoreboard from what the view shows', () => {
    expect(shortcutFor('s', view('REVEAL'))).toEqual({
      event: 'host:scoreboard',
      payload: { show: true },
    });
    expect(shortcutFor('s', view('FINAL', { showScoreboard: true }))).toEqual({
      event: 'host:scoreboard',
      payload: { show: false },
    });
  });

  it('U undoes only when the view says undo is available', () => {
    expect(shortcutFor('u', view('REVEAL', { canUndo: true }))).toEqual({
      event: 'host:undo',
      payload: {},
    });
    expect(shortcutFor('u', view('REVEAL'))).toBeNull();
  });

  it('F, H, M and ? act on this device only', () => {
    expect(shortcutFor('f', view('OPEN'))).toBe('fullscreen');
    expect(shortcutFor('h', view('OPEN'))).toBe('bar');
    expect(shortcutFor('m', view('OPEN'))).toBe('sound');
    expect(shortcutFor('M', view('LOBBY'))).toBe('sound');
    expect(shortcutFor('m', view('FINAL'))).toBe('sound');
    expect(shortcutFor('?', view('OPEN'))).toBe('help');
  });

  it('ignores other keys', () => {
    for (const key of ['a', 'Enter', 'Escape', 'ArrowUp', '1']) {
      expect(shortcutFor(key, view('OPEN'))).toBeNull();
    }
  });

  it('the help table lists every key from the spec', () => {
    const keys = SHORTCUTS.flatMap((s) => s.keys);
    for (const key of ['Space', 'C', 'V', 'X', 'R', 'N', '→', '←', 'S', 'U', 'F', 'H', 'M', '?']) {
      expect(keys).toContain(key);
    }
  });
});
