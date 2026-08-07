'use client';

import { useRef, useState } from 'react';
import { createJobAction } from '@/lib/actions/jobs';
import { PREFLIGHT_CHECK_COUNT } from '@forme/domain';
import type { QuoteInput } from '@forme/domain';

/**
 * The upload. The drop zone is decoration over a real file input.
 *
 * The scaffold streamed preflight checks here the moment a file was chosen,
 * looking them up by filename. Against a real API there is nothing to stream
 * yet — the job does not exist, the artwork has not been sent, and no worker
 * has measured anything. The live stream now runs on the job page, where there
 * is a real report being written. This panel states what will happen and stops
 * there, which is the honest version of the same moment.
 */
export function IntakePanel({ input, description }: { input: QuoteInput; description: string }) {
  const [file, setFile] = useState<{ name: string; bytes: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function take(files: FileList | null) {
    const next = files && files.length > 0 ? files[0] : null;
    setFile(next ? { name: next.name, bytes: next.size } : null);
  }


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
          Preflight runs once the job is submitted.
        </p>
      </div>

      <div className="border-t border-rule">
        <div className="flex items-center justify-between px-3 py-2">
          <h3 className="label-caps">Preflight</h3>
          <span className="num text-2xs text-muted">
            {file === null ? 'WAITING FOR FILE' : `${PREFLIGHT_CHECK_COUNT} CHECKS QUEUED`}
          </span>
        </div>

        <p aria-live="polite" className="sr-only" data-testid="preflight-live">
          {file === null
            ? ''
            : `${file.name} ready. ${PREFLIGHT_CHECK_COUNT} checks will run once the job is submitted.`}
        </p>

        <p className="px-3 pb-3 text-xs text-muted" data-testid="empty-state">
          {file === null
            ? `${PREFLIGHT_CHECK_COUNT} checks run against the artwork specification — trim, bleed, safety margin, embedded fonts, effective resolution, colour space, ink coverage and page count.`
            : 'Submitting sends the artwork to the press and starts preflight. The checks land one at a time on the job page, as each one finishes.'}
        </p>

        <p className="border-t border-rule px-3 py-2 text-xs text-muted">
          Failures do not stop you submitting. They stop the job going to proof until prepress
          overrides each one with a written reason.
        </p>
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
