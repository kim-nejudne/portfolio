import { useEffect, useRef, type ReactNode } from 'react';
import type { PlayerChipView, PlayerView } from '../../../../shared/types.js';
import { AWARD_COPY } from '../../lib/awards.js';
import type { Translate } from '../../lib/copy.js';
import { useHostTaps } from '../../lib/hostTaps.js';
import { CONFIRM_LABELS, LABELS, type ControlId } from '../../lib/hostKeys.js';
import { ordinalSuffix } from '../../lib/ordinal.js';
import type { GameSocket } from '../../lib/socket.js';
import { Avatar } from '../Avatar.js';
import { CategoryChip } from '../sketch/CategoryChip.js';
import { Highlight } from '../sketch/Highlight.js';
import { sketchButtonClass } from '../sketch/SketchButton.js';
import { Stamp } from '../sketch/Stamp.js';
import { Tape } from '../sketch/Tape.js';
import { LeaveButton } from './LeaveButton.js';
import { copyAround } from './NameInColour.js';

/**
 * REVEAL, SCOREBOARD and FINAL on a phone (UI by role and phase, Guesser phone; the drawer's is the
 * same plus "+N for your drawing"), on a dot-grid page (Sketchbook Results). During REVEAL only
 * this turn's points, never a rank; the rank and score come with SCOREBOARD and FINAL, where the
 * view carries them. FINAL leads with this player's award, when they won one (F50), and gives the
 * crown holder Rematch and Back to lobby (`socket` is passed only then).
 */
export function PhoneStandings({
  view,
  onLeave,
  socket,
  t,
}: {
  view: PlayerView;
  onLeave: () => void;
  /** The crown phone's socket, for the final page's Rematch / Back to lobby. */
  socket?: GameSocket;
  t: Translate;
}) {
  const { me, turn, phase } = view;
  const wasDrawer = turn?.drawerPid === me.pid;
  // The next drawer's word is chosen (F21); it stays off this screen until the pad.
  const drawsNext = (phase === 'REVEAL' || phase === 'SCOREBOARD') && view.secret?.word != null;

  return (
    <div className="flex h-full flex-col items-center gap-[min(0.75rem,2dvh)] overflow-y-auto px-4 pt-[min(1rem,2.5dvh)] pb-2 text-center">
      {drawsNext && (
        <p className="sketch-border shrink-0 bg-sticky px-4 py-0.5 text-xl text-ink shadow-[2px_3px_0_var(--color-ink)]">
          <span aria-hidden="true">✏️</span> {t('youDrawNextReady')}
        </p>
      )}
      {phase === 'REVEAL' && turn && (
        <>
          <div className="shrink-0">
            {turn.endReason === 'allGuessed' && (
              <p className="text-2xl leading-tight text-success">
                {t('everyoneGotIt')} <span aria-hidden="true">🎉</span>
              </p>
            )}
            <p className="text-xl leading-tight text-soft">{t('itWas')}</p>
          </div>
          {turn.category && (
            <CategoryChip category={turn.category} t={t} className="shrink-0 text-base" />
          )}
          <RevealWord word={turn.word ?? ''} />
          {wasDrawer ? (
            me.turnPoints > 0 && (
              <PointsStamp
                points={me.turnPoints}
                say={(points) => t('yourDrawingPoints', { points })}
              />
            )
          ) : me.turnPoints > 0 ? (
            <PointsStamp points={me.turnPoints} say={(points) => t('turnPoints', { points })} />
          ) : (
            // SPEC-QUESTION: no red "+0" stamp for a miss; the points still show (DECISIONS 84).
            <p className="shrink-0 text-2xl text-soft">{t('turnPoints', { points: 0 })}</p>
          )}
          {wasDrawer && <GotItRows view={view} />}
          <p className="mt-auto shrink-0 text-lg text-soft">{t('watchScreen')}</p>
        </>
      )}

      {phase === 'SCOREBOARD' && (
        <>
          <p className="shrink-0 text-xl leading-tight text-soft">
            {t('roundDone', {
              cycle: turn?.cycle ?? 1,
              cycles: view.settings.cycles,
            })}
          </p>
          {me.rank && (
            <BigRank
              rank={me.rank.rank}
              score={me.score ?? 0}
              said={t('rankOf', { rank: me.rank.rank, of: me.rank.of })}
              t={t}
            />
          )}
          <Standings view={view} />
        </>
      )}

      {phase === 'FINAL' && (
        <>
          {me.award && (
            <section
              aria-labelledby="my-award"
              data-award-note
              className="relative mt-2.5 grid w-full max-w-sm shrink-0 bg-sticky px-4 pt-4 pb-2 break-words text-ink shadow-[3px_4px_0_var(--color-ink)] motion-safe:animate-pop"
            >
              <Tape place="top" />
              <p className="sr-only">{t('yourAward')}</p>
              <h2 id="my-award" className="text-[clamp(1.75rem,9vw,2.125rem)] leading-tight">
                {t(AWARD_COPY[me.award.kind].name)}
              </h2>
              <p className="text-lg leading-snug text-soft">{t(AWARD_COPY[me.award.kind].why)}</p>
            </section>
          )}
          {/* After the award: the spec puts the award first (F50's test pins the order). */}
          <h1 className="sr-only">{t('finalTitle')}</h1>
          {me.rank && (
            <BigRank
              rank={me.rank.rank}
              score={me.score ?? 0}
              said={t('finalRank', { rank: me.rank.rank, of: me.rank.of })}
              // The host's final also holds Rematch and Back to lobby: a smaller number fits 360×560.
              short={socket !== undefined && view.host !== null}
              t={t}
            />
          )}
          <p className="shrink-0 text-xl leading-tight text-soft">
            <span aria-hidden="true">👀 </span>
            {t('seeGallery')}
          </p>
          {socket && view.host && <FinalHostActions view={view} socket={socket} t={t} />}
        </>
      )}

      <div className={`shrink-0 ${phase === 'REVEAL' ? '' : 'mt-auto'}`}>
        <LeaveButton onLeave={onLeave} inGame={phase !== 'FINAL'} t={t} />
      </div>
    </div>
  );
}

/**
 * The word in Nunito 900 on the highlighter (52 px), smaller for a long word so it stays on the
 * page; a word longer than a line wraps, swash and all.
 */
function RevealWord({ word }: { word: string }) {
  const size = word.length <= 9 ? 52 : word.length <= 14 ? 38 : 30;
  return (
    <p
      data-reveal-word
      className="max-w-full shrink-0 font-num leading-[1.15] font-black break-words motion-safe:animate-pop"
      style={{ fontSize: `min(${size}px, 14vw)` }}
    >
      <Highlight className="inline-block max-w-full whitespace-normal">{word}</Highlight>
    </p>
  );
}

/** The big red stamp: "+270" over "this turn", or "+320" over "for your drawing". */
function PointsStamp({
  points,
  say,
}: {
  points: number;
  say: (points: number | string) => string;
}) {
  const around = copyAround((marker) => say(marker));
  return (
    <p className="shrink-0">
      <span className="sr-only">{say(points)}</span>
      <span aria-hidden="true">
        <Stamp
          big
          value={around ? `${around[0]}${points}` : `+${points}`}
          caption={around ? around[1].trim() : undefined}
        />
      </span>
    </p>
  );
}

/**
 * The big `pen` ordinal (96 px, less on a short page) with its suffix raised, then the score in
 * Nunito. Screen readers hear the rank copy ("#2 of 5") and the points line instead.
 */
function BigRank({
  rank,
  score,
  said,
  short = false,
  t,
}: {
  rank: number;
  score: number;
  said: string;
  short?: boolean;
  t: Translate;
}) {
  const around = copyAround((marker) => t('points', { points: marker }));
  return (
    <div className="grid shrink-0 justify-items-center">
      <p className="sr-only">{said}</p>
      <p className="sr-only">{t('points', { points: score })}</p>
      <p
        aria-hidden="true"
        data-big-rank
        className={`font-num leading-none font-black text-pen tabular-nums ${
          short ? 'text-[min(96px,11dvh)]' : 'text-[min(96px,15dvh)]'
        }`}
      >
        {rank}
        <sup className="text-[0.36em]">{ordinalSuffix(rank)}</sup>
      </p>
      <p aria-hidden="true" className="leading-tight">
        <span className="font-num text-[30px] font-black tabular-nums">
          {around ? `${around[0]}${score}` : score}
        </span>
        {around && <span className="text-xl text-soft">{around[1]}</span>}
      </p>
    </div>
  );
}

/**
 * A row of the results' lists: the rank (scoreboard), avatar, the name in colour, and points in
 * Nunito.
 */
function Row({
  player,
  points,
  rank,
  me,
  compact,
}: {
  player: PlayerChipView;
  points: ReactNode;
  rank?: number | null;
  me?: boolean;
  compact: boolean;
}) {
  const ref = useRef<HTMLLIElement>(null);
  // A long list scrolls inside itself: your own row starts in its middle. Only the list moves
  // (scrollIntoView could shift the page under the rings too).
  useEffect(() => {
    const li = ref.current;
    const list = li?.parentElement;
    if (!me || !li || !list) return;
    list.scrollTop = li.offsetTop - (list.clientHeight - li.offsetHeight) / 2;
  }, [me]);
  return (
    <li
      ref={ref}
      data-me={me ? '' : undefined}
      // Your row on a light swash (30 %), so every crayon name keeps 4.5:1 on it.
      className={`flex items-center gap-2.5 border-b-[1.5px] border-dashed border-dot px-1 text-left ${
        compact ? 'min-h-[34px] text-lg' : 'min-h-11 text-[21px]'
      } ${me ? 'bg-hl/30' : ''}`}
    >
      {rank != null && (
        <span className="w-[1.4em] shrink-0 text-center font-num font-black text-soft tabular-nums">
          {rank}
        </span>
      )}
      <Avatar player={player} size={compact ? '26px' : '34px'} />
      <span className="min-w-0 truncate" style={{ color: player.color }}>
        {player.name}
      </span>
      <span className="ml-auto font-num font-black tabular-nums">{points}</span>
    </li>
  );
}

/** Rows above this many get 34 px, so a full room still shows most of its list. */
const COMPACT_ABOVE = 4;
const LIST = 'relative min-h-0 w-full max-w-sm shrink overflow-y-auto overscroll-contain';

/** The drawer's reveal: who got it, fastest first, with their points. */
function GotItRows({ view }: { view: PlayerView }) {
  const rows = [...(view.turn?.correct ?? [])]
    .sort((a, b) => a.order - b.order)
    .flatMap((c) => {
      const player = view.players.find((p) => p.pid === c.pid);
      return player ? [{ player, points: c.points }] : [];
    });
  if (rows.length === 0) return null;
  const compact = rows.length > COMPACT_ABOVE;
  return (
    <ul data-got-it-rows className={LIST}>
      {rows.map(({ player, points }) => (
        <Row key={player.pid} player={player} points={`+${points}`} compact={compact} />
      ))}
    </ul>
  );
}

/** The scoreboard's ranked list (the view's shared ranks), your row on the highlighter. */
function Standings({ view }: { view: PlayerView }) {
  const ranked = view.players
    .map((player, i) => ({ player, i }))
    .filter(({ player }) => player.score !== null)
    .sort((a, b) => (a.player.rank ?? 0) - (b.player.rank ?? 0) || a.i - b.i);
  const compact = ranked.length > COMPACT_ABOVE;
  return (
    <ol data-standings className={LIST}>
      {ranked.map(({ player }) => (
        <Row
          key={player.pid}
          player={player}
          points={player.score}
          rank={player.rank}
          me={player.pid === view.me.pid}
          compact={compact}
        />
      ))}
    </ol>
  );
}

/**
 * The crown holder's Rematch (a full-width sketch button) and Back to lobby (underlined), both two
 * taps as in the Host sheet: armed, Rematch turns red pen with "Tap again to rematch…".
 */
function FinalHostActions({
  view,
  socket,
  t,
}: {
  view: PlayerView;
  socket: GameSocket;
  t: Translate;
}) {
  const { armed, tap, sending, status, statusIsHint } = useHostTaps(view, socket, t);
  const hint = (c: ControlId) => (armed?.control === c ? CONFIRM_LABELS[c] : undefined);
  const label = (c: ControlId) => {
    const confirm = hint(c);
    return confirm ? t(confirm) : t(LABELS[c]);
  };
  const rematchArmed = hint('rematch') !== undefined;
  return (
    <div className="flex w-full max-w-sm shrink-0 flex-col items-center gap-1">
      <button
        type="button"
        onClick={(e) => tap('rematch', e.timeStamp)}
        aria-disabled={sending === 'rematch'}
        className={`${sketchButtonClass(rematchArmed ? 'armed' : 'primary', true)} aria-disabled:opacity-70`}
      >
        {/* The armed line is long: smaller type keeps it to two lines. */}
        <span className={rematchArmed ? 'text-[20px] leading-tight' : ''}>{label('rematch')}</span>
      </button>
      <button
        type="button"
        onClick={(e) => tap('backToLobby', e.timeStamp)}
        aria-disabled={sending === 'backToLobby'}
        className={`min-h-11 px-3 text-xl aria-disabled:opacity-70 ${
          armed?.control === 'backToLobby'
            ? 'text-red'
            : 'text-ink underline decoration-2 underline-offset-4'
        }`}
      >
        {label('backToLobby')}
      </button>
      {/* Only what the server said takes room; the arm hint is for screen readers (the button
          already asks again). */}
      <p
        role="status"
        className={status && !statusIsHint ? 'text-lg leading-tight text-red' : 'sr-only'}
      >
        {status ?? ''}
      </p>
    </div>
  );
}
