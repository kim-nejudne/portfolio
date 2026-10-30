import type { CopyLanguage, View } from '../../../shared/types.js';
import { ordinal } from './results.js';
import { useRoomStore } from './roomStore.js';

/**
 * Every player-phone and Screen game-state string, in English and Taglish (F91). `{name}` marks a
 * value filled in by `t`. The room's `settings.copy` picks the table; the landing page, the set
 * pages and the host remote stay English. Kim reviews the Taglish (PROGRESS, F91).
 */
const EN = {
  // ---------- Phone: buzzer status ----------
  tapToTest: 'Tap to test your buzzer',
  // The pair of tapToTest on a mouse (FND-08): the lobby buzzer takes a click or Space.
  clickToTest: 'Click or press Space to test your buzzer',
  getReady: 'Get ready…',
  lateJoiner: 'Get ready… you can buzz from the next question',
  tooEarly: 'Too early!',
  answerSent: 'Answer sent',
  buzzed: 'Buzzed…',
  buzzersOpenPhone: 'Buzzers open!',
  timeUp: 'Time’s up!',
  youreFirst: 'You’re first! Answer now',
  buzzedFirst: '{name} buzzed first',
  someoneBuzzedFirst: 'Someone buzzed first',
  typeYourAnswer: 'Type your answer',
  answersClosed: 'Answers closed',
  pickYourAnswer: 'Pick your answer',
  yourAnswer: 'Your answer',
  correct: 'Correct!',
  answerRevealed: 'Answer revealed',
  answer: 'Answer',
  lockedOutRound: 'Locked out this round',
  rankOf: '{rank} of {count}',
  // ---------- Phone: around the buzzer ----------
  questionOf: 'Question {n} of {count}',
  tapToBuzzIn: ' · tap to buzz in',
  clickToBuzzIn: ' · click or press Space to buzz in',
  youreIn: 'You’re in! Waiting for the host',
  teamName: '{team} team',
  room: 'Room {code}',
  of: 'of',
  changeName: 'Change name',
  leaveGame: 'Leave game',
  confirmLeave: 'Confirm leave',
  gameOver: 'Game over',
  teamRank: '{rank} of {count} teams · {points}',
  tonight: 'Tonight',
  secondToBuzz: 'second to buzz',
  secondsToBuzz: 'seconds to buzz',
  secondToAnswer: 'second to answer',
  secondsToAnswer: 'seconds to answer',
  yourPick: 'Your pick',
  send: 'Send',
  yourName: 'Your name',
  enterYourName: 'Enter your name',
  nameWontWork: 'That name won’t work',
  cancel: 'Cancel',
  save: 'Save',
  whosHere: 'Who’s here · {n}',
  you: '(you)',
  shareResults: 'Share results',
  downloadResults: 'Download results',
  savedFile: 'Saved {file}',
  imageFailed: 'Couldn’t make the image',
  pointOne: '{n} point',
  points: '{n} points',
  // ---------- Screen ----------
  titleCardReady: 'Get ready',
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
  joinAt: 'Join at',
  roomCode: 'Room code',
  waitingForPlayers: 'Waiting for players…',
  playerCountOne: '{n} player',
  playerCount: '{n} players',
  noPlayersYet: 'No players yet',
  questionSlash: 'Question {n} / {count}',
  gameNumber: 'Game {n}',
  roomLabel: 'Room',
  buzzersOpen: 'Buzzers OPEN',
  buzzersLocked: 'Buzzers locked',
  answeredOf: '{answered} of {expected} answered',
  answeredCount: '{n} answered',
  answersLocked: 'Answers locked',
  nobodyGotIt: 'Nobody got it',
  lockedOut: 'locked out',
  tooEarlyTag: 'Too early',
  firstToBuzz: 'First to buzz',
  alsoBuzzed: 'also buzzed',
  standings: 'Standings',
  players: 'Players',
  scoreboard: 'Scoreboard',
  finalResults: 'Final results',
  fullRanking: 'Full ranking',
  andMore: 'and {n} more',
  reconnecting: 'Reconnecting…',
} as const;

export type CopyKey = keyof typeof EN;

/** Drafted by Claude for Kim's review: game-show Taglish, English where Filipino players keep it. */
const TAGLISH: Record<CopyKey, string> = {
  // ---------- Phone: buzzer status ----------
  tapToTest: 'I-tap para i-test ang buzzer mo',
  clickToTest: 'I-click o pindutin ang Space para i-test ang buzzer mo',
  getReady: 'Humanda ka…',
  lateJoiner: 'Humanda ka… makaka-buzz ka na sa next question',
  tooEarly: 'Masyadong maaga!',
  answerSent: 'Sent na ang sagot mo',
  buzzed: 'Naka-buzz ka na…',
  buzzersOpenPhone: 'Bukas na ang buzzers!',
  timeUp: 'Ubos na ang oras!',
  youreFirst: 'Ikaw ang una! Sagot na',
  buzzedFirst: 'Si {name} ang unang nag-buzz',
  someoneBuzzedFirst: 'May naunang nag-buzz',
  typeYourAnswer: 'I-type ang sagot mo',
  answersClosed: 'Sarado na ang sagutan',
  pickYourAnswer: 'Pumili ng sagot',
  yourAnswer: 'Sagot mo',
  correct: 'Tama!',
  answerRevealed: 'Labas na ang sagot',
  answer: 'Sagot',
  lockedOutRound: 'Locked out ka muna sa round na ’to',
  rankOf: '{rank} sa {count}',
  // ---------- Phone: around the buzzer ----------
  questionOf: 'Tanong {n} sa {count}',
  tapToBuzzIn: ' · i-tap para mag-buzz',
  clickToBuzzIn: ' · i-click o pindutin ang Space para mag-buzz',
  youreIn: 'Pasok ka na! Hinihintay ang host',
  teamName: 'Team {team}',
  room: 'Room {code}',
  of: 'sa',
  changeName: 'Palitan ang pangalan',
  leaveGame: 'Umalis sa game',
  confirmLeave: 'Sigurado, aalis na',
  gameOver: 'Tapos na ang game',
  teamRank: '{rank} sa {count} na team · {points}',
  tonight: 'Ngayong gabi',
  secondToBuzz: 'segundo para mag-buzz',
  secondsToBuzz: 'segundo para mag-buzz',
  secondToAnswer: 'segundo para sumagot',
  secondsToAnswer: 'segundo para sumagot',
  yourPick: 'Pinili mo',
  send: 'I-send',
  yourName: 'Pangalan mo',
  enterYourName: 'Ilagay ang pangalan mo',
  nameWontWork: 'Hindi puwede ang pangalang ’yan',
  cancel: 'Huwag na',
  save: 'I-save',
  whosHere: 'Nandito na · {n}',
  you: '(ikaw)',
  shareResults: 'I-share ang results',
  downloadResults: 'I-download ang results',
  savedFile: 'Na-save ang {file}',
  imageFailed: 'Hindi nagawa ang image',
  pointOne: '{n} puntos',
  points: '{n} puntos',
  // ---------- Screen ----------
  titleCardReady: 'Humanda na',
  easy: 'Madali',
  medium: 'Katamtaman',
  hard: 'Mahirap',
  joinAt: 'Sumali sa',
  roomCode: 'Room code',
  waitingForPlayers: 'Hinihintay ang mga player…',
  playerCountOne: '{n} player',
  playerCount: '{n} na player',
  noPlayersYet: 'Wala pang player',
  questionSlash: 'Tanong {n} / {count}',
  gameNumber: 'Game {n}',
  roomLabel: 'Room',
  buzzersOpen: 'BUKAS na ang buzzers',
  buzzersLocked: 'Sarado pa ang buzzers',
  answeredOf: '{answered} sa {expected} ang nakasagot',
  answeredCount: '{n} ang nakasagot',
  answersLocked: 'Hindi pa puwedeng sumagot',
  nobodyGotIt: 'Walang nakakuha',
  lockedOut: 'out na',
  tooEarlyTag: 'Maaga',
  firstToBuzz: 'Unang nag-buzz',
  alsoBuzzed: 'nag-buzz din',
  standings: 'Standings',
  players: 'Mga player',
  scoreboard: 'Scoreboard',
  finalResults: 'Final na resulta',
  fullRanking: 'Buong ranking',
  andMore: 'at {n} pa',
  reconnecting: 'Kumokonekta ulit…',
};

export const COPY_TABLES: Record<CopyLanguage, Record<CopyKey, string>> = {
  en: EN,
  taglish: TAGLISH,
};

/** The names a string's `{…}` placeholders use, so a test can check both tables agree. */
export function placeholders(text: string): string[] {
  return [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]!).sort();
}

/** Looks up a string and fills its placeholders. */
export type Translate = (key: CopyKey, vars?: Record<string, string | number>) => string;

export function translator(language: CopyLanguage): Translate {
  const table = COPY_TABLES[language];
  return (key, vars = {}) =>
    table[key].replace(/\{(\w+)\}/g, (whole, name: string) =>
      name in vars ? String(vars[name]) : whole,
    );
}

const TRANSLATORS: Record<CopyLanguage, Translate> = {
  en: translator('en'),
  taglish: translator('taglish'),
};

/** The room's language for this view: Taglish only on a phone or the Screen; the host stays English. */
export function copyLanguage(view: View | null): CopyLanguage {
  if (view?.role === 'player') return view.copy;
  if (view?.role === 'screen') return view.settings.copy;
  return 'en';
}

/** `t` for the current snapshot: English with no view, as in the set editor's preview. */
export function useCopy(): Translate {
  return TRANSLATORS[useRoomStore((state) => copyLanguage(state.view))];
}

/** A score with its unit: "1 point", "250 points"; "250 puntos". */
export function pointsText(t: Translate, points: number): string {
  return t(Math.abs(points) === 1 ? 'pointOne' : 'points', { n: points });
}

/** "3rd of 8"; "3rd sa 8". Ordinals stay English in Taglish, as players say them. */
export function rankText(t: Translate, rank: number, count: number): string {
  return t('rankOf', { rank: ordinal(rank), count });
}
