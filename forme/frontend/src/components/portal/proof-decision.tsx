'use client';

import { useState } from 'react';
import { approveProofAction, rejectProofAction } from '@/lib/actions/jobs';
import { formatDate } from '@forme/domain';

/**
 * Approve is the most consequential button in the app: two steps, an explicit
 * acknowledgement, and a plain statement of what it does.
 */
export function ProofDecision({
  reference,
  despatchAt,
  disabled,
  disabledReason,
}: {
  reference: string;
  despatchAt: string;
  disabled: boolean;
  disabledReason: string;
}) {
  const [mode, setMode] = useState<'idle' | 'approve' | 'reject'>('idle');
  const [acknowledged, setAcknowledged] = useState(false);

  if (disabled) {
    return (
      <section aria-labelledby="decision" className="border-2 border-magenta">
        <h2 id="decision" className="label-caps border-b-2 border-magenta px-3 py-2 text-magenta">
          Proof blocked
        </h2>
        <p className="px-3 py-3 text-sm">{disabledReason}</p>
      </section>
    );
  }

  return (
    <section aria-labelledby="decision" className="border-2 border-ink" data-testid="proof-decision">
      <h2 id="decision" className="label-caps border-b-2 border-ink px-3 py-2">
        Proof decision
      </h2>

      {mode === 'idle' ? (
        <div className="px-3 py-3">
          <p className="text-sm">
            Approving locks the artwork. Nothing changes after this without a new estimate, and the
            despatch date is counted from the moment you approve.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setMode('approve')}
              data-testid="approve-proof-button"
              className="border border-ink px-4 py-2 label-caps transition-colors duration-100 hover:bg-ink hover:text-paper"
            >
              Approve proof
            </button>
            <button
              type="button"
              onClick={() => setMode('reject')}
              data-testid="reject-proof-button"
              className="border border-magenta px-4 py-2 label-caps text-magenta transition-colors duration-100 hover:bg-magenta hover:text-paper"
            >
              Reject proof
            </button>
          </div>
        </div>
      ) : null}

      {mode === 'approve' ? (
        <form action={approveProofAction} className="px-3 py-3" data-testid="approve-confirm-form">
          <input type="hidden" name="reference" value={reference} />
          <p className="label-caps text-magenta">Confirm</p>
          <ul className="mt-2 space-y-1 text-sm">
            <li>The artwork is locked and goes to imposition as supplied.</li>
            <li>
              Despatch is calculated from today:{' '}
              <span className="num">{formatDate(despatchAt)}</span>.
            </li>
            <li>Outstanding warnings will print as they stand.</li>
          </ul>
          <label className="mt-3 flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(event) => setAcknowledged(event.target.checked)}
              className="mt-0.5 size-3.5 accent-cyan"
              data-testid="approve-acknowledge"
            />
            <span>I have checked this proof against the artwork specification.</span>
          </label>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={!acknowledged}
              data-testid="approve-confirm"
              className="border border-ink px-4 py-2 label-caps transition-colors duration-100 hover:bg-ink hover:text-paper disabled:border-rule-strong disabled:text-muted disabled:hover:bg-paper disabled:hover:text-muted"
            >
              Lock the forme
            </button>
            <button
              type="button"
              onClick={() => setMode('idle')}
              className="border border-rule-strong px-4 py-2 label-caps text-muted transition-colors duration-100 hover:border-ink hover:text-ink"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      {mode === 'reject' ? (
        <form action={rejectProofAction} className="px-3 py-3" data-testid="reject-form">
          <input type="hidden" name="reference" value={reference} />
          <label htmlFor="reject-reason" className="label-caps text-muted">
            What is wrong with the proof
          </label>
          <textarea
            id="reject-reason"
            name="reason"
            required
            minLength={4}
            rows={3}
            aria-describedby="reject-help"
            className="mt-1 w-full border border-rule-strong bg-paper px-2 py-1 text-sm focus:border-ink"
            data-testid="reject-reason"
          />
          <p id="reject-help" className="mt-1 text-xs text-muted">
            The reason goes on the job record and back to prepress. Name the page and the object.
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            <button
              type="submit"
              data-testid="reject-confirm"
              className="border border-magenta px-4 py-2 label-caps text-magenta transition-colors duration-100 hover:bg-magenta hover:text-paper"
            >
              Send it back
            </button>
            <button
              type="button"
              onClick={() => setMode('idle')}
              className="border border-rule-strong px-4 py-2 label-caps text-muted transition-colors duration-100 hover:border-ink hover:text-ink"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
