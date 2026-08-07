import { StatusMark } from '@/components/furniture/status-mark';
import { formatDateTime } from '@forme/domain';
import { JOB_STATE_LABEL, JOB_STATE_NOTE, stateOwner } from '@forme/domain';
import type { Job } from '@forme/domain';

/**
 * The spine of the job. Completed stages are black with a timestamp, the current
 * stage carries its owner's colour, future stages are hairline outlines.
 */
export function StateTimeline({ job, blocked }: { job: Job; blocked: boolean }) {
  return (
    <section aria-labelledby="timeline" className="border border-rule-strong">
      <h2 id="timeline" className="label-caps border-b-2 border-rule-strong px-3 py-2">
        State
      </h2>
      <ol className="px-3 py-3" data-testid="job-state-timeline">
        {job.stages.map((stage, index) => {
          const owner = stage.current ? stateOwner(stage.state, blocked) : 'final';
          const isLast = index === job.stages.length - 1;
          return (
            <li key={`${stage.state}-${index}`} className="grid grid-cols-[1rem_1fr] gap-x-3">
              <span className="flex flex-col items-center">
                <span aria-hidden="true" className="mt-1 block">
                  {stage.done ? (
                    <svg width="11" height="11" viewBox="0 0 11 11" className="text-ink">
                      <rect x="0.5" y="0.5" width="10" height="10" fill="currentColor" />
                    </svg>
                  ) : stage.current ? (
                    <svg
                      width="11"
                      height="11"
                      viewBox="0 0 11 11"
                      className={
                        owner === 'human'
                          ? 'text-magenta'
                          : owner === 'held'
                            ? 'text-yellow'
                            : 'text-cyan'
                      }
                    >
                      <rect x="0.5" y="0.5" width="10" height="10" fill="currentColor" />
                      <rect x="4" y="4" width="3" height="3" fill="#F4F2ED" />
                    </svg>
                  ) : (
                    <svg width="11" height="11" viewBox="0 0 11 11" className="text-rule-strong">
                      <rect
                        x="0.5"
                        y="0.5"
                        width="10"
                        height="10"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1"
                      />
                    </svg>
                  )}
                </span>
                {!isLast ? (
                  <span
                    aria-hidden="true"
                    className={`mt-1 block w-px flex-1 ${stage.done ? 'bg-ink' : 'bg-rule'}`}
                    style={{ minHeight: 18 }}
                  />
                ) : null}
              </span>
              <span className={`block pb-3 ${stage.done || stage.current ? '' : 'text-muted'}`}>
                <span
                  className={`num text-xs tracking-[0.06em] ${stage.current ? 'font-semibold' : ''}`}
                >
                  {JOB_STATE_LABEL[stage.state]}
                </span>
                <span className="num ml-2 text-2xs text-muted">
                  {stage.at ? formatDateTime(stage.at) : '\u2014'}
                </span>
                {stage.current ? (
                  <span className="mt-1 block">
                    <StatusMark
                      owner={owner}
                      label={
                        owner === 'human'
                          ? 'ACTION REQUIRED'
                          : owner === 'held'
                            ? 'HELD'
                            : owner === 'final'
                              ? 'FINAL'
                              : 'AUTOMATED'
                      }
                    />
                    <span className="mt-1 block text-xs text-muted">
                      {JOB_STATE_NOTE[stage.state]}
                    </span>
                  </span>
                ) : null}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
