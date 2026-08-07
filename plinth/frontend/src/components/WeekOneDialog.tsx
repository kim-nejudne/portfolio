import { useEffect, useState } from 'react';
import Modal from './Modal';
import { WEEK_ONE } from '../data';

interface WeekOneDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function WeekOneDialog({ open, onClose }: WeekOneDialogProps) {
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!open) {
      const t = window.setTimeout(() => setSent(false), 400);
      return () => window.clearTimeout(t);
    }
  }, [open]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      labelledBy="week-one-heading"
      testId="week-one-dialog"
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted tabular-nums">
        Week 01 — free · no card
      </p>
      <h2
        id="week-one-heading"
        className="mt-5 font-display text-[clamp(2rem,6vw,3.5rem)] font-black uppercase leading-[0.9] tracking-[-0.03em]"
      >
        Week one, in full.
      </h2>
      <p className="mt-4 max-w-md font-mono text-xs uppercase leading-relaxed tracking-[0.15em] text-muted">
        Three sessions. Moderate load, high volume. Percentages resolve against
        your own one-rep max once you enrol.
      </p>

      <div className="mt-10 border-t border-ink" data-testid="week-one-sessions">
        {WEEK_ONE.map((s) => (
          <article key={s.id} className="border-b border-ink py-6">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h3 className="font-display text-3xl font-black uppercase tracking-[-0.02em]">
                {s.title}
              </h3>
              <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-blue tabular-nums">
                {s.day}
              </span>
            </div>
            <dl className="mt-4">
              {s.rows.map((r) => (
                <div
                  key={r.label}
                  className="grid grid-cols-1 gap-1 border-t border-ink/15 py-3 md:grid-cols-[180px_1fr] md:gap-6"
                >
                  <dt className="font-mono text-xs uppercase tracking-[0.15em]">
                    {r.label}
                  </dt>
                  <dd className="font-mono text-xs uppercase tracking-[0.15em] text-muted tabular-nums">
                    {r.detail}
                  </dd>
                </div>
              ))}
            </dl>
          </article>
        ))}
      </div>

      <div className="mt-10 bg-ink p-6 text-bone md:p-8">
        {sent ? (
          <div data-testid="week-one-confirmation">
            <p className="font-display text-3xl font-black uppercase tracking-[-0.02em]">
              Sent.
            </p>
            <p className="mt-3 font-mono text-xs uppercase tracking-[0.2em] text-muted-ink">
              Week one is in your inbox as a printable card. Start any Monday.
            </p>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setSent(true);
            }}
            data-testid="week-one-form"
          >
            <label
              className="block font-mono text-[10px] uppercase tracking-[0.25em] text-muted-ink"
              htmlFor="week-one-email"
            >
              Send week one to
            </label>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row">
              <input
                id="week-one-email"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                className="w-full border border-bone/40 bg-transparent px-4 py-3 font-mono text-sm text-bone placeholder:text-muted-ink"
              />
              <button
                type="submit"
                data-testid="week-one-submit"
                className="shrink-0 bg-blue px-8 py-3 font-mono text-xs uppercase tracking-[0.25em] text-bone"
              >
                Send it
              </button>
            </div>
            <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-ink">
              Demo — nothing is submitted or sent.
            </p>
          </form>
        )}
      </div>
    </Modal>
  );
}
