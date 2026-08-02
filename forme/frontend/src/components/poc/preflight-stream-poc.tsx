'use client';

import { useEffect, useState } from 'react';
import { subscribeToPreflight } from '@/lib/api/preflight';
import type { PreflightCheck } from '@/lib/types';

export function PreflightStreamPoc({ jobId }: { jobId: string }) {
  const [checks, setChecks] = useState<readonly PreflightCheck[]>([]);

  useEffect(() => {
    setChecks([]);
    const unsubscribe = subscribeToPreflight(jobId, (check) => {
      setChecks((current) => [...current, check]);
    });
    return unsubscribe;
  }, [jobId]);

  return (
    <div className="mt-4">
      <ol className="border border-rule">
        {checks.map((check) => (
          <li key={check.id} className="flex gap-4 border-b border-rule px-3 py-2 text-sm">
            <span className="num w-12">{check.severity}</span>
            <span className="flex-1">{check.label}</span>
            <span className="num text-muted">{check.measured}</span>
          </li>
        ))}
      </ol>
      <p aria-live="polite" className="num mt-2 text-xs text-muted">
        {checks.length} checks reported
      </p>
    </div>
  );
}
