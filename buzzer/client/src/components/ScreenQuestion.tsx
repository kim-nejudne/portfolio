import type { BuzzGap, RankedPlayer, ScreenView } from '../../../shared/types.js';
import { imageUrl } from '../lib/api.js';
import { buzzersOpen, formatGap, questionTextClass } from '../lib/screenQuestion.js';

/**
 * The Screen during a question: its number, text and image, then the buzzer status or, once
 * someone has won the buzz, their banner and the "also buzzed" gaps (UI spec, Screen view).
 * Renders no answer: the Screen never shows one before REVEAL, and F24 adds it at REVEAL.
 */
export function ScreenQuestion({ view }: { view: ScreenView }) {
  const { question } = view;
  if (!question) return null;
  const text = question.text.trim();
  const winner =
    view.phase === 'BUZZED' ? view.players.find((p) => p.id === view.winnerId) : undefined;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-[3vh] px-[5vw] pt-[4vh] pb-[3vh]">
      <p className="shrink-0 text-[2.4vw] text-muted">
        Question {view.questionIndex + 1} of {view.questionCount}
      </p>
      <div className="flex min-h-0 flex-1 items-center gap-[4vw]">
        {text && (
          <h1
            className={`min-w-0 flex-1 overflow-hidden font-display leading-tight break-words ${questionTextClass(text, question.imageId !== undefined)}`}
          >
            {text}
          </h1>
        )}
        {question.imageId && (
          <img
            src={imageUrl(view.code, question.imageId)}
            alt={text ? 'Question image' : `Question ${view.questionIndex + 1}`}
            className="h-full min-h-0 min-w-0 flex-1 object-contain"
          />
        )}
      </div>
      {winner ? (
        <BuzzResult winner={winner} alsoBuzzed={view.alsoBuzzed} players={view.players} />
      ) : (
        <BuzzerStatus open={buzzersOpen(view.phase)} />
      )}
    </div>
  );
}

function BuzzerStatus({ open }: { open: boolean }) {
  return (
    <p
      role="status"
      className={`shrink-0 self-center rounded-full px-[4vw] py-[1.6vh] font-display text-[3.4vw] ${
        open ? 'bg-buzz text-ink motion-safe:animate-buzz-pulse' : 'bg-surface text-muted'
      }`}
    >
      {open ? 'Buzzers OPEN' : 'Buzzers locked'}
    </p>
  );
}

interface BuzzResultProps {
  winner: RankedPlayer;
  alsoBuzzed: BuzzGap[];
  players: RankedPlayer[];
}

function BuzzResult({ winner, alsoBuzzed, players }: BuzzResultProps) {
  const others = alsoBuzzed.flatMap((gap) => {
    const player = players.find((p) => p.id === gap.playerId);
    return player ? [{ player, gapMs: gap.gapMs }] : [];
  });
  return (
    <section aria-label="Buzz result" className="flex shrink-0 flex-col items-center gap-[2vh]">
      <h2
        style={{ backgroundColor: winner.color }}
        className="w-full truncate rounded-[3vh] px-[3vw] py-[2vh] text-center font-display text-[min(8vw,16vh)] leading-none text-bg"
      >
        {winner.name}
      </h2>
      {others.length > 0 && (
        <div className="flex max-w-full items-baseline gap-[1.6vw]">
          <p className="shrink-0 text-[2vw] text-muted">also buzzed</p>
          <ol aria-label="Also buzzed" className="flex flex-wrap gap-[1.2vw] overflow-hidden">
            {others.map(({ player, gapMs }) => (
              <li
                key={player.id}
                className="flex items-baseline gap-[0.6vw] text-[2.2vw] whitespace-nowrap"
              >
                <span style={{ color: player.color }} className="font-display">
                  {player.name}
                </span>
                <span className="text-muted tabular-nums">{formatGap(gapMs)}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}
