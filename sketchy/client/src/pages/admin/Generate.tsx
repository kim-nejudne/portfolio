// Word generation in the admin (F83; spec: Admin, Word generation). The panel starts a generation
// (a title and a number of words for a new category, or "Generate more" on a category's page),
// shows its progress while the server's background job runs, and lists the drafts waiting for
// review. The review page lets the admin untick words, edit a word, its level and alternates, and
// change the emoji, then Save: a new category is saved hidden, "more" adds to its category.
// Drafts live in the server's memory only. Lazy, with `/admin`.

import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from 'react';
import {
  CATEGORY_EMOJI_MAX,
  CATEGORY_TITLE_MAX,
  GENERATE_COUNT_DEFAULT,
  GENERATE_COUNT_MAX,
  GENERATE_COUNT_MIN,
  GENERATE_POLL_MS,
  formatUsd,
  WORD_FORM_MAX,
} from '../../../../shared/constants.js';
import type {
  AdminCategory,
  AdminDraftSaveResponse,
  AdminDraftWord,
  AdminGenerateStatus,
  AdminGenerationJob,
  AdminGenerationSpend,
  WordLevel,
} from '../../../../shared/types.js';
import { SketchButton } from '../../components/sketch/SketchButton.js';
import {
  discardDraft,
  generationStatus,
  getGeneration,
  saveDraft,
  startGeneration,
} from './adminApi.js';
import {
  Card,
  CHECKBOX,
  DEAD,
  dead,
  ErrorLine,
  Field,
  INPUT,
  LEVELS,
  LINK_BUTTON,
  parseAlts,
  useAction,
  useFocusInvalid,
} from './adminUi.js';

export const GENERATE_COPY = {
  newHeading: 'Generate a category',
  moreHeading: 'Generate more',
  newHint: 'Claude drafts the words; you review them before anything is saved.',
  moreHint: 'Claude drafts new words that avoid this category’s words; you review them first.',
  fake: 'Development: the fake generator writes the words. Nothing is spent.',
  title: 'Title',
  count: 'Number of words',
  countHint: `${GENERATE_COUNT_MIN} to ${GENERATE_COUNT_MAX}.`,
  generate: (n: number) => `Generate ${n} words`,
  generateOff: 'Generate',
  starting: 'Starting…',
  stage: { writing: 'Writing words…', checking: 'Checking words…' } as const,
  runningFor: (title: string) => `Generating for “${title}”`,
  ready: (title: string, kept: number, asked: number) =>
    `${title}: ${kept} of ${asked} words ready`,
  review: 'Review',
  reviewLabel: (title: string) => `Review the draft for ${title}`,
  discard: 'Discard',
  discardLabel: (title: string) => `Discard the draft for ${title}`,
  failed: (title: string) => `${title}: generation failed.`,
  dismiss: 'Dismiss',
  dismissLabel: (title: string) => `Dismiss the failed generation for ${title}`,
  busyElsewhere: 'A generation is running. One at a time: wait for it to finish.',
  confirmDiscardRow: (title: string) => `Discard the draft for ${title}? Its words are lost.`,
  tickAll: 'Tick all',
  untickAll: 'Untick all',
  tickOne: 'Tick at least one word to save.',
  drafts: 'Drafts to review',
  // The review page
  back: '← Back',
  reviewHeading: (title: string) => `Review: ${title}`,
  newSaveHint: 'Saved hidden, so players don’t see it until you unhide it on its page.',
  moreSaveHint: (title: string) => `The ticked words are added to ${title}.`,
  emoji: 'Emoji',
  ticked: (n: number, of: number) => `${n} of ${of} ticked`,
  keep: (word: string) => `Keep ${word || 'this word'}`,
  word: (n: number) => `Word ${n}`,
  level: (word: string) => `Level of ${word || 'this word'}`,
  alts: (word: string) => `Alternates of ${word || 'this word'}, comma separated`,
  altsPlaceholder: 'alternates, comma separated',
  save: (n: number) => (n === 1 ? 'Save 1 word' : `Save ${n} words`),
  saving: 'Saving…',
  confirmDiscard: 'Discard this draft? Its words are lost.',
  confirm: 'Discard',
  cancel: 'Cancel',
  notReady: 'This draft is not ready yet.',
  unsavedNote: 'Back keeps the draft on the server; edits made here are not kept.',
  loading: 'Loading…',
  // Spend (F84)
  spendLabel: 'Generation spend',
  month: 'This month',
  monthOfCap: (cap: string) => `of the ${cap} cap (UTC month)`,
  allTime: 'All time',
  allTimeCount: (n: number) => (n === 1 ? '1 generation' : `${n} generations`),
  last: 'Last generation',
  none: 'None yet',
  history: (n: number) => `History (${n})`,
  historyNewest: (shown: number, total: number) => `The newest ${shown} of ${total}.`,
  historyKept: (kept: number, asked: number) => `${kept} of ${asked} kept`,
  historyFailed: 'failed',
  historyMore: 'more words',
} as const;

/** "Added 30 words. Skipped 2 duplicates." */
export function draftSummary({ added, duplicates }: AdminDraftSaveResponse): string {
  const parts = [`Added ${added} ${added === 1 ? 'word' : 'words'}.`];
  if (duplicates > 0) {
    parts.push(`Skipped ${duplicates} ${duplicates === 1 ? 'duplicate' : 'duplicates'}.`);
  }
  return parts.join(' ');
}

// ---------- The panel ----------

/** A text button centred on its row (`LINK_BUTTON` is aligned to the start). */
const ROW_LINK = LINK_BUTTON.replace('self-start', 'self-center');
/** The checkbox, centred in its 44 px label rather than nudged down to sit by a text line. */
const ROW_CHECKBOX = CHECKBOX.replace('mt-1 ', '');

// ---------- Spend (F84) ----------

/** When a generation ended, in the admin's own time zone, named (the cap counts UTC months). */
const when = (ms: number) =>
  new Date(ms).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  });

/** One tile: a label, an amount, and a line under it. */
function SpendTile({ label, amount, note }: { label: string; amount: string; note: string }) {
  return (
    <div className="grid content-start gap-1 rounded-[3px] border-2 border-dashed border-soft px-3 py-2">
      <dt className="text-base leading-snug text-soft">{label}</dt>
      <dd className="font-num text-[26px] leading-tight font-black">{amount}</dd>
      <dd className="text-base leading-snug break-words text-soft">{note}</dd>
    </div>
  );
}

/** This month against the cap, all time, and the last generation. */
export function SpendTiles({ spend }: { spend: AdminGenerationSpend }) {
  const { last } = spend;
  return (
    <dl role="group" aria-label={GENERATE_COPY.spendLabel} className="grid gap-3 sm:grid-cols-3">
      <SpendTile
        label={GENERATE_COPY.month}
        amount={formatUsd(spend.monthUsd)}
        note={GENERATE_COPY.monthOfCap(formatUsd(spend.capUsd))}
      />
      <SpendTile
        label={GENERATE_COPY.allTime}
        amount={formatUsd(spend.allTimeUsd)}
        note={GENERATE_COPY.allTimeCount(spend.total)}
      />
      <SpendTile
        label={GENERATE_COPY.last}
        amount={last ? formatUsd(last.costUsd) : '—'}
        note={last ? last.title : GENERATE_COPY.none}
      />
    </dl>
  );
}

/** The newest generations, folded away until opened. */
export function SpendHistory({ spend }: { spend: AdminGenerationSpend }) {
  if (spend.total === 0) return null;
  return (
    <details className="border-t-2 border-dashed border-soft pt-3">
      <summary className="min-h-11 cursor-pointer py-2 text-[22px] leading-tight outline-none focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-pen">
        {GENERATE_COPY.history(spend.total)}
      </summary>
      {spend.total > spend.history.length && (
        <p className="text-base leading-snug text-soft">
          {GENERATE_COPY.historyNewest(spend.history.length, spend.total)}
        </p>
      )}
      <ul className="mt-2 grid gap-2">
        {spend.history.map((entry) => (
          <li
            key={entry.id}
            className="grid gap-x-3 border-b-2 border-dashed border-soft pb-2 sm:grid-cols-[minmax(0,1fr)_auto]"
          >
            <span className="text-lg leading-snug break-words">
              {entry.title}
              {entry.kind === 'more' && (
                <span className="text-soft"> · {GENERATE_COPY.historyMore}</span>
              )}
            </span>
            <span className="font-num font-black sm:text-right">{formatUsd(entry.costUsd)}</span>
            <span className="text-base leading-snug text-soft">
              {when(entry.endedAt)} ·{' '}
              {entry.outcome === 'failed' ? (
                <span className="text-red">{GENERATE_COPY.historyFailed}</span>
              ) : (
                GENERATE_COPY.historyKept(entry.kept, entry.count)
              )}
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}

/** What the panel's live region says about a job. */
export function jobAnnouncement(job: AdminGenerationJob): string {
  if (job.status === 'running') {
    return `${GENERATE_COPY.runningFor(job.title)}: ${
      job.stage ? GENERATE_COPY.stage[job.stage] : GENERATE_COPY.starting
    }`;
  }
  if (job.status === 'failed') return `${GENERATE_COPY.failed(job.title)} ${job.error ?? ''}`;
  return GENERATE_COPY.ready(job.title, job.draft?.words.length ?? 0, job.count);
}

/** The jobs this panel shows: all of them on the list, this category's on its page. */
const mine = (jobs: readonly AdminGenerationJob[], categoryId: string | null) =>
  categoryId === null ? [...jobs] : jobs.filter((j) => j.categoryId === categoryId);

/** One running, ready or failed job, with what can be done about it. */
export function JobRow({
  job,
  onReview,
  onDiscard,
  busy,
}: {
  job: AdminGenerationJob;
  onReview: (id: string) => void;
  onDiscard: (id: string) => void;
  busy: boolean;
}) {
  if (job.status === 'running') {
    return (
      <li className="grid gap-1">
        <span className="text-xl leading-snug">{GENERATE_COPY.runningFor(job.title)}</span>
        <span className="text-lg text-soft">
          {job.stage ? GENERATE_COPY.stage[job.stage] : GENERATE_COPY.starting}
        </span>
      </li>
    );
  }
  if (job.status === 'failed') {
    return (
      <li className="grid gap-1">
        <span className="text-xl leading-snug">
          <span aria-hidden className="text-red">
            ✗{' '}
          </span>
          {GENERATE_COPY.failed(job.title)} {job.error}
        </span>
        <button
          type="button"
          className={`${LINK_BUTTON} ${DEAD}`}
          aria-label={GENERATE_COPY.dismissLabel(job.title)}
          {...dead(busy)}
          onClick={() => !busy && onDiscard(job.id)}
        >
          {GENERATE_COPY.dismiss}
        </button>
      </li>
    );
  }
  return <ReadyRow job={job} onReview={onReview} onDiscard={onDiscard} busy={busy} />;
}

/** A ready draft: Review, or Discard after a confirm, since the draft cost a generation. */
function ReadyRow({
  job,
  onReview,
  onDiscard,
  busy,
}: {
  job: AdminGenerationJob;
  onReview: (id: string) => void;
  onDiscard: (id: string) => void;
  busy: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const discardRef = useRef<HTMLButtonElement>(null);
  const cancelled = useRef(false);
  useEffect(() => {
    if (confirming || !cancelled.current) return;
    cancelled.current = false;
    discardRef.current?.focus();
  }, [confirming]);
  const kept = job.draft?.words.length ?? 0;
  if (confirming) {
    return (
      <li
        className="grid gap-2"
        role="group"
        aria-label={GENERATE_COPY.confirmDiscardRow(job.title)}
      >
        <p className="text-xl leading-snug">{GENERATE_COPY.confirmDiscardRow(job.title)}</p>
        <div className="flex flex-wrap gap-3">
          <SketchButton
            variant="armed"
            autoFocus
            {...dead(busy)}
            className={DEAD}
            onClick={() => !busy && onDiscard(job.id)}
          >
            {GENERATE_COPY.confirm}
          </SketchButton>
          <SketchButton
            variant="ghost"
            {...dead(busy)}
            className={DEAD}
            onClick={() => {
              if (busy) return;
              cancelled.current = true;
              setConfirming(false);
            }}
          >
            {GENERATE_COPY.cancel}
          </SketchButton>
        </div>
      </li>
    );
  }
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span className="min-w-0 flex-1 text-xl leading-snug break-words">
        {job.draft?.emoji && <span aria-hidden>{job.draft.emoji} </span>}
        {GENERATE_COPY.ready(job.title, kept, job.count)}
      </span>
      <SketchButton
        variant="ghost"
        aria-label={GENERATE_COPY.reviewLabel(job.title)}
        onClick={() => onReview(job.id)}
      >
        {GENERATE_COPY.review}
      </SketchButton>
      <button
        ref={discardRef}
        type="button"
        className={`${ROW_LINK} ${DEAD}`}
        aria-label={GENERATE_COPY.discardLabel(job.title)}
        {...dead(busy)}
        onClick={() => !busy && setConfirming(true)}
      >
        {GENERATE_COPY.discard}
      </button>
    </li>
  );
}

/**
 * Start a generation and follow it. `categoryId` null: a new category from a title (on the list);
 * a category's id: "Generate more" for it (on its page). Polls while a job runs.
 */
export function GeneratePanel({
  categoryId,
  onReview,
  initial = null,
}: {
  categoryId: string | null;
  onReview: (id: string) => void;
  /** The status to show before the first answer (tests render with one). */
  initial?: AdminGenerateStatus | null;
}) {
  const [status, setStatus] = useState<AdminGenerateStatus | null>(initial);
  const [title, setTitle] = useState('');
  const [count, setCount] = useState(String(GENERATE_COUNT_DEFAULT));
  const load = useAction();
  const start = useAction();
  const remove = useAction();
  const formRef = useRef<HTMLFormElement>(null);
  useFocusInvalid(formRef, start.error);
  const uid = useId();
  const errorId = `${uid}-error`;
  const offId = `${uid}-off`;
  const busyId = `${uid}-busy`;
  const refusedId = `${uid}-refused`;
  const headingId = `${uid}-heading`;
  const headingRef = useRef<HTMLHeadingElement>(null);
  const runLoad = load.run;
  // Counts every answer to a status request, good or failed, so polling goes on after a blip.
  const [answers, setAnswers] = useState(0);

  const refresh = useCallback(() => {
    runLoad(
      generationStatus,
      (next) => {
        setStatus(next);
        setAnswers((a) => a + 1);
      },
      () => setAnswers((a) => a + 1),
    );
  }, [runLoad]);
  useEffect(refresh, [refresh]);

  const jobs = status ? mine(status.jobs, categoryId) : [];
  const anyRunning = status?.jobs.some((j) => j.status === 'running') ?? false;
  // While anything runs (here or elsewhere: one job at a time), ask again shortly, after every
  // answer, a failed one too.
  useEffect(() => {
    if (!anyRunning) return;
    const timer = setTimeout(refresh, GENERATE_POLL_MS);
    return () => clearTimeout(timer);
  }, [anyRunning, answers, refresh]);

  const off = status?.mode === 'off';
  // The monthly cap reached, or a history file that can't be read (F84).
  const refused = off ? null : (status?.spend.refused ?? null);
  const n = Number(count);
  const ready =
    status !== null &&
    !off &&
    refused === null &&
    !start.busy &&
    !anyRunning &&
    (categoryId !== null || title.trim() !== '') &&
    count.trim() !== '';

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!ready) return;
    const body = categoryId === null ? { title: title.trim(), count: n } : { categoryId, count: n };
    start.run(
      () => startGeneration(body),
      () => {
        setTitle('');
        refresh();
      },
    );
  }

  function discard(id: string) {
    remove.run(
      () => discardDraft(id),
      () => {
        refresh();
        // The row that had focus is gone.
        headingRef.current?.focus();
      },
    );
  }

  return (
    <Card labelledBy={headingId}>
      <form ref={formRef} onSubmit={submit} className="grid gap-4">
        <h3
          id={headingId}
          ref={headingRef}
          tabIndex={-1}
          className="text-[26px] leading-tight font-normal outline-none"
        >
          {categoryId === null ? GENERATE_COPY.newHeading : GENERATE_COPY.moreHeading}
        </h3>
        <p className="text-lg leading-snug text-soft">
          {categoryId === null ? GENERATE_COPY.newHint : GENERATE_COPY.moreHint}
        </p>
        {status?.mode === 'fake' && (
          <p className="text-base leading-snug text-soft">{GENERATE_COPY.fake}</p>
        )}
        {categoryId === null && status !== null && <SpendTiles spend={status.spend} />}
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(8rem,0.6fr)]">
          {categoryId === null && (
            <Field
              label={GENERATE_COPY.title}
              name="generate-title"
              maxLength={CATEGORY_TITLE_MAX}
              autoComplete="off"
              errorId={errorId}
              error={start.error?.field === 'title'}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          )}
          <Field
            label={GENERATE_COPY.count}
            hint={GENERATE_COPY.countHint}
            name="generate-count"
            type="number"
            inputMode="numeric"
            min={GENERATE_COUNT_MIN}
            max={GENERATE_COUNT_MAX}
            step={1}
            errorId={errorId}
            error={start.error?.field === 'count'}
            value={count}
            onChange={(event) => setCount(event.target.value)}
          />
        </div>
        <ErrorLine
          id={errorId}
          text={start.error?.text ?? (status === null ? load.error?.text : null) ?? null}
        />
        {anyRunning && (
          <p id={busyId} className="text-lg leading-snug text-ink">
            {GENERATE_COPY.busyElsewhere}
          </p>
        )}
        {off && (
          <p id={offId} className="text-lg leading-snug text-ink">
            {status.off}
          </p>
        )}
        {refused !== null && (
          <p id={refusedId} className="text-lg leading-snug text-ink">
            {refused}
          </p>
        )}
        <SketchButton
          type="submit"
          {...dead(!ready)}
          aria-describedby={
            off ? offId : refused !== null ? refusedId : anyRunning ? busyId : undefined
          }
          className={`justify-self-start ${DEAD}`}
        >
          {start.busy
            ? GENERATE_COPY.starting
            : off || !Number.isInteger(n)
              ? GENERATE_COPY.generateOff
              : GENERATE_COPY.generate(n)}
        </SketchButton>
      </form>
      {/* One live region for the whole panel, so a job's progress and end are announced. */}
      <p role="status" className="sr-only">
        {[jobs[0] ? jobAnnouncement(jobs[0]) : '', refused ?? ''].filter(Boolean).join(' ')}
      </p>
      {jobs.length > 0 && (
        <div className="grid gap-2 border-t-2 border-dashed border-soft pt-3">
          <h4 className="text-[22px] leading-tight font-normal">{GENERATE_COPY.drafts}</h4>
          <ul className="grid gap-3">
            {jobs.map((job) => (
              <JobRow
                key={job.id}
                job={job}
                onReview={onReview}
                onDiscard={discard}
                busy={remove.busy}
              />
            ))}
          </ul>
          <ErrorLine id={`${uid}-discard-error`} text={remove.error?.text ?? null} />
        </div>
      )}
      {categoryId === null && status !== null && <SpendHistory spend={status.spend} />}
    </Card>
  );
}

// ---------- Reviewing a draft ----------

interface DraftRow {
  key: number;
  ticked: boolean;
  word: string;
  level: WordLevel;
  alts: string;
}

export const toRows = (words: readonly AdminDraftWord[]): DraftRow[] =>
  words.map((w, key) => ({
    key,
    ticked: true,
    word: w.word,
    level: w.difficulty,
    alts: w.alt.join(', '),
  }));

/** The ticked rows as the save sends them, in order. */
export const tickedWords = (rows: readonly DraftRow[]): AdminDraftWord[] =>
  rows
    .filter((r) => r.ticked)
    .map((r) => ({ word: r.word.trim(), difficulty: r.level, alt: parseAlts(r.alts) }));

/**
 * The row and field a save's refusal names: `words.3.alt` counts ticked rows only, so it is mapped
 * back to the row's key.
 */
export function refusedRow(
  rows: readonly DraftRow[],
  field: string | undefined,
): { key: number; part: string } | null {
  const match = /^words\.(\d+)\.(\w+)/.exec(field ?? '');
  if (!match) return null;
  const row = rows.filter((r) => r.ticked)[Number(match[1])];
  return row ? { key: row.key, part: match[2]! } : null;
}

export function DraftWordRow({
  row,
  index,
  invalid,
  errorId,
  onChange,
}: {
  row: DraftRow;
  index: number;
  /** The field the save refused in this row: `word`, `difficulty` or `alt`. */
  invalid: string | null;
  errorId: string;
  onChange: (row: DraftRow) => void;
}) {
  // Left out of the save: the word is struck through in red pen (full contrast, still editable).
  const struck = row.ticked ? '' : 'line-through decoration-red decoration-2';
  const described = (part: string) => (invalid === part ? errorId : undefined);
  return (
    <li className="grid grid-cols-[2.75rem_minmax(0,1fr)] items-start gap-x-2 gap-y-2 border-b-2 border-dashed border-soft pb-4 lg:grid-cols-[2.75rem_minmax(0,1.2fr)_8.5rem_minmax(0,1.6fr)]">
      <label className="flex size-11 items-center justify-center">
        <input
          type="checkbox"
          className={ROW_CHECKBOX}
          checked={row.ticked}
          aria-label={GENERATE_COPY.keep(row.word)}
          onChange={(event) => onChange({ ...row, ticked: event.target.checked })}
        />
      </label>
      <input
        className={`${INPUT} ${struck}`}
        aria-label={GENERATE_COPY.word(index + 1)}
        maxLength={WORD_FORM_MAX}
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        aria-invalid={invalid === 'word' || undefined}
        aria-describedby={described('word')}
        value={row.word}
        onChange={(event) => onChange({ ...row, word: event.target.value })}
      />
      <select
        className={`${INPUT} col-start-2 lg:col-start-auto`}
        aria-label={GENERATE_COPY.level(row.word)}
        aria-invalid={invalid === 'difficulty' || undefined}
        aria-describedby={described('difficulty')}
        value={row.level}
        onChange={(event) => onChange({ ...row, level: Number(event.target.value) as WordLevel })}
      >
        {LEVELS.map((l) => (
          <option key={l.value} value={l.value}>
            {l.label}
          </option>
        ))}
      </select>
      <input
        className={`${INPUT} col-start-2 text-lg lg:col-start-auto`}
        aria-label={GENERATE_COPY.alts(row.word)}
        placeholder={GENERATE_COPY.altsPlaceholder}
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        aria-invalid={invalid === 'alt' || undefined}
        aria-describedby={described('alt')}
        value={row.alts}
        onChange={(event) => onChange({ ...row, alts: event.target.value })}
      />
    </li>
  );
}

/**
 * One draft to review and save. `onSaved` gets the saved category and a summary line; `onBack`
 * leaves without saving (the draft stays on the server).
 */
export function DraftReview({
  id,
  onSaved,
  onBack,
}: {
  id: string;
  onSaved: (category: AdminCategory, summary: string) => void;
  onBack: () => void;
}) {
  const [job, setJob] = useState<AdminGenerationJob | null>(null);
  const [rows, setRows] = useState<DraftRow[]>([]);
  const [title, setTitle] = useState('');
  const [emoji, setEmoji] = useState('');
  const [confirming, setConfirming] = useState(false);
  const load = useAction();
  const save = useAction();
  const remove = useAction();
  const runLoad = load.run;
  const formRef = useRef<HTMLFormElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const discardRef = useRef<HTMLButtonElement>(null);
  useFocusInvalid(formRef, save.error);
  const errorId = 'admin-draft-error';
  // Cancel puts focus back on the Discard that asked, once it is shown again.
  const cancelled = useRef(false);
  useEffect(() => {
    if (confirming || !cancelled.current) return;
    cancelled.current = false;
    discardRef.current?.focus();
  }, [confirming]);

  useEffect(() => {
    runLoad(
      () => getGeneration(id),
      ({ job: next }) => {
        setJob(next);
        setRows(toRows(next.draft?.words ?? []));
        setTitle(next.title);
        setEmoji(next.draft?.emoji ?? '');
      },
    );
  }, [id, runLoad]);
  const loaded = job !== null;
  useEffect(() => {
    if (loaded) headingRef.current?.focus();
  }, [loaded]);

  const ticked = rows.filter((r) => r.ticked).length;
  const isNew = job?.kind === 'new';
  const ready = job?.status === 'ready' && ticked > 0 && !save.busy && !remove.busy;
  const tickOneId = 'admin-draft-tick-one';
  const refused = refusedRow(rows, save.error?.field);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!ready || !job) return;
    const words = tickedWords(rows);
    save.run(
      () => saveDraft(id, isNew ? { title, emoji, words } : { words }),
      (answer) => onSaved(answer.category, draftSummary(answer)),
    );
  }

  function discard() {
    remove.run(() => discardDraft(id), onBack);
  }

  const update = (next: DraftRow) =>
    setRows((all) => all.map((r) => (r.key === next.key ? next : r)));

  return (
    <div className="grid gap-6">
      <button type="button" onClick={onBack} className={LINK_BUTTON}>
        {GENERATE_COPY.back}
      </button>
      {!job && !load.error && (
        <p role="status" className="text-xl text-soft">
          {GENERATE_COPY.loading}
        </p>
      )}
      {!job && load.error && <ErrorLine id="admin-draft-load-error" text={load.error.text} />}
      {job && (
        <form ref={formRef} onSubmit={submit} className="grid gap-5">
          <h2
            id="admin-categories-heading"
            ref={headingRef}
            tabIndex={-1}
            className="text-[clamp(28px,5vw,40px)] leading-tight font-normal break-words outline-none"
          >
            {GENERATE_COPY.reviewHeading(job.title)}
          </h2>
          {job.status !== 'ready' && <p className="text-xl">{GENERATE_COPY.notReady}</p>}
          {job.status === 'ready' && (
            <>
              <Card labelledBy="admin-draft-settings">
                <h3 id="admin-draft-settings" className="sr-only">
                  {GENERATE_COPY.reviewHeading(job.title)}
                </h3>
                {isNew ? (
                  <div className="grid gap-3 sm:grid-cols-[7rem_minmax(0,1fr)]">
                    <Field
                      label={GENERATE_COPY.emoji}
                      name="draft-emoji"
                      maxLength={CATEGORY_EMOJI_MAX}
                      autoComplete="off"
                      errorId={errorId}
                      error={save.error?.field === 'emoji'}
                      value={emoji}
                      onChange={(event) => setEmoji(event.target.value)}
                    />
                    <Field
                      label={GENERATE_COPY.title}
                      name="draft-title"
                      maxLength={CATEGORY_TITLE_MAX}
                      autoComplete="off"
                      errorId={errorId}
                      error={save.error?.field === 'title'}
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                    />
                  </div>
                ) : null}
                <p className="text-lg leading-snug text-soft">
                  {isNew ? GENERATE_COPY.newSaveHint : GENERATE_COPY.moreSaveHint(job.title)}{' '}
                  {GENERATE_COPY.unsavedNote}
                </p>
              </Card>
              <div className="flex flex-wrap items-center gap-x-4">
                <p role="status" className="text-xl">
                  {GENERATE_COPY.ticked(ticked, rows.length)}
                </p>
                <button
                  type="button"
                  className={ROW_LINK}
                  onClick={() => {
                    const all = ticked < rows.length;
                    setRows((rs) => rs.map((r) => ({ ...r, ticked: all })));
                  }}
                >
                  {ticked < rows.length ? GENERATE_COPY.tickAll : GENERATE_COPY.untickAll}
                </button>
              </div>
              <ul className="grid gap-4">
                {rows.map((row, index) => (
                  <DraftWordRow
                    key={row.key}
                    row={row}
                    index={index}
                    invalid={refused?.key === row.key ? refused.part : null}
                    errorId={errorId}
                    onChange={update}
                  />
                ))}
              </ul>
              <ErrorLine id={errorId} text={save.error?.text ?? remove.error?.text ?? null} />
              {confirming ? (
                <div className="grid gap-3" role="group" aria-labelledby="admin-draft-confirm">
                  <p id="admin-draft-confirm" className="text-xl">
                    {GENERATE_COPY.confirmDiscard}
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <SketchButton
                      variant="armed"
                      autoFocus
                      {...dead(remove.busy)}
                      className={DEAD}
                      onClick={() => !remove.busy && discard()}
                    >
                      {GENERATE_COPY.confirm}
                    </SketchButton>
                    <SketchButton
                      variant="ghost"
                      {...dead(remove.busy)}
                      className={DEAD}
                      onClick={() => {
                        if (remove.busy) return;
                        cancelled.current = true;
                        setConfirming(false);
                      }}
                    >
                      {GENERATE_COPY.cancel}
                    </SketchButton>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-4">
                  {ticked === 0 && (
                    <p id={tickOneId} className="basis-full text-lg">
                      {GENERATE_COPY.tickOne}
                    </p>
                  )}
                  <SketchButton
                    type="submit"
                    {...dead(!ready)}
                    aria-describedby={ticked === 0 ? tickOneId : undefined}
                    className={DEAD}
                  >
                    {save.busy ? GENERATE_COPY.saving : GENERATE_COPY.save(ticked)}
                  </SketchButton>
                  <button
                    ref={discardRef}
                    type="button"
                    className={ROW_LINK}
                    onClick={() => setConfirming(true)}
                  >
                    {GENERATE_COPY.discard}
                  </button>
                </div>
              )}
            </>
          )}
        </form>
      )}
    </div>
  );
}
