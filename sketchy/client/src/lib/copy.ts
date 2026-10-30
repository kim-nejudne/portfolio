// Every phone and Screen game string (Look and feel). Pattern ported from Buzzr
// (buzzer/client/src/lib/copy.ts): one table per language, `{name}` placeholders filled by `t`,
// the room's `settings.copy` picks the table. The landing page stays English.
//
// v0 (F07): the Screen's English strings only. F45 adds the Taglish table (and a test that both
// tables have the same keys); until then 'taglish' falls back to English.

import type { RoomSettings } from '../../../shared/types.js';

const EN = {
  // ---------- Screen: lobby ----------
  joinAt: 'Join at',
  code: 'Code',
  waitingForMore: '+ waiting for more…',
  waitingForPlayers: 'Waiting for players to join',
  isHosting: '👑 {name} is hosting',
  waitingForHostToStart: 'Waiting for 👑 {name} to start',
  startGame: 'Start game ▶',
  needTwoPlayers: 'Need 2 players',
  betterWithThree: 'Better with 3+',
  settingsSummary: '{seconds} s · {cycles} · {words}',
  roundOne: '1 round',
  rounds: '{n} rounds',
  wordsEn: 'English words',
  wordsTaglish: 'Taglish words',
  wordsMixed: 'Mixed words',
  // ---------- Screen: turn ----------
  isChoosing: '{name} is choosing a word…',
  isDrawing: '✏️ {name} is drawing',
  roundTurn: 'Round {cycle}/{cycles} · Turn {turn}',
  gotIt: '{name} got it!',
  // ---------- Screen: reveal ----------
  itWas: 'It was…',
  gotItLabel: 'Got it',
  almost: 'Almost:',
  nobodyGotIt: 'Nobody got it!',
  drawerPoints: '+{points} for {name}’s drawing',
  // ---------- Screen: scoreboard and final ----------
  roundDone: 'Round {cycle} of {cycles} done',
  finalTitle: 'Final scores',
  // ---------- Screen: connection ----------
  connecting: 'Connecting…',
  reconnecting: 'Reconnecting…',
  gameEnded: 'This game has ended',
  backHome: 'Back to the start',
  startFailed: 'Could not start the game. Try again.',
};

export type CopyKey = keyof typeof EN;
export type CopyLanguage = RoomSettings['copy'];

const COPY_TABLES: Record<CopyLanguage, Record<CopyKey, string>> = {
  en: EN,
  // SPEC-QUESTION: the Taglish table arrives with F45; English until then.
  taglish: EN,
};

/** Looks up a string and fills its placeholders. */
export type Translate = (key: CopyKey, vars?: Record<string, string | number>) => string;

export function translator(language: CopyLanguage): Translate {
  const table = COPY_TABLES[language];
  return (key, vars = {}) =>
    table[key].replace(/\{(\w+)\}/g, (whole, name: string) =>
      name in vars ? String(vars[name]) : whole,
    );
}
