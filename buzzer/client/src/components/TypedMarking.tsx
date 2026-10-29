import { useId } from 'react';
import type { HostTypedView, Phase } from '../../../shared/types.js';
import { LABEL } from '../lib/ui.js';
import type { HostCommand } from '../lib/useHostCommand.js';
import { Icon } from './Icon.js';

interface TypedMarkingProps {
  typed: HostTypedView;
  phase: Phase;
  command: HostCommand;
  /** List the groups. The read-aloud layout covers the answer, so it waits for the lock (F88). */
  showGroups: boolean;
}

/**
 * A typed question on the remote (F88): "N of M answered" while answers come in, then each group
 * of matching answers with how many typed it and a Correct checkbox, ticked when it is pre-marked
 * or marked. A tick sends the whole ticked set as `host:markTyped`; the boxes follow the server's
 * `correct`, so they never show a mark the server has not taken. At REVEAL they are read-only.
 */
export function TypedMarking({ typed, phase, command, showGroups }: TypedMarkingProps) {
  const marking = phase === 'ANSWERING';
  const idPrefix = useId();
  const ticked = typed.groups.filter((group) => group.correct).map((group) => group.key);

  function toggle(key: string, correct: boolean) {
    const groups = correct ? [...ticked, key] : ticked.filter((other) => other !== key);
    command.run('host:markTyped', { groups });
  }

  return (
    <section
      aria-label="Answers"
      className="flex flex-col gap-2.5 rounded-[20px] border-2 border-edge bg-surface p-4"
    >
      <p className={`flex justify-between gap-2 ${LABEL}`}>
        <span>Answers</span>
        {(marking || phase === 'REVEAL') && (
          <span role="status" className="shrink-0 whitespace-nowrap">
            {marking && typed.closed
              ? `Answers closed · ${typed.answered} answered`
              : `${typed.answered} of ${typed.expected} answered`}
          </span>
        )}
      </p>
      {!showGroups ? (
        <p className="text-muted">Answers show here once they close.</p>
      ) : typed.groups.length === 0 ? (
        <p className="text-muted">{phase === 'QUESTION' ? 'Not open yet.' : 'No answers yet.'}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {typed.groups.map((group, index) => {
            // Keys hold spaces, which an id may not.
            const id = `${idPrefix}-${index}`;
            return (
              <li
                key={group.key}
                data-correct={group.correct || undefined}
                className={`flex items-center gap-3 rounded-xl border-2 bg-bg px-3 py-2 ${
                  group.correct ? 'border-win' : 'border-transparent'
                }`}
              >
                <input
                  id={id}
                  type="checkbox"
                  aria-label={`Mark ${group.text} correct`}
                  checked={group.correct}
                  disabled={!marking || command.busy}
                  onChange={(event) => toggle(group.key, event.target.checked)}
                  className="size-6 shrink-0 accent-win"
                />
                <label htmlFor={id} className="flex min-w-0 flex-1 flex-col">
                  <span className="font-bold break-words">{group.text}</span>
                  {group.preMarked && <span className="text-sm text-muted">Pre-marked</span>}
                </label>
                {group.correct && !marking && (
                  <Icon name="check" className="size-5 shrink-0 text-win" />
                )}
                <span
                  data-count
                  aria-label={`${group.playerIds.length} typed it`}
                  className="min-w-6 shrink-0 text-right font-display text-xl tabular-nums"
                >
                  {group.playerIds.length}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
