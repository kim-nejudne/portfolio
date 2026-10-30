import { useEffect, useEffectEvent, useRef, useState } from 'react';
import type { QuestionSet, ScreenView } from '../../../shared/types.js';
import { previewView } from '../lib/setEditor.js';
import { BUTTON_ICON, BUTTON_PRIMARY_SMALL, BUTTON_SMALL } from '../lib/ui.js';
import { useStoredImageUrl } from '../lib/useStoredImageUrl.js';
import { Icon } from './Icon.js';
import { ScreenHeader, ScreenRail } from './ScreenChrome.js';
import { ScreenQuestion } from './ScreenQuestion.js';

/** The stage's size: the largest 16:9 box that fits the space above the bar. */
export const STAGE_SIZE = 'aspect-video w-[min(100cqw,calc(100cqh*16/9))]';

interface QuestionPreviewProps {
  set: QuestionSet;
  index: number;
  onIndex: (index: number) => void;
  onClose: () => void;
}

/**
 * **Preview** (Set editor): question `index` over the whole window, drawn by the Screen's own
 * `ScreenQuestion` from a view without the answer, in a letterboxed 16:9 stage that is the size
 * container of the Screen's `cqw`/`cqh` units. A laptop shows it as the TV will, and a phone in
 * portrait a small TV (EDT-08).
 * **Show answer** (or `A`) switches to the Screen's reveal; stepping to another question or
 * closing turns it off. Escape closes it; ← and → step through the set.
 */
export function QuestionPreview({ set, index, onIndex, onClose }: QuestionPreviewProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const [answerOn, setAnswerOn] = useState(false);
  const hasAnswer = (set.questions[index]?.answer.trim() ?? '') !== '';
  const showAnswer = answerOn && hasAnswer;
  const view = previewView(set, index, showAnswer);
  const imageSrc = useStoredImageUrl(view.question?.imageId);
  const isFirst = index === 0;
  const isLast = index === set.questions.length - 1;

  const step = (to: number) => {
    setAnswerOn(false);
    onIndex(to);
  };

  // Focus moves into the preview, and back to whatever opened it on close. The editor behind stops
  // scrolling, so its scrollbar does not narrow the preview's viewport units.
  useEffect(() => {
    const opener = document.activeElement;
    const overflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => {
      document.documentElement.style.overflow = overflow;
      if (opener instanceof HTMLElement) opener.focus();
    };
  }, []);

  const onKey = useEffectEvent((event: KeyboardEvent) => {
    if (event.key === 'Escape') onClose();
    else if (event.key === 'ArrowLeft' && !isFirst) step(index - 1);
    else if (event.key === 'ArrowRight' && !isLast) step(index + 1);
    else if (event.key.toLowerCase() === 'a' && hasAnswer) {
      if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
      setAnswerOn((on) => !on);
    }
  });

  useEffect(() => {
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Preview of question ${index + 1}`}
      className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-black"
    >
      <div className="grid min-h-0 flex-1 place-items-center [container-type:size]">
        <div
          data-testid="preview-stage"
          className={`flex flex-col overflow-hidden bg-bg [container-type:size] ${STAGE_SIZE}`}
        >
          <ScreenRail />
          <ScreenHeader
            code={view.code}
            questionIndex={view.questionIndex}
            questionCount={view.questionCount}
            numbered
          />
          <ScreenQuestion view={withoutMissingImage(view, imageSrc)} imageSrc={imageSrc} />
          <ScreenRail />
        </div>
      </div>
      <div className="flex shrink-0 items-center justify-between gap-3 border-t-2 border-edge bg-surface px-4 py-3">
        <p className="hidden text-muted lg:block">Preview: how the Screen shows this question</p>
        <div className="flex flex-1 flex-wrap items-center justify-end gap-2 sm:flex-nowrap lg:flex-none">
          <button
            type="button"
            aria-pressed={showAnswer}
            onClick={() => setAnswerOn((on) => !on)}
            disabled={!hasAnswer}
            className={
              showAnswer
                ? `${BUTTON_SMALL} border-accent text-accent`
                : `${BUTTON_PRIMARY_SMALL} text-base`
            }
          >
            Show answer
          </button>
          <button
            type="button"
            onClick={() => step(index - 1)}
            disabled={isFirst}
            className={`${BUTTON_SMALL} whitespace-nowrap`}
          >
            ← Previous
          </button>
          <button
            type="button"
            onClick={() => step(index + 1)}
            disabled={isLast}
            className={`${BUTTON_SMALL} whitespace-nowrap`}
          >
            Next →
          </button>
          <button
            ref={closeRef}
            type="button"
            aria-label="Close"
            onClick={onClose}
            className={BUTTON_ICON}
          >
            <Icon name="x" />
          </button>
        </div>
      </div>
    </div>
  );
}

/** Until a stored image has loaded (or when it is gone), the preview lays out without one. */
function withoutMissingImage(view: ScreenView, imageSrc: string | undefined): ScreenView {
  if (!view.question?.imageId || imageSrc) return view;
  const question = { ...view.question };
  delete question.imageId;
  return { ...view, question };
}
