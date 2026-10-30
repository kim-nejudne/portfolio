import { QRCodeSVG } from 'qrcode.react';
import { useState } from 'react';
import type { HostView } from '../../../shared/types.js';
import { imageUrl } from '../lib/api.js';
import { questionHeading } from '../lib/boardCursor.js';
import { displayUrl, isLoopbackHost, joinPageOrigin, joinUrl } from '../lib/joinUrl.js';
import { CARD, LABEL, LINK } from '../lib/ui.js';
import { useJoinOrigin } from '../lib/useJoinOrigin.js';
import { usePointerFine } from '../lib/usePointerFine.js';

// The remote's read-aloud layout (F69, UI spec Host remote): for a game run from one phone with no
// Screen, so the phone shows the join QR itself and the host reads each question out.

/** The lobby's join block: the address, its QR and the room code, for players to scan off the phone. */
export function ReadAloudJoin({ code }: { code: string }) {
  // The same origin rules as the Screen's lobby (DECISIONS F42).
  const joinOrigin = useJoinOrigin();
  const url = joinUrl(joinPageOrigin(joinOrigin ?? null, window.location), code);
  const unreachable = joinOrigin === null && isLoopbackHost(window.location.hostname);
  return (
    <section aria-label="Join" className={`flex flex-col items-center gap-3 text-center ${CARD}`}>
      <p className={LABEL}>Join at</p>
      <p className="font-display text-xl break-all text-accent">{displayUrl(url)}</p>
      {/* White behind the QR, so every phone camera reads it. */}
      <div className="rounded-2xl bg-white p-3">
        <QRCodeSVG
          value={url}
          title={`Join at ${url}`}
          marginSize={0}
          style={{ width: 'min(60vw, 16rem)', height: 'min(60vw, 16rem)' }}
        />
      </div>
      <p className={LABEL}>Room code</p>
      {/* Shrinks with the phone, so four wide Bungee letters fit a 320px screen (HST-06). */}
      <p className="font-display text-[clamp(2.5rem,16vw,3.75rem)] tracking-[0.2em] text-accent">
        {code}
      </p>
      {unreachable && (
        <p role="note" className="text-muted">
          Phones can’t open localhost. Open this page at this computer’s network address instead.
        </p>
      )}
    </section>
  );
}

/**
 * The current question in large type to read out, its image, and the answer under a cover the host
 * taps to lift. With no Screen to show it, the answer is uncovered once revealed, for reading out.
 */
export function ReadAloudQuestion({ view }: { view: HostView }) {
  const { question } = view;
  if (!question) return null;
  return (
    <section
      aria-label="Question"
      className="flex flex-col gap-4 rounded-[20px] border-2 border-edge bg-surface p-5"
    >
      <p className={`flex justify-between gap-2 ${LABEL}`}>
        <span>{questionHeading(view.board, view.questionIndex, view.questionCount)}</span>
        <span className="shrink-0 whitespace-nowrap">{question.points} pts</span>
      </p>
      {question.text && (
        <p className="text-[28px] leading-snug font-bold break-words">{question.text}</p>
      )}
      {question.imageId && (
        <img
          src={imageUrl(view.code, question.imageId)}
          alt={question.text ? 'Question image' : 'Picture question'}
          className="max-h-72 self-center rounded-xl object-contain"
        />
      )}
      {/* Keyed by question, so each new question starts covered. */}
      <AnswerCover
        key={view.questionIndex}
        answer={question.answer}
        hostNotes={question.hostNotes}
        revealed={view.phase === 'REVEAL'}
      />
    </section>
  );
}

interface AnswerCoverProps {
  answer: string;
  hostNotes?: string;
  revealed: boolean;
}

function AnswerCover({ answer, hostNotes, revealed }: AnswerCoverProps) {
  const [shown, setShown] = useState(false);
  const pointerFine = usePointerFine();
  if (!shown && !revealed) {
    // The answer is not in the page until the cover is lifted, so nobody reads it over a shoulder.
    return (
      <button
        type="button"
        onClick={() => setShown(true)}
        className="min-h-14 rounded-xl border-2 border-dashed border-edge bg-bg px-3.5 py-3 text-lg text-muted"
      >
        {pointerFine ? 'Click to show answer' : 'Tap to show answer'}
      </button>
    );
  }
  return (
    <div aria-label="Answer" className="flex flex-col gap-1.5 rounded-xl bg-bg px-3.5 py-3">
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className={LABEL}>Answer</span>
        <span className="font-display text-2xl break-words text-accent">{answer}</span>
      </p>
      {hostNotes && <p className="text-muted">{hostNotes}</p>}
      {!revealed && (
        <button type="button" onClick={() => setShown(false)} className={`${LINK} self-start`}>
          Hide answer
        </button>
      )}
    </div>
  );
}
