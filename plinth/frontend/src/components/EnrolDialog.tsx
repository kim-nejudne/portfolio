import { useEffect, useState } from 'react';
import Modal from './Modal';

const FIELD =
  'w-full border border-ink bg-transparent px-4 py-3 font-mono text-sm text-ink placeholder:text-muted';
const LABEL =
  'block font-mono text-[10px] uppercase tracking-[0.25em] text-muted';

const LIFTS = [
  { id: 'squat', label: 'Squat', placeholder: '140' },
  { id: 'bench', label: 'Bench', placeholder: '100' },
  { id: 'deadlift', label: 'Deadlift', placeholder: '180' },
];

const STARTS = [
  'MON 10 AUG 2026',
  'MON 17 AUG 2026',
  'MON 24 AUG 2026',
  'MON 31 AUG 2026',
];

const PLANS = [
  { id: 'monthly', price: '₱2,150', note: 'Per month · cancel any block' },
  { id: 'cycle', price: '₱7,100', note: 'Per cycle · 16 weeks · prepaid' },
];

interface EnrolDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function EnrolDialog({ open, onClose }: EnrolDialogProps) {
  const [days, setDays] = useState('4');
  const [plan, setPlan] = useState('cycle');
  const [start, setStart] = useState(STARTS[0]);
  const [done, setDone] = useState(false);

  // Reset to the form when the dialog is dismissed, not while it is closing.
  useEffect(() => {
    if (!open) {
      const t = window.setTimeout(() => setDone(false), 400);
      return () => window.clearTimeout(t);
    }
  }, [open]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      labelledBy="enrol-heading"
      testId="enrol-dialog"
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted tabular-nums">
        Enrol — block 01 · accumulate
      </p>

      {done ? (
        <div data-testid="enrol-confirmation">
          <h2
            id="enrol-heading"
            className="mt-5 font-display text-[clamp(2rem,6vw,3.5rem)] font-black uppercase leading-[0.9] tracking-[-0.03em]"
          >
            You&apos;re in.
          </h2>
          <dl className="mt-8 border-t border-ink">
            {[
              ['Starts', start],
              ['Block', '01 · ACCUMULATE · WEEKS 01–04'],
              ['Sessions', `${days} per week`],
              [
                'Billing',
                plan === 'cycle'
                  ? '₱7,100 · one cycle · after week one'
                  : '₱2,150 · monthly · after week one',
              ],
            ].map(([k, v]) => (
              <div
                key={k}
                className="grid grid-cols-1 gap-1 border-b border-ink/20 py-3 md:grid-cols-[140px_1fr] md:gap-6"
              >
                <dt className="font-mono text-xs uppercase tracking-[0.15em]">
                  {k}
                </dt>
                <dd className="font-mono text-xs uppercase tracking-[0.15em] text-muted tabular-nums">
                  {v}
                </dd>
              </div>
            ))}
          </dl>
          {/* The form says it is a demo; this state did not, and it is the one
              that reads as a completed transaction. */}
          <p className="mt-8 font-mono text-xs uppercase tracking-[0.2em] text-muted">
            Demo — nothing was submitted and no card was taken. PLINTH is a
            portfolio piece, not a real program.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="mt-8 w-full bg-blue px-10 py-4 font-mono text-sm uppercase tracking-[0.25em] text-bone sm:w-auto"
          >
            Done
          </button>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setDone(true);
          }}
          data-testid="enrol-form"
        >
          <h2
            id="enrol-heading"
            className="mt-5 font-display text-[clamp(2rem,6vw,3.5rem)] font-black uppercase leading-[0.9] tracking-[-0.03em]"
          >
            Start block one.
          </h2>
          <p className="mt-4 max-w-md font-mono text-xs uppercase leading-relaxed tracking-[0.15em] text-muted">
            The numbers below set your starting loads. They can be edited at any
            Sunday reset.
          </p>

          <div className="mt-10 grid gap-6 sm:grid-cols-2">
            <div>
              <label className={LABEL} htmlFor="enrol-name">
                Name
              </label>
              <input
                id="enrol-name"
                name="name"
                required
                autoComplete="name"
                placeholder="Kim Nejudne"
                className={`${FIELD} mt-2`}
              />
            </div>
            <div>
              <label className={LABEL} htmlFor="enrol-email">
                Email
              </label>
              <input
                id="enrol-email"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                className={`${FIELD} mt-2`}
              />
            </div>
          </div>

          <fieldset className="mt-8">
            <legend className={LABEL}>
              Estimated one-rep max · kilograms
            </legend>
            <div className="mt-2 grid gap-4 sm:grid-cols-3">
              {LIFTS.map((lift) => (
                <div key={lift.id}>
                  <label className="sr-only" htmlFor={`enrol-${lift.id}`}>
                    {lift.label} one-rep max in kilograms
                  </label>
                  <div className="flex items-center border border-ink">
                    <span className="border-r border-ink px-3 py-3 font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
                      {lift.label}
                    </span>
                    <input
                      id={`enrol-${lift.id}`}
                      name={lift.id}
                      type="number"
                      min="20"
                      max="500"
                      step="2.5"
                      inputMode="decimal"
                      placeholder={lift.placeholder}
                      className="w-full bg-transparent px-3 py-3 font-mono text-sm tabular-nums placeholder:text-muted"
                    />
                  </div>
                </div>
              ))}
            </div>
          </fieldset>

          <fieldset className="mt-8">
            <legend className={LABEL}>Sessions per week</legend>
            <div className="mt-2 flex border border-ink">
              {['3', '4', '5'].map((n) => (
                <label
                  key={n}
                  className={`flex-1 cursor-pointer px-2 py-3 text-center font-mono text-sm uppercase tracking-[0.2em] tabular-nums has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-[-2px] has-[:focus-visible]:outline-ink ${
                    days === n ? 'bg-ink text-bone' : ''
                  }`}
                >
                  <input
                    type="radio"
                    name="days"
                    value={n}
                    checked={days === n}
                    onChange={() => setDays(n)}
                    className="sr-only"
                  />
                  {n}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="mt-8">
            <label className={LABEL} htmlFor="enrol-start">
              First Monday
            </label>
            <select
              id="enrol-start"
              name="start"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className={`${FIELD} mt-2 appearance-none tabular-nums`}
            >
              {STARTS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <fieldset className="mt-8">
            <legend className={LABEL}>Billing after week one</legend>
            <div className="mt-2 grid gap-4 sm:grid-cols-2">
              {PLANS.map((p) => (
                <label
                  key={p.id}
                  className={`cursor-pointer border border-ink p-5 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink ${
                    plan === p.id ? 'bg-ink text-bone' : ''
                  }`}
                >
                  <input
                    type="radio"
                    name="plan"
                    value={p.id}
                    checked={plan === p.id}
                    onChange={() => setPlan(p.id)}
                    className="sr-only"
                  />
                  <span className="block font-display text-3xl font-black tracking-[-0.02em] tabular-nums">
                    {p.price}
                  </span>
                  <span
                    className={`mt-2 block font-mono text-[10px] uppercase tracking-[0.2em] ${
                      plan === p.id ? 'text-muted-ink' : 'text-muted'
                    }`}
                  >
                    {p.note}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <button
            type="submit"
            data-testid="enrol-submit"
            className="mt-10 w-full bg-blue px-10 py-5 font-mono text-sm uppercase tracking-[0.25em] text-bone"
          >
            Begin accumulate
          </button>
          <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
            Demo — no card is taken and nothing is submitted.
          </p>
        </form>
      )}
    </Modal>
  );
}
