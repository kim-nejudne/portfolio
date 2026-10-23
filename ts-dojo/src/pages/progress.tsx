// `/progress` (spec §6, §7): the overview, export, import and reset.
//
// - Counts (§12 F9 "per-module counts, hints used and solutions viewed"): the course totals,
//   then one row per module and one per lesson under it (store/summary.ts).
// - Export: the button, `:export` from the palette on this page (the page's own command) or
//   from any editor (§7); the notice names the file.
// - Import: a file is read and checked (store/import.ts), the preview dialog shows what each
//   category would gain, and Apply merges it; a file that cannot be read says why.
// - Reset: one lesson or one module from its row, everything from the button, each behind its
//   confirmation (progress/reset-dialog.tsx); one exercise's files is `:reset` on the lesson
//   page (F8).
// - Orphaned (§7): rows of lessons and exercises the content no longer has, listed by id.
// - The content version this build records (§7 `contentVersion`), shortened.
import { useEffect, useRef, useState } from 'react';
import { exportedMessage } from '@/app/export-progress';
import { useAppActions } from '@/app/app-actions';
import { getCompiler } from '@/app/compiler';
import { setPageActions } from '@/app/page-actions';
import { Button } from '@/components/ui/button';
import { CONTENT_VERSION, registry } from '@/content/registry';
import { getDb } from '@/store/db';
import {
  applyImport,
  parseImportFile,
  planImport,
  type ImportPlan,
} from '@/store/import';
import { resetEverything, resetLesson, resetModule } from '@/store/reset';
import { browserStorage, readSettings } from '@/store/settings';
import { summarize, type Counts } from '@/store/summary';
import { useLiveQuery } from '@/store/use-live-query';
import { OptionalTag, STATE_LABEL } from './module';
import { checkImportedCompilerDefaults } from './progress/check-settings';
import { ImportDialog } from './progress/import-dialog';
import { ResetDialog, type ResetRequest } from './progress/reset-dialog';

function importOptions() {
  return {
    renames: registry.renames,
    contentVersion: CONTENT_VERSION,
    settings: readSettings(browserStorage()),
  };
}

export function ProgressPage() {
  const actions = useAppActions();
  const rows = useLiveQuery('progress', async () => {
    const db = getDb();
    const [lessons, exercises] = await Promise.all([
      db.lessons.toArray(),
      db.exercises.toArray(),
    ]);
    return { lessons, exercises };
  });
  const summary =
    rows === undefined
      ? null
      : summarize(registry, rows.lessons, rows.exercises);
  const [notice, setNotice] = useState<string | null>(null);
  const [importing, setImporting] = useState<{
    name: string;
    plan: ImportPlan;
    /** Why the file's compiler defaults were left out (F10), or []. */
    refused: string[];
  } | null>(null);
  const [reset, setReset] = useState<ResetRequest | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const exportNow = (): void => {
    void actions
      .exportProgress()
      .then((name) => setNotice(exportedMessage(name)));
  };
  const latestExport = useRef(exportNow);
  useEffect(() => {
    latestExport.current = exportNow;
  });
  // `:export` from the palette on this page: the page's own command, so the notice shows here.
  useEffect(
    () =>
      setPageActions({
        ex: (action) => {
          if (action.type !== 'export') return false;
          latestExport.current();
          return true;
        },
      }),
    [],
  );

  const readFile = async (file: File): Promise<void> => {
    const parsed = parseImportFile(await file.text());
    if (!parsed.ok) {
      setNotice(`cannot import ${file.name}: ${parsed.error}`);
      return;
    }
    // F10: the file's compiler defaults pass TypeScript's check, as a Save on /settings does.
    const checked = await checkImportedCompilerDefaults(
      parsed.file,
      importOptions().settings,
      (options) => getCompiler().checkCompilerOptions(options),
    );
    const plan = await planImport(getDb(), checked.file, importOptions());
    setImporting({ name: file.name, plan, refused: checked.refused });
  };

  const apply = async (name: string, plan: ImportPlan): Promise<void> => {
    setImporting(null);
    await applyImport(getDb(), plan.file, importOptions());
    setNotice(`imported ${name}`);
  };

  const confirmReset = async (request: ResetRequest): Promise<void> => {
    setReset(null);
    const db = getDb();
    if (request.scope === 'lesson') {
      await resetLesson(db, request.id);
      setNotice(`reset the lesson ${request.title}`);
    } else if (request.scope === 'module') {
      await resetModule(db, request.lessons);
      setNotice(`reset the module ${request.title}`);
    } else {
      await resetEverything(db);
      setNotice('reset everything');
    }
  };

  return (
    <section className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-6 py-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Progress</h1>
        {summary !== null && (
          <p className="text-sm text-muted-foreground" data-field="totals">
            {summary.totals.lessonsComplete} of {summary.totals.lessonsTotal}{' '}
            lessons complete · {countsText(summary.totals)}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" onClick={exportNow}>
          Export progress
        </Button>
        <Button variant="outline" onClick={() => fileInput.current?.click()}>
          Import progress…
        </Button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          aria-label="Progress file to import"
          className="sr-only"
          tabIndex={-1}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file !== undefined) void readFile(file);
          }}
        />
        <Button
          variant="destructive"
          className="ml-auto"
          onClick={() => setReset({ scope: 'everything' })}
        >
          Reset everything…
        </Button>
      </div>
      <p role="status" aria-label="progress notice" className="min-h-5 text-sm">
        {notice}
      </p>

      {summary !== null && (
        <table className="w-full text-sm" aria-label="Progress by module">
          <thead className="text-left text-xs text-muted-foreground">
            <tr>
              <th scope="col" className="py-1 font-normal">
                Module / lesson
              </th>
              <th scope="col" className="py-1 font-normal">
                Lessons
              </th>
              <th scope="col" className="py-1 font-normal">
                Exercises passed
              </th>
              <th scope="col" className="py-1 font-normal">
                Hints used
              </th>
              <th scope="col" className="py-1 font-normal">
                Solutions viewed
              </th>
              <th scope="col" className="py-1 font-normal">
                <span className="sr-only">Reset</span>
              </th>
            </tr>
          </thead>
          {summary.modules.map((module) => (
            <tbody key={module.id} className="border-t">
              <tr data-module={module.id} data-state={module.state}>
                <th scope="row" className="py-1.5 text-left font-medium">
                  {module.title}
                </th>
                <td data-field="lessons">
                  {module.lessonsComplete} of {module.lessonsTotal}
                </td>
                <CountCells counts={module} />
                <td className="text-right">
                  <Button
                    size="xs"
                    variant="ghost"
                    aria-label={`Reset the module ${module.title}`}
                    onClick={() =>
                      setReset({
                        scope: 'module',
                        id: module.id,
                        title: module.title,
                        lessons: module.lessons.map((l) => l.id),
                      })
                    }
                  >
                    Reset
                  </Button>
                </td>
              </tr>
              {module.lessons.map((lesson) => (
                <tr
                  key={lesson.id}
                  data-lesson={lesson.id}
                  data-state={lesson.state}
                  className="text-muted-foreground"
                >
                  <th scope="row" className="py-1 pl-4 text-left font-normal">
                    {lesson.title}
                    {lesson.optional && <OptionalTag />}
                  </th>
                  <td data-field="state">{STATE_LABEL[lesson.state]}</td>
                  <CountCells counts={lesson} />
                  <td className="text-right">
                    <Button
                      size="xs"
                      variant="ghost"
                      aria-label={`Reset the lesson ${lesson.title}`}
                      onClick={() =>
                        setReset({
                          scope: 'lesson',
                          id: lesson.id,
                          title: lesson.title,
                        })
                      }
                    >
                      Reset
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      )}

      {summary !== null &&
        (summary.orphans.lessons.length > 0 ||
          summary.orphans.exercises.length > 0) && (
          <section aria-labelledby="orphaned" className="flex flex-col gap-1">
            <h2 id="orphaned" className="text-sm font-semibold">
              Orphaned
            </h2>
            <p className="text-xs text-muted-foreground">
              Progress kept for lessons and exercises this content no longer
              has.
            </p>
            <ul className="font-mono text-xs" data-field="orphans">
              {[...summary.orphans.lessons, ...summary.orphans.exercises].map(
                (id) => (
                  <li key={id} data-orphan={id}>
                    {id}
                  </li>
                ),
              )}
            </ul>
          </section>
        )}

      <p className="text-xs text-muted-foreground">
        Content version{' '}
        <span className="font-mono" data-field="content-version">
          {CONTENT_VERSION.slice(0, 12)}
        </span>
      </p>

      <ImportDialog
        name={importing?.name ?? ''}
        plan={importing?.plan ?? null}
        refused={importing?.refused ?? []}
        onCancel={() => {
          setImporting(null);
          setNotice('import cancelled');
        }}
        onApply={(plan) => {
          if (importing !== null) void apply(importing.name, plan);
        }}
      />
      <ResetDialog
        request={reset}
        onCancel={() => setReset(null)}
        onConfirm={(request) => void confirmReset(request)}
      />
    </section>
  );
}

function plural(count: number, one: string, many: string): string {
  return `${String(count)} ${count === 1 ? one : many}`;
}

function countsText(counts: Counts): string {
  return [
    `${String(counts.exercisesPassed)} of ${String(counts.exercisesTotal)} exercises passed`,
    plural(counts.hintsUsed, 'hint used', 'hints used'),
    plural(counts.solutionsViewed, 'solution viewed', 'solutions viewed'),
  ].join(' · ');
}

function CountCells({ counts }: { counts: Counts }) {
  return (
    <>
      <td data-field="exercises">
        {counts.exercisesPassed} of {counts.exercisesTotal}
      </td>
      <td data-field="hints">{counts.hintsUsed}</td>
      <td data-field="solutions">{counts.solutionsViewed}</td>
    </>
  );
}
