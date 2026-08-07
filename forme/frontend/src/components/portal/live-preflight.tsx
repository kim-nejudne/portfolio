'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { RegistrationTarget } from '@/components/furniture/marks';
import { SeverityMark } from '@/components/furniture/status-mark';
import { subscribeToPreflight } from '@/lib/api/live';
import { PREFLIGHT_CHECK_COUNT } from '@forme/domain';
import type { PreflightCheck } from '@forme/domain';

interface Stream {
  checks: readonly PreflightCheck[];
  total: number;
  running: boolean;
  error: string | null;
}

/**
 * The live preflight panel, shown while the worker is analysing.
 *
 * The checks take very different amounts of time — pdfinfo returns instantly,
 * ghostscript's ink coverage does not — so they arrive one at a time over the
 * socket rather than as a finished report. No timer in this component: the
 * pacing is the worker's, and what you see is what it actually measured, when
 * it measured it.
 *
 * On completion it refreshes the server-rendered page, which then owns the
 * report. This panel is only ever the live view of work in progress.
 */
export function LivePreflight({ reference }: { reference: string }) {
  const router = useRouter();
  const [stream, setStream] = useState<Stream>({
    checks: [],
    total: PREFLIGHT_CHECK_COUNT,
    running: true,
    error: null,
  });

  useEffect(() => {
    return subscribeToPreflight(reference, {
      onCheck: (check, index, total) =>
        setStream((current) => ({
          // Guard against a reconnect replaying a check already shown.
          checks: current.checks.some((existing) => existing.id === check.id)
            ? current.checks
            : [...current.checks, check],
          total,
          running: index + 1 < total,
          error: null,
        })),
      onDone: () => {
        setStream((current) => ({ ...current, running: false }));
        // The server render is the authority once the report exists; this hands
        // ownership back rather than keeping a second copy in client state.
        router.refresh();
      },
      onError: (message) => setStream((current) => ({ ...current, error: message })),
    });
  }, [reference, router]);

  const passes = stream.checks.filter((check) => check.severity === 'PASS').length;
  const warns = stream.checks.filter((check) => check.severity === 'WARN').length;
  const fails = stream.checks.filter((check) => check.severity === 'FAIL').length;

  return (
    <section
      aria-labelledby="live-preflight-heading"
      className="border-2 border-ink"
      data-testid="live-preflight"
    >
      <div className="flex items-center justify-between border-b border-rule px-3 py-2">
        <h2 id="live-preflight-heading" className="label-caps text-ink">
          Preflight running
        </h2>
        <span className="num text-2xs text-muted">
          {stream.checks.length} / {stream.total} CHECKS
        </span>
      </div>

      <p aria-live="polite" className="sr-only" data-testid="live-preflight-status">
        {stream.error
          ? stream.error
          : stream.running
            ? `Check ${stream.checks.length} of ${stream.total} complete.`
            : `Preflight complete. ${passes} passed, ${warns} warnings, ${fails} failures.`}
      </p>

      {stream.error ? (
        <p className="px-3 py-3 text-xs text-magenta">{stream.error}</p>
      ) : (
        <ol data-testid="live-preflight-stream">
          {stream.checks.map((check) => (
            <li
              key={check.id}
              className="anim-land flex items-center gap-3 border-b border-rule px-3 py-1.5 last:border-b-0"
            >
              <SeverityMark severity={check.severity} />
              <span className="flex-1 truncate text-xs" title={check.finding}>
                {check.label}
              </span>
              <span className="num hidden text-2xs text-muted md:inline">{check.measured}</span>
            </li>
          ))}
          {stream.running ? (
            <li className="flex items-center gap-3 border-b border-rule px-3 py-1.5 last:border-b-0">
              <RegistrationTarget size={12} spinning />
              <span className="num text-2xs text-muted">
                RUNNING CHECK {Math.min(stream.checks.length + 1, stream.total)} OF {stream.total}
              </span>
            </li>
          ) : null}
        </ol>
      )}
    </section>
  );
}
