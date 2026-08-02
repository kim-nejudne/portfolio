'use client';

import { useEffect, useRef, useState } from 'react';
import { RegistrationTarget } from '@/components/furniture/marks';
import { SeverityMark } from '@/components/furniture/status-mark';
import { subscribeToPreflight } from '@/lib/api/preflight';
import { createJobAction } from '@/lib/actions/jobs';
import type { PreflightCheck, QuoteInput } from '@/lib/types';

interface StreamState {
  checks: readonly PreflightCheck[];
  total: number;
  running: boolean;
}

const EMPTY: StreamState = { checks: [], total: 12, running: false };

/**
 * The upload. The drop zone is decoration over a real file input; the checks
 * arrive from the data layer one at a time. There is no timer in this component.
 */
export function IntakePanel({ input, description }: { input: QuoteInput; description: string }) {
  const [file, setFile] = useState<{ name: string; bytes: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [stream, setStream] = useState<StreamState>(EMPTY);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!file) {
      setStream(EMPTY);
      return;
    }
    setStream({ checks: [], total: 12, running: true });
    const unsubscribe = subscribeToPreflight(file.name, (check, index, total) => {
      setStream((current) => ({
        checks: [...current.checks, check],
        total,
        running: index + 1 < total,
      }));
    });
    return unsubscribe;
  }, [file]);

  function take(files: FileList | null) {
    const next = files && files.length > 0 ? files[0] : null;
    setFile(next ? { name: next.name, bytes: next.size } : null);
  }

  const fails = stream.checks.filter((check) => check.severity === 'FAIL').length;
  const warns = stream.checks.filter((check) => check.severity === 'WARN').length;
  const passes = stream.checks.filter((check) => check.severity === 'PASS').length;
  const complete = file !== null && !stream.running && stream.checks.length > 0;

  return (
    <form action={createJobAction} className="border-2 border-ink" data-testid="intake-form">
      <input type="hidden" name="product" value={input.product} />
      <input type="hidden" name="size" value={input.size} />
      <input type="hidden" name="pages" value={input.pageCount === null ? '' : input.pageCount} />
      <input type="hidden" name="stock" value={input.stock} />
      <input type="hidden" name="colours" value={input.colours} />
      <input type="hidden" name="quantity" value={input.quantity} />
      <input type="hidden" name="turnaround" value={input.turnaround} />
      {input.finishing.map((id) => (
        <input key={id} type="hidden" name="finishing" value={id} />
      ))}

      <div className="flex items-center justify-between border-b-2 border-ink px-3 py-2">
        <h2 className="label-caps">Artwork</h2>
        <span className="num text-2xs text-muted">PDF/X-4 · 3mm bleed · 300ppi</span>
      </div>

      <div className="px-3 py-3">
        <label htmlFor="description" className="label-caps text-muted">
          Job description
        </label>
        <input
          id="description"
          name="description"
          required
          defaultValue={description}
          maxLength={80}
          className="mt-1 h-8 w-full border border-rule-strong bg-paper px-2 text-sm focus:border-ink"
          data-testid="intake-description"
        />
        <p className="mt-1 text-xs text-muted">
          How it will read on the job ticket and on the floor board. 80 characters.
        </p>
      </div>

      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          if (inputRef.current && event.dataTransfer.files.length > 0) {
            inputRef.current.files = event.dataTransfer.files;
            take(event.dataTransfer.files);
          }
        }}
        className={`mx-3 mb-3 border p-4 transition-colors duration-100 ${
          dragging ? 'border-cyan bg-skeleton' : 'border-rule-strong border-dashed'
        }`}
        data-testid="drop-zone"
      >
        <label htmlFor="artwork" className="label-caps">
          Artwork file
        </label>
        <input
          ref={inputRef}
          id="artwork"
          name="artwork"
          type="file"
          accept=".pdf,application/pdf"
          onChange={(event) => take(event.target.files)}
          aria-describedby="artwork-help"
          className="mt-2 block w-full text-xs"
          data-testid="artwork-input"
        />
        <p id="artwork-help" className="mt-2 text-xs text-muted">
          Drop a file on this panel or use the field. One PDF per job, pages in reading order.
          Preflight starts as soon as the file is chosen.
        </p>
      </div>

      <div className="border-t border-rule">
        <div className="flex items-center justify-between px-3 py-2">
          <h3 className="label-caps">Preflight</h3>
          <span className="flex items-center gap-2">
            {stream.running ? <RegistrationTarget size={16} spinning /> : null}
            <span className="num text-2xs text-muted">
              {file === null
                ? 'WAITING FOR FILE'
                : `${stream.checks.length} / ${stream.total} CHECKS`}
            </span>
          </span>
        </div>

        <p aria-live="polite" className="sr-only" data-testid="preflight-live">
          {file === null
            ? ''
            : stream.running
              ? `Check ${stream.checks.length} of ${stream.total} complete.`
              : `Preflight complete. ${passes} passed, ${warns} warnings, ${fails} failures.`}
        </p>

        {file === null ? (
          <p className="px-3 pb-3 text-xs text-muted" data-testid="empty-state">
            Twelve checks run against the artwork specification. They land here one at a time as
            each one finishes.
          </p>
        ) : (
          <ol className="border-t border-rule" data-testid="preflight-stream">
            {stream.checks.map((check, index) => (
              <li
                key={check.id}
                className="anim-land flex items-center gap-3 border-b border-rule px-3 py-1.5 last:border-b-0"
                style={{ animationDelay: `${index * 0}ms` }}
              >
                <SeverityMark severity={check.severity} />
                <span className="flex-1 truncate text-xs" title={check.finding}>
                  {check.label}
                </span>
                <span className="num hidden text-2xs text-muted md:inline">{check.measured}</span>
              </li>
            ))}
            {stream.running ? (
              <li className="flex items-center gap-3 border-b border-rule px-3 py-1.5">
                <RegistrationTarget size={12} spinning />
                <span className="num text-2xs text-muted">
                  RUNNING CHECK {Math.min(stream.checks.length + 1, stream.total)} OF {stream.total}
                </span>
              </li>
            ) : null}
          </ol>
        )}

        {complete ? (
          <div className="border-t border-rule px-3 py-3">
            <p className="num text-xs">
              {passes} PASS · {warns} WARN ·{' '}
              <span className={fails > 0 ? 'text-magenta' : ''}>{fails} FAIL</span>
            </p>
            <p className="mt-1 text-xs text-muted">
              {fails > 0
                ? 'Failures do not stop you submitting the job. They stop it going to proof until prepress overrides each one with a written reason.'
                : 'Nothing blocking. The job goes to proofing as soon as prepress has looked at it.'}
            </p>
          </div>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-4 border-t-2 border-ink px-3 py-3">
        <p className="text-xs text-muted">Submitting books the job and issues a reference.</p>
        <button
          type="submit"
          disabled={file === null}
          data-testid="intake-submit"
          className="border border-ink px-4 py-2 label-caps transition-colors duration-100 hover:bg-ink hover:text-paper disabled:border-rule-strong disabled:text-muted disabled:hover:bg-paper disabled:hover:text-muted"
        >
          Submit job
        </button>
      </div>
    </form>
  );
}
