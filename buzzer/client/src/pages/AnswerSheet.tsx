import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import type { QuestionSet } from '../../../shared/types.js';
import { getSet } from '../lib/db.js';

const LOAD_ERROR = 'Could not load this set in this browser.';

type Load =
  | { state: 'loading' }
  | { state: 'missing' }
  | { state: 'error' }
  | { state: 'ready'; set: QuestionSet };

/**
 * **Print answer sheet** `/sets/:setId/print`: number, question, answer and notes for every
 * question, for a host running the game from the Screen without a phone. Black on white, so it
 * prints the same with or without background graphics; the buttons are left off the paper.
 */
export function AnswerSheet() {
  const { setId = '' } = useParams();
  const [load, setLoad] = useState<Load>({ state: 'loading' });

  useEffect(() => {
    let live = true;
    getSet(setId).then(
      (set) => live && setLoad(set ? { state: 'ready', set } : { state: 'missing' }),
      () => live && setLoad({ state: 'error' }),
    );
    return () => {
      live = false;
    };
  }, [setId]);

  const set = load.state === 'ready' ? load.set : null;
  // The title names the printout (and the PDF a browser saves), then goes back on leaving.
  useEffect(() => {
    if (!set) return;
    const previous = document.title;
    document.title = `${set.title} – answer sheet`;
    return () => {
      document.title = previous;
    };
  }, [set]);

  return (
    <main className="min-h-dvh bg-white px-4 py-8 text-black print:p-0">
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-4 print:hidden">
          <Link
            to={`/sets/${encodeURIComponent(setId)}`}
            className="inline-flex min-h-11 items-center text-lg underline underline-offset-4"
          >
            ← Back to the editor
          </Link>
          {set && (
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-2xl bg-black px-5 py-3 font-display text-xl text-white transition not-disabled:active:scale-95"
            >
              Print
            </button>
          )}
        </div>

        {load.state === 'loading' && <p>Loading…</p>}
        {load.state === 'missing' && <p role="alert">This set no longer exists.</p>}
        {load.state === 'error' && <p role="alert">{LOAD_ERROR}</p>}
        {set && <Sheet set={set} />}
      </div>
    </main>
  );
}

function Sheet({ set }: { set: QuestionSet }) {
  const count = set.questions.length;
  return (
    <>
      <header className="flex flex-col gap-1 border-b-2 border-black pb-3">
        <p className="text-sm tracking-widest uppercase">Answer sheet · host only</p>
        <h1 className="font-display text-3xl break-words">{set.title}</h1>
        <p>
          {count} {count === 1 ? 'question' : 'questions'}
        </p>
      </header>
      {count === 0 ? (
        <p>This set has no questions yet.</p>
      ) : (
        <table className="w-full border-collapse text-left align-top">
          <thead>
            <tr className="border-b-2 border-black">
              <th scope="col" className="w-10 py-2 pr-3">
                #
              </th>
              <th scope="col" className="py-2 pr-3">
                Question
              </th>
              <th scope="col" className="py-2 pr-3">
                Answer
              </th>
              <th scope="col" className="py-2">
                Notes
              </th>
            </tr>
          </thead>
          <tbody>
            {set.questions.map((question, index) => {
              const text = question.text.trim();
              return (
                <tr key={question.id} className="break-inside-avoid border-b border-gray-400">
                  <td className="py-2 pr-3 align-top font-bold tabular-nums">{index + 1}</td>
                  <td className="py-2 pr-3 align-top break-words whitespace-pre-line">
                    {text || (question.imageId ? <em>(picture question)</em> : '')}
                    {text && question.imageId && <em> (with a picture)</em>}
                  </td>
                  <td className="py-2 pr-3 align-top font-bold break-words">{question.answer}</td>
                  <td className="py-2 align-top break-words whitespace-pre-line">
                    {question.hostNotes ?? ''}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </>
  );
}
