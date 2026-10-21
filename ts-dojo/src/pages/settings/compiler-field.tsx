// The compiler defaults (§7 `compilerDefaults`, F10): a JSON object of options merged over the
// §2 defaults for `/repl` buffers (exercises keep §2 and their own overrides, so a verdict never
// depends on a local setting). Save checks the shape here, then asks TypeScript itself through
// the ts-ls worker (`checkCompilerOptions`); only options it accepts are written. Blank text or
// Clear removes the key. An open `/repl` re-opens its project on the write.
import { useRef, useState } from 'react';
import { getCompiler } from '@/app/compiler';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  DEFAULT_COMPILER_OPTIONS,
  type CompilerOptionsJson,
} from '@/protocol/ts-ls';
import { APP_OWNED_COMPILER_OPTIONS, writeSettings } from '@/store/settings';
import { compilerDefaultsText, parseCompilerDefaultsText } from './model';

const DEFAULTS_TEXT = JSON.stringify(DEFAULT_COMPILER_OPTIONS, null, 2);

export function CompilerDefaultsField({
  stored,
}: {
  stored: CompilerOptionsJson | undefined;
}) {
  const storedText = compilerDefaultsText(stored);
  const [draft, setDraft] = useState(storedText);
  const [seen, setSeen] = useState(storedText);
  const [problems, setProblems] = useState<string[]>([]);
  const [status, setStatus] = useState('');
  const [checking, setChecking] = useState(false);
  // Only the latest Save's check may write or report.
  const attempt = useRef(0);
  if (seen !== storedText) {
    setSeen(storedText);
    setDraft(storedText);
  }

  const save = async (): Promise<void> => {
    attempt.current += 1;
    const mine = attempt.current;
    const parsed = parseCompilerDefaultsText(draft);
    if (!parsed.ok) {
      setProblems(parsed.errors);
      setStatus('compiler defaults not saved');
      return;
    }
    if (parsed.value === undefined) {
      writeSettings({ compilerDefaults: undefined });
      setProblems([]);
      setStatus('compiler defaults cleared');
      return;
    }
    setChecking(true);
    setProblems([]);
    setStatus('checking with TypeScript…');
    let errors: string[];
    try {
      errors = await getCompiler().checkCompilerOptions(parsed.value);
    } catch (error) {
      errors = [
        `TypeScript could not check them (${error instanceof Error ? error.message : String(error)}); try again`,
      ];
    }
    if (mine !== attempt.current) return;
    setChecking(false);
    if (errors.length > 0) {
      setProblems(errors);
      setStatus('compiler defaults not saved');
      return;
    }
    writeSettings({ compilerDefaults: parsed.value });
    setStatus('compiler defaults saved');
  };
  const clear = (): void => {
    attempt.current += 1;
    writeSettings({ compilerDefaults: undefined });
    setDraft('');
    setProblems([]);
    setChecking(false);
    setStatus('compiler defaults cleared');
  };

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="compiler-defaults" className="text-sm font-medium">
        Compiler defaults
      </label>
      <p id="compiler-defaults-help" className="text-xs text-muted-foreground">
        Options for the <code>/repl</code> scratch buffers, written like a
        tsconfig&apos;s <code>compilerOptions</code> and merged over the
        defaults below. Exercises keep their own options.{' '}
        {APP_OWNED_COMPILER_OPTIONS.map((key, index) => (
          <span key={key}>
            {index > 0 &&
              (index === APP_OWNED_COMPILER_OPTIONS.length - 1
                ? ' and '
                : ', ')}
            <code>{key}</code>
          </span>
        ))}{' '}
        are fixed by ts-dojo.
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        <Textarea
          id="compiler-defaults"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          rows={10}
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          placeholder={'e.g. { "noUncheckedIndexedAccess": true }'}
          aria-describedby="compiler-defaults-help compiler-defaults-problems"
          aria-invalid={problems.length > 0}
          className="font-mono text-xs md:text-xs"
        />
        <figure className="flex flex-col gap-1">
          <figcaption className="text-xs text-muted-foreground">
            The defaults (§2)
          </figcaption>
          <pre
            aria-label="Default compiler options"
            className="overflow-x-auto rounded-lg bg-muted px-2.5 py-2 font-mono text-xs"
          >
            {DEFAULTS_TEXT}
          </pre>
        </figure>
      </div>
      <div id="compiler-defaults-problems" className="text-xs">
        {problems.length > 0 && (
          <ul
            aria-label="compiler defaults problems"
            className="text-destructive"
          >
            {problems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() => void save()}
          disabled={checking || draft === storedText}
        >
          Save compiler defaults
        </Button>
        <Button
          variant="outline"
          onClick={clear}
          disabled={stored === undefined && draft === ''}
        >
          Clear
        </Button>
      </div>
      <p
        role="status"
        aria-label="compiler defaults status"
        className="min-h-5 text-sm"
      >
        {status}
      </p>
    </div>
  );
}
