// The vimrc text area (§4 Mappings and the vimrc, §7 `vimrc`, F10): the text in force (the
// shipped one when nothing is stored), its bad lines listed live with their numbers by the
// editor's own parser, Save and Restore. Saving with bad lines is allowed: §4 says they are
// listed and skipped and the good lines still apply. Every open editor re-applies the vimrc on
// the write (src/editor/controller.ts), this tab's or another's.
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { formatVimrcError, parseVimrc, SHIPPED_VIMRC } from '@/editor/vimrc';
import { writeSettings } from '@/store/settings';
import { vimrcToStore } from './model';

export function VimrcField({ stored }: { stored: string | undefined }) {
  const storedText = stored ?? SHIPPED_VIMRC;
  const [draft, setDraft] = useState(storedText);
  const [seen, setSeen] = useState(storedText);
  const [status, setStatus] = useState('');
  // A write from elsewhere (another tab, an import) replaces the text shown.
  if (seen !== storedText) {
    setSeen(storedText);
    setDraft(storedText);
  }
  const errors = useMemo(() => parseVimrc(draft).errors, [draft]);

  const save = (): void => {
    writeSettings({ vimrc: vimrcToStore(draft) });
    setStatus(
      errors.length === 0
        ? 'vimrc saved'
        : `vimrc saved; ${String(errors.length)} bad ${errors.length === 1 ? 'line' : 'lines'} skipped`,
    );
  };
  const restore = (): void => {
    writeSettings({ vimrc: undefined });
    setDraft(SHIPPED_VIMRC);
    setStatus('shipped vimrc restored');
  };

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="vimrc" className="text-sm font-medium">
        vimrc
      </label>
      <p id="vimrc-help" className="text-xs text-muted-foreground">
        The <code>map</code> family, <code>unmap</code>,{' '}
        <code>set &lt;option&gt;</code>,{' '}
        <code>let mapleader = &quot;&lt;key&gt;&quot;</code> and{' '}
        <code>&quot;</code> comments. A bad line is listed with its number and
        skipped; the others still apply.
      </p>
      <Textarea
        id="vimrc"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        rows={18}
        spellCheck={false}
        autoCapitalize="off"
        autoComplete="off"
        aria-describedby="vimrc-help vimrc-problems"
        aria-invalid={errors.length > 0}
        className="font-mono text-xs md:text-xs"
      />
      <div id="vimrc-problems" className="text-xs">
        {errors.length === 0 ? (
          <p className="text-muted-foreground">No bad lines.</p>
        ) : (
          <ul aria-label="vimrc problems" className="text-destructive">
            {errors.map((error) => (
              <li key={error.line}>{formatVimrcError(error)}</li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button onClick={save} disabled={draft === storedText}>
          Save vimrc
        </Button>
        <Button
          variant="outline"
          onClick={restore}
          disabled={stored === undefined && draft === SHIPPED_VIMRC}
        >
          Restore the shipped vimrc
        </Button>
      </div>
      <p role="status" aria-label="vimrc status" className="min-h-5 text-sm">
        {status}
      </p>
    </div>
  );
}
