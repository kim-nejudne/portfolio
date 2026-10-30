import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Question, QuestionSet } from '../../../shared/types.js';
import { imagesOf, type LoadImage } from '../lib/hostRoom.js';
import { setDetail } from '../lib/setLabels.js';
import { BUTTON_PRIMARY, LABEL, LINK } from '../lib/ui.js';

interface SetPreviewProps {
  set: QuestionSet;
  /** The host's next step with this set: the picker's Create room or Start new game, "Host this set" on `/sets`. */
  actionLabel: string;
  /** Runs the action; the preview closes first. */
  onAction: (set: QuestionSet) => void;
  onClose: () => void;
  /**
   * Where the pictures come from: the bundle for the built-in sample, else this browser. It must
   * keep its identity across renders (`imagesOf` returns module constants), or pictures reload.
   */
  loadImage?: LoadImage;
}

/**
 * **Preview** of a whole set before hosting it (DECISIONS F56): every question with its answer,
 * host notes, points and picture, read-only. It shows answers, so it is offered only on the host's
 * own devices, never on the Screen. Escape or Close returns focus to the opener.
 */
export function SetPreview({
  set,
  actionLabel,
  onAction,
  onClose,
  loadImage = imagesOf(set),
}: SetPreviewProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  // Read on the first render: once the page behind turns `inert`, the browser blurs the opener.
  const [opener] = useState(() => document.activeElement);

  // Focus moves into the preview, and back to whatever opened it on close. The page behind stops
  // scrolling, so only the question list scrolls (the whole dialog on a short screen).
  useEffect(() => {
    const overflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    headingRef.current?.focus();
    return () => {
      document.documentElement.style.overflow = overflow;
      if (opener instanceof HTMLElement) opener.focus();
    };
  }, [opener]);

  const onKey = useEffectEvent((event: KeyboardEvent) => {
    if (event.key !== 'Escape') return;
    // Esc closes only the preview, not a picker dialog under it.
    event.stopImmediatePropagation();
    onClose();
  });

  useEffect(() => {
    const listener = (event: KeyboardEvent) => onKey(event);
    window.addEventListener('keydown', listener, { capture: true });
    return () => window.removeEventListener('keydown', listener, { capture: true });
  }, []);

  const detail = [set.category, setDetail(set, false)].filter(Boolean).join(' · ');

  return createPortal(
    // Wider on a desktop, with two columns of questions (LIB-06). On a landscape phone the header
    // shrinks and the whole dialog scrolls, so the list isn't squeezed under it.
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/85 p-4 short:p-2">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="set-preview-heading"
        className="flex max-h-full w-full max-w-2xl flex-col gap-4 rounded-[20px] border-2 border-edge bg-surface p-6 text-lg short:gap-2 short:overflow-y-auto short:p-3 short:text-base lg:max-w-5xl"
      >
        <div className="shrink-0">
          <h2
            id="set-preview-heading"
            ref={headingRef}
            tabIndex={-1}
            className="font-display text-3xl break-words outline-none short:text-xl"
          >
            {set.title}
          </h2>
          <p className="text-muted">{detail}</p>
        </div>
        {set.questions.length === 0 ? (
          <p className="text-muted">This set has no questions yet.</p>
        ) : (
          <ol
            aria-label="Questions"
            className="grid min-h-0 content-start gap-3 overflow-y-auto [scrollbar-color:var(--color-edge)_transparent] short:shrink-0 short:grid-cols-2 short:gap-2 short:overflow-visible lg:grid-cols-2"
          >
            {set.questions.map((question, index) => (
              <PreviewQuestion
                key={question.id}
                question={question}
                number={index + 1}
                loadImage={loadImage}
              />
            ))}
          </ol>
        )}
        <button
          type="button"
          onClick={() => {
            onClose();
            onAction(set);
          }}
          className={`${BUTTON_PRIMARY} shrink-0 text-2xl short:text-xl`}
        >
          {actionLabel}
        </button>
        <button type="button" onClick={onClose} className={`${LINK} shrink-0`}>
          Close
        </button>
      </section>
    </div>,
    document.body,
  );
}

function PreviewQuestion({
  question,
  number,
  loadImage,
}: {
  question: Question;
  number: number;
  loadImage: LoadImage;
}) {
  const picture = usePicture(question.imageId, loadImage);
  const notes = question.hostNotes?.trim() ?? '';

  return (
    <li
      aria-label={`Question ${number}`}
      className="flex flex-col gap-2 rounded-xl border-2 border-edge bg-bg px-4 py-3 short:gap-1 short:px-3 short:py-2"
    >
      <p className={LABEL}>
        Question {number} · {question.points} points
      </p>
      {question.text.trim() === '' ? (
        <p className="text-muted">No question text</p>
      ) : (
        <p className="break-words whitespace-pre-line">{question.text}</p>
      )}
      {picture === 'missing' ? (
        <p className="text-buzz">The picture is missing from this browser.</p>
      ) : (
        picture !== undefined && (
          <img
            src={picture}
            alt={`Picture for question ${number}`}
            className="max-h-40 w-fit max-w-full rounded-lg object-contain"
          />
        )
      )}
      <p className="break-words">
        <span className="font-bold text-accent">Answer:</span>{' '}
        {question.answer.trim() === '' ? (
          <span className="text-muted">none yet</span>
        ) : (
          question.answer
        )}
      </p>
      {notes !== '' && (
        <p className="break-words whitespace-pre-line text-muted">
          <span className="font-bold">Host notes:</span> {notes}
        </p>
      )}
    </li>
  );
}

/** An object URL for a question's picture, 'missing' when it can't be found, revoked on unmount. */
function usePicture(
  imageId: string | undefined,
  loadImage: LoadImage,
): string | 'missing' | undefined {
  const [loaded, setLoaded] = useState<string | 'missing' | undefined>(undefined);

  useEffect(() => {
    if (imageId === undefined) return;
    let url: string | undefined;
    let live = true;
    loadImage(imageId).then(
      (blob) => {
        if (!live) return;
        if (!blob) return setLoaded('missing');
        url = URL.createObjectURL(blob);
        setLoaded(url);
      },
      () => live && setLoaded('missing'),
    );
    return () => {
      live = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [imageId, loadImage]);

  return imageId === undefined ? undefined : loaded;
}
