// The category editor inside the signed-in admin (F81; spec: Admin, Category editor): the list of
// every category (emoji, title, word count, hidden and default-on badges) and one category's page
// (title, emoji, default on, hidden, a confirmed delete; add, edit and delete words; bulk paste; a
// word filter from 20 words). The server checks every write with the store's rules and names the
// field it refuses; this page shows that message by the form that sent it. Lazy, with `/admin`.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
  type Ref,
  type RefObject,
} from 'react';
import {
  ADMIN_WORD_FILTER_MIN,
  CATEGORY_EMOJI_MAX,
  CATEGORY_TITLE_MAX,
  WORD_ALT_MAX,
  WORD_FORM_MAX,
} from '../../../../shared/constants.js';
import type {
  AdminBulkResponse,
  AdminCategory,
  AdminCategorySummary,
  AdminWord,
  WordLevel,
} from '../../../../shared/types.js';
import { SketchButton } from '../../components/sketch/SketchButton.js';
import {
  AdminApiError,
  addWord,
  addWords,
  createCategory,
  deleteCategory,
  deleteWord,
  getCategory,
  listCategories,
  patchCategory,
  patchWord,
} from './adminApi.js';
import { Card, ErrorLine, Field, INPUT, LINK_BUTTON } from './adminUi.js';

export const CATEGORY_COPY = {
  heading: 'Word categories',
  loading: 'Loading…',
  retry: 'Try again',
  empty: 'No categories yet. Add one above.',
  newHeading: 'New category',
  emoji: 'Emoji',
  title: 'Title',
  create: 'Add category',
  words: (n: number) => (n === 1 ? 'word' : 'words'),
  badgeHidden: 'Hidden',
  badgeDefaultOn: 'Default on',
  back: '← All categories',
  settingsHeading: 'Category',
  defaultOn: 'On in new rooms',
  defaultOnHint: 'Ticked in a new room’s categories.',
  hidden: 'Hidden',
  hiddenHint: 'Left out of the lobby and of new games.',
  save: 'Save',
  saving: 'Saving…',
  saved: 'Saved.',
  delete: 'Delete category',
  confirmDelete: (title: string, n: number) =>
    `Delete “${title}” and its ${n} ${n === 1 ? 'word' : 'words'}? This can’t be undone.`,
  confirm: 'Delete',
  deleting: 'Deleting…',
  cancel: 'Cancel',
  addHeading: 'Add a word',
  word: 'Word',
  level: 'Level',
  alts: 'Alternates',
  altsHint: `Other accepted answers, comma separated, up to ${WORD_ALT_MAX}.`,
  add: 'Add word',
  bulkHeading: 'Paste many',
  bulkLabel: 'One word per line',
  bulkHint:
    'word | level | alt, alt — level and alternates are optional; level is easy, medium or hard.',
  bulkAdd: 'Add lines',
  bulkLeft: 'The lines that were not added are left in the box.',
  listHeading: 'Words',
  filter: 'Filter words',
  noWords: 'No words yet.',
  noMatch: 'No word matches the filter.',
  also: 'also',
  edit: 'Edit',
  editLabel: (word: string) => `Edit ${word}`,
  deleteWord: 'Delete',
  deleteLabel: (word: string) => `Delete ${word}`,
  cancelEdit: 'Cancel',
} as const;

export const LEVELS: readonly { value: WordLevel; label: string }[] = [
  { value: 1, label: 'Easy' },
  { value: 2, label: 'Medium' },
  { value: 3, label: 'Hard' },
];
const levelLabel = (level: WordLevel) => LEVELS[level - 1]!.label;

/** The alternates field: comma separated, trimmed, empties dropped. The server checks the rest. */
export function parseAlts(text: string): string[] {
  return text
    .split(',')
    .map((a) => a.trim())
    .filter((a) => a !== '');
}

/** Lowercase without accents, for the filter only (matching itself is the server's). */
const fold = (s: string) => s.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();

/** The words whose text or an alternate contains the filter, in their order. */
export function filterWords(words: readonly AdminWord[], query: string): AdminWord[] {
  const q = fold(query.trim());
  if (q === '') return [...words];
  return words.filter((w) => fold(w.word).includes(q) || w.alt.some((a) => fold(a).includes(q)));
}

/** "Added 3 words. Skipped 2 duplicates. 1 line not added." */
export function bulkSummary({ added, duplicates, errors }: AdminBulkResponse): string {
  const parts = [`Added ${added} ${added === 1 ? 'word' : 'words'}.`];
  if (duplicates > 0) {
    parts.push(`Skipped ${duplicates} ${duplicates === 1 ? 'duplicate' : 'duplicates'}.`);
  }
  if (errors.length > 0) {
    parts.push(`${errors.length} ${errors.length === 1 ? 'line' : 'lines'} not added:`);
  }
  return parts.join(' ');
}

/** Called when a call comes back 401: the session ended, so `/admin` shows the sign-in again. */
const SessionEnded = createContext<() => void>(() => undefined);

interface Refusal {
  text: string;
  field?: string;
}

/**
 * One form's request: busy while it runs, the refusal (and the field it names) after. A 401 hands
 * back to the sign-in instead.
 */
function useAction() {
  const sessionEnded = useContext(SessionEnded);
  // In a ref, so `run` stays the same function for the form's life and effects that use it don't
  // run again when the page above re-renders.
  const ended = useRef(sessionEnded);
  useEffect(() => {
    ended.current = sessionEnded;
  }, [sessionEnded]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Refusal | null>(null);
  const run = useCallback(
    <T,>(request: () => Promise<T>, done: (result: T) => void, failed?: () => void) => {
      setBusy(true);
      setError(null);
      request()
        .then((result) => {
          setBusy(false);
          done(result);
        })
        .catch((err: unknown) => {
          setBusy(false);
          failed?.();
          if (err instanceof AdminApiError && err.status === 401) return ended.current();
          setError({
            text: err instanceof Error ? err.message : String(err),
            field: err instanceof AdminApiError ? err.field : undefined,
          });
        });
    },
    [],
  );
  return { busy, error, run, clear: () => setError(null) };
}

/** After a refusal, focus the field it names (marked `aria-invalid`), so the fix starts there. */
function useFocusInvalid(form: RefObject<HTMLFormElement | null>, error: Refusal | null) {
  useEffect(() => {
    if (error) form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [form, error]);
}

/**
 * A submit that can't be used right now stays focusable (`aria-disabled`, not `disabled`), so
 * focus isn't dropped to the page when it goes dead after a save; its handler ignores it.
 */
const dead = (isDead: boolean) => ({ 'aria-disabled': isDead || undefined });
const DEAD = 'aria-disabled:opacity-50';

/** A small red-pen badge, as the game's level tags. */
function Badge({ children, tone = 'red' }: { children: ReactNode; tone?: 'red' | 'pen' }) {
  return (
    <span
      className={`inline-block rounded-[10px_4px_10px_4px] border-2 px-[7px] text-[15px] leading-5 whitespace-nowrap ${
        tone === 'red' ? 'border-red text-red' : 'border-pen text-pen'
      }`}
    >
      {children}
    </span>
  );
}

const CHECKBOX =
  'mt-1 size-6 shrink-0 accent-pen focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-pen';

function Check({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const id = useId();
  return (
    // The whole row is the label, so the hint is part of the tap target too.
    <label className="flex min-h-11 items-start gap-3">
      <input
        type="checkbox"
        className={CHECKBOX}
        checked={checked}
        aria-describedby={`${id}-hint`}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="grid">
        <span className="text-[22px] leading-tight">{label}</span>
        <span id={`${id}-hint`} className="text-base leading-snug text-soft">
          {hint}
        </span>
      </span>
    </label>
  );
}

function LevelSelect({
  value,
  onChange,
  label = CATEGORY_COPY.level,
  errorId,
  error = false,
}: {
  value: WordLevel;
  onChange: (level: WordLevel) => void;
  label?: string;
  errorId?: string;
  error?: boolean;
}) {
  const id = useId();
  return (
    <div className="grid gap-1">
      <label htmlFor={id} className="text-[22px] leading-tight">
        {label}
      </label>
      <select
        id={id}
        className={INPUT}
        value={value}
        aria-describedby={errorId}
        aria-invalid={error || undefined}
        onChange={(event) => onChange(Number(event.target.value) as WordLevel)}
      >
        {LEVELS.map((l) => (
          <option key={l.value} value={l.value}>
            {l.label}
          </option>
        ))}
      </select>
    </div>
  );
}

// ---------- The list ----------

/** One category in the list: a button that opens it. */
export function CategoryRow({
  category,
  onOpen,
}: {
  category: AdminCategorySummary;
  onOpen: (id: string) => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(category.id)}
        className="flex min-h-14 w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-[3px] border-[2.5px] border-ink bg-paper px-4 py-2 text-left shadow-[3px_4px_0_var(--color-ink)] hover:brightness-95 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-pen"
      >
        <span aria-hidden className="text-[28px] leading-none">
          {category.emoji}
        </span>
        <span className="min-w-0 flex-1 text-[24px] leading-tight break-words">
          {category.title}
        </span>
        <span className="flex flex-wrap items-center gap-2">
          {category.defaultOn && <Badge tone="pen">{CATEGORY_COPY.badgeDefaultOn}</Badge>}
          {category.hidden && <Badge>{CATEGORY_COPY.badgeHidden}</Badge>}
          <span className="text-lg whitespace-nowrap text-soft">
            <span className="font-num font-black">{category.wordCount}</span>{' '}
            {CATEGORY_COPY.words(category.wordCount)}
          </span>
        </span>
      </button>
    </li>
  );
}

export function CategoryList({
  categories,
  onOpen,
}: {
  categories: readonly AdminCategorySummary[];
  onOpen: (id: string) => void;
}) {
  if (categories.length === 0) {
    return <p className="text-lg text-soft">{CATEGORY_COPY.empty}</p>;
  }
  return (
    <ul className="grid gap-3" aria-label={CATEGORY_COPY.heading}>
      {categories.map((c) => (
        <CategoryRow key={c.id} category={c} onOpen={onOpen} />
      ))}
    </ul>
  );
}

function NewCategoryForm({ onCreated }: { onCreated: (category: AdminCategory) => void }) {
  const [title, setTitle] = useState('');
  const [emoji, setEmoji] = useState('');
  const { busy, error, run } = useAction();
  const formRef = useRef<HTMLFormElement>(null);
  useFocusInvalid(formRef, error);
  const errorId = 'admin-new-category-error';
  const ready = title.trim() !== '' && emoji.trim() !== '' && !busy;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!ready) return;
    run(
      () => createCategory({ title, emoji }),
      ({ category }) => onCreated(category),
    );
  }

  return (
    <Card labelledBy="admin-new-category-heading">
      <form ref={formRef} onSubmit={submit} className="grid gap-4">
        <h3 id="admin-new-category-heading" className="text-[26px] leading-tight font-normal">
          {CATEGORY_COPY.newHeading}
        </h3>
        <div className="grid grid-cols-[6rem_minmax(0,1fr)] gap-3">
          <Field
            label={CATEGORY_COPY.emoji}
            name="emoji"
            className={`${INPUT} text-center`}
            maxLength={CATEGORY_EMOJI_MAX}
            autoComplete="off"
            errorId={errorId}
            error={error?.field === 'emoji'}
            value={emoji}
            onChange={(event) => setEmoji(event.target.value)}
          />
          <Field
            label={CATEGORY_COPY.title}
            name="title"
            maxLength={CATEGORY_TITLE_MAX}
            autoComplete="off"
            errorId={errorId}
            error={error?.field === 'title'}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </div>
        <ErrorLine id={errorId} text={error?.text ?? null} />
        <SketchButton type="submit" {...dead(!ready)} className={`justify-self-start ${DEAD}`}>
          {busy ? CATEGORY_COPY.saving : CATEGORY_COPY.create}
        </SketchButton>
      </form>
    </Card>
  );
}

function CategoryIndex({ onOpen }: { onOpen: (id: string) => void }) {
  const [categories, setCategories] = useState<AdminCategorySummary[] | null>(null);
  const { error, run } = useAction();

  const load = useCallback(() => {
    run(listCategories, (list) => setCategories(list.categories));
  }, [run]);
  useEffect(load, [load]);

  return (
    <div className="grid gap-6">
      <NewCategoryForm onCreated={(category) => onOpen(category.id)} />
      {categories === null && !error && (
        <p role="status" className="text-xl text-soft">
          {CATEGORY_COPY.loading}
        </p>
      )}
      {error && (
        <div className="grid gap-2">
          <ErrorLine id="admin-categories-error" text={error.text} />
          <SketchButton variant="ghost" onClick={load} className="justify-self-start">
            {CATEGORY_COPY.retry}
          </SketchButton>
        </div>
      )}
      {categories && <CategoryList categories={categories} onOpen={onOpen} />}
    </div>
  );
}

// ---------- One category ----------

function SettingsForm({
  category,
  onSaved,
  onDeleted,
}: {
  category: AdminCategory;
  onSaved: (category: AdminCategory) => void;
  onDeleted: () => void;
}) {
  const [title, setTitle] = useState(category.title);
  const [emoji, setEmoji] = useState(category.emoji);
  const [defaultOn, setDefaultOn] = useState(category.defaultOn);
  const [hidden, setHidden] = useState(category.hidden);
  const [saved, setSaved] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const save = useAction();
  const remove = useAction();
  const formRef = useRef<HTMLFormElement>(null);
  const deleteRef = useRef<HTMLButtonElement>(null);
  useFocusInvalid(formRef, save.error);
  const errorId = 'admin-category-error';
  const changed =
    title !== category.title ||
    emoji !== category.emoji ||
    defaultOn !== category.defaultOn ||
    hidden !== category.hidden;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!changed || save.busy) return;
    setSaved(false);
    save.run(
      () => patchCategory(category.id, { title, emoji, defaultOn, hidden }),
      ({ category: next }) => {
        setTitle(next.title);
        setEmoji(next.emoji);
        setSaved(true);
        onSaved(next);
      },
    );
  }

  function closeConfirm() {
    setConfirming(false);
    remove.clear();
    deleteRef.current?.focus();
  }

  function confirmDelete() {
    if (remove.busy) return;
    remove.run(() => deleteCategory(category.id), onDeleted);
  }

  return (
    <Card labelledBy="admin-category-heading">
      <form ref={formRef} onSubmit={submit} className="grid gap-4">
        <h3 id="admin-category-heading" className="text-[26px] leading-tight font-normal">
          {CATEGORY_COPY.settingsHeading}
        </h3>
        <div className="grid grid-cols-[6rem_minmax(0,1fr)] gap-3">
          <Field
            label={CATEGORY_COPY.emoji}
            name="emoji"
            className={`${INPUT} text-center`}
            maxLength={CATEGORY_EMOJI_MAX}
            autoComplete="off"
            errorId={errorId}
            error={save.error?.field === 'emoji'}
            value={emoji}
            onChange={(event) => {
              setSaved(false);
              setEmoji(event.target.value);
            }}
          />
          <Field
            label={CATEGORY_COPY.title}
            name="title"
            maxLength={CATEGORY_TITLE_MAX}
            autoComplete="off"
            errorId={errorId}
            error={save.error?.field === 'title'}
            value={title}
            onChange={(event) => {
              setSaved(false);
              setTitle(event.target.value);
            }}
          />
        </div>
        <Check
          label={CATEGORY_COPY.defaultOn}
          hint={CATEGORY_COPY.defaultOnHint}
          checked={defaultOn}
          onChange={(value) => {
            setSaved(false);
            setDefaultOn(value);
          }}
        />
        <Check
          label={CATEGORY_COPY.hidden}
          hint={CATEGORY_COPY.hiddenHint}
          checked={hidden}
          onChange={(value) => {
            setSaved(false);
            setHidden(value);
          }}
        />
        <ErrorLine id={errorId} text={save.error?.text ?? null} />
        <p role="status" className="text-lg text-soft">
          {saved && !changed ? CATEGORY_COPY.saved : ''}
        </p>
        <div className="flex flex-wrap gap-3">
          <SketchButton type="submit" {...dead(!changed || save.busy)} className={DEAD}>
            {save.busy ? CATEGORY_COPY.saving : CATEGORY_COPY.save}
          </SketchButton>
          {/* Stays mounted while the question is open, so Cancel can hand focus back to it. */}
          <SketchButton
            ref={deleteRef}
            variant="ghost"
            aria-expanded={confirming}
            aria-controls="admin-delete-confirm"
            onClick={() => setConfirming(true)}
          >
            {CATEGORY_COPY.delete}
          </SketchButton>
        </div>
        {confirming && (
          <div
            id="admin-delete-confirm"
            role="group"
            aria-labelledby="admin-delete-question"
            className="grid gap-3 border-t-2 border-dashed border-dot pt-3"
            onKeyDown={(event) => {
              if (event.key === 'Escape') closeConfirm();
            }}
          >
            <p id="admin-delete-question" className="text-xl leading-snug">
              {CATEGORY_COPY.confirmDelete(category.title, category.words.length)}
            </p>
            <ErrorLine id="admin-delete-error" text={remove.error?.text ?? null} />
            <div className="flex flex-wrap gap-3">
              <SketchButton
                variant="armed"
                {...dead(remove.busy)}
                className={DEAD}
                aria-describedby="admin-delete-error"
                onClick={confirmDelete}
              >
                {remove.busy ? CATEGORY_COPY.deleting : CATEGORY_COPY.confirm}
              </SketchButton>
              <SketchButton variant="ghost" autoFocus onClick={closeConfirm}>
                {CATEGORY_COPY.cancel}
              </SketchButton>
            </div>
          </div>
        )}
      </form>
    </Card>
  );
}

/** The word, level and alternates fields, shared by Add a word and a row's Edit. */
function WordFields({
  idPrefix,
  word,
  level,
  alts,
  setWord,
  setLevel,
  setAlts,
  error,
  errorId,
  autoFocus = false,
  wordRef,
}: {
  idPrefix: string;
  word: string;
  level: WordLevel;
  alts: string;
  setWord: (word: string) => void;
  setLevel: (level: WordLevel) => void;
  setAlts: (alts: string) => void;
  error: Refusal | null;
  errorId: string;
  autoFocus?: boolean;
  wordRef?: Ref<HTMLInputElement>;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(7rem,0.6fr)]">
      <Field
        ref={wordRef}
        label={CATEGORY_COPY.word}
        name={`${idPrefix}-word`}
        maxLength={WORD_FORM_MAX}
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        autoFocus={autoFocus}
        errorId={errorId}
        error={error?.field === 'word'}
        value={word}
        onChange={(event) => setWord(event.target.value)}
      />
      <LevelSelect
        value={level}
        onChange={setLevel}
        errorId={errorId}
        error={error?.field === 'difficulty'}
      />
      <div className="sm:col-span-2">
        <Field
          label={CATEGORY_COPY.alts}
          hint={CATEGORY_COPY.altsHint}
          name={`${idPrefix}-alts`}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          errorId={errorId}
          error={error?.field === 'alt'}
          value={alts}
          onChange={(event) => setAlts(event.target.value)}
        />
      </div>
    </div>
  );
}

function AddWordForm({
  categoryId,
  onSaved,
}: {
  categoryId: string;
  onSaved: (category: AdminCategory) => void;
}) {
  const [word, setWord] = useState('');
  const [level, setLevel] = useState<WordLevel>(2);
  const [alts, setAlts] = useState('');
  const { busy, error, run } = useAction();
  const wordRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  useFocusInvalid(formRef, error);
  const errorId = 'admin-add-word-error';
  const ready = word.trim() !== '' && !busy;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!ready) return;
    run(
      () => addWord(categoryId, { word, difficulty: level, alt: parseAlts(alts) }),
      ({ category }) => {
        setWord('');
        setAlts('');
        onSaved(category);
        // Ready for the next word; the level stays as it was.
        wordRef.current?.focus();
      },
    );
  }

  return (
    <Card labelledBy="admin-add-word-heading">
      <form ref={formRef} onSubmit={submit} className="grid gap-4">
        <h3 id="admin-add-word-heading" className="text-[26px] leading-tight font-normal">
          {CATEGORY_COPY.addHeading}
        </h3>
        <WordFields
          idPrefix="add"
          word={word}
          level={level}
          alts={alts}
          setWord={setWord}
          setLevel={setLevel}
          setAlts={setAlts}
          error={error}
          errorId={errorId}
          wordRef={wordRef}
        />
        <ErrorLine id={errorId} text={error?.text ?? null} />
        <SketchButton type="submit" {...dead(!ready)} className={`justify-self-start ${DEAD}`}>
          {busy ? CATEGORY_COPY.saving : CATEGORY_COPY.add}
        </SketchButton>
      </form>
    </Card>
  );
}

/** The result of a bulk paste: the counts, then each line that was not added and why. */
export function BulkResult({ result }: { result: AdminBulkResponse }) {
  return (
    <div role="status" className="grid gap-2">
      <p className="text-lg leading-snug">{bulkSummary(result)}</p>
      {result.errors.length > 0 && (
        <ul className="grid gap-1 text-lg leading-snug">
          {result.errors.map((e) => (
            <li key={e.line} className="break-words">
              <span aria-hidden className="text-red">
                ✗{' '}
              </span>
              Line <span className="font-num font-black">{e.line}</span>:{' '}
              <span className="text-soft">{e.text}</span> — {e.reason}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function BulkForm({
  categoryId,
  onSaved,
}: {
  categoryId: string;
  onSaved: (category: AdminCategory) => void;
}) {
  const [text, setText] = useState('');
  const [result, setResult] = useState<AdminBulkResponse | null>(null);
  const { busy, error, run } = useAction();
  const id = useId();
  const formRef = useRef<HTMLFormElement>(null);
  useFocusInvalid(formRef, error);
  const errorId = 'admin-bulk-error';
  const ready = text.trim() !== '' && !busy;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!ready) return;
    setResult(null);
    run(
      () => addWords(categoryId, text),
      (answer) => {
        setResult(answer);
        // Keep only the lines that need fixing, so they can be corrected and sent again.
        const lines = text.split(/\r?\n/);
        setText(answer.errors.map((e) => lines[e.line - 1]?.trim() ?? e.text).join('\n'));
        onSaved(answer.category);
      },
    );
  }

  return (
    <Card labelledBy="admin-bulk-heading">
      <form ref={formRef} onSubmit={submit} className="grid gap-4">
        <h3 id="admin-bulk-heading" className="text-[26px] leading-tight font-normal">
          {CATEGORY_COPY.bulkHeading}
        </h3>
        <div className="grid gap-1">
          <label htmlFor={id} className="text-[22px] leading-tight">
            {CATEGORY_COPY.bulkLabel}
          </label>
          <textarea
            id={id}
            name="bulk"
            rows={6}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            aria-describedby={`${id}-hint ${errorId}`}
            aria-invalid={error ? true : undefined}
            className={`${INPUT} min-h-40 py-2 text-lg leading-snug`}
            placeholder={'pizza | easy\nairplane | medium | aeroplane, plane'}
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
          <p id={`${id}-hint`} className="text-base leading-snug text-soft">
            {CATEGORY_COPY.bulkHint}
          </p>
        </div>
        <ErrorLine id={errorId} text={error?.text ?? null} />
        {result && <BulkResult result={result} />}
        {result && result.errors.length > 0 && (
          <p className="text-base text-soft">{CATEGORY_COPY.bulkLeft}</p>
        )}
        <SketchButton type="submit" {...dead(!ready)} className={`justify-self-start ${DEAD}`}>
          {busy ? CATEGORY_COPY.saving : CATEGORY_COPY.bulkAdd}
        </SketchButton>
      </form>
    </Card>
  );
}

/** A row's Edit and Delete: underlined text, 44 px square at least, centred on the row. */
const ROW_BUTTON =
  'min-h-11 min-w-11 px-2 text-lg underline underline-offset-4 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-pen';

/** One word's row: text, level, alternates, Edit and Delete. */
export function WordRow({
  word,
  onEdit,
  onDelete,
  busy = false,
}: {
  word: AdminWord;
  onEdit: () => void;
  onDelete: () => void;
  busy?: boolean;
}) {
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b-2 border-dashed border-dot py-2">
      <span className="min-w-0 flex-1 basis-48">
        <span className="text-[22px] leading-tight break-words">{word.word}</span>{' '}
        <Badge>{levelLabel(word.difficulty)}</Badge>
        {word.alt.length > 0 && (
          <span className="block text-base leading-snug break-words text-soft">
            {CATEGORY_COPY.also}: {word.alt.join(', ')}
          </span>
        )}
      </span>
      <span className="flex gap-3">
        <button
          type="button"
          onClick={onEdit}
          data-edit={word.id}
          aria-label={CATEGORY_COPY.editLabel(word.word)}
          className={`${ROW_BUTTON} text-pen`}
        >
          {CATEGORY_COPY.edit}
        </button>
        <button
          type="button"
          onClick={() => {
            if (!busy) onDelete();
          }}
          {...dead(busy)}
          aria-label={CATEGORY_COPY.deleteLabel(word.word)}
          className={`${ROW_BUTTON} text-red ${DEAD}`}
        >
          {CATEGORY_COPY.deleteWord}
        </button>
      </span>
    </li>
  );
}

function WordEditRow({
  categoryId,
  word,
  onSaved,
  onCancel,
}: {
  categoryId: string;
  word: AdminWord;
  onSaved: (category: AdminCategory) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState(word.word);
  const [level, setLevel] = useState<WordLevel>(word.difficulty);
  const [alts, setAlts] = useState(word.alt.join(', '));
  const { busy, error, run } = useAction();
  const formRef = useRef<HTMLFormElement>(null);
  useFocusInvalid(formRef, error);
  const errorId = `admin-edit-${word.id}-error`;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || text.trim() === '') return;
    run(
      () => patchWord(categoryId, word.id, { word: text, difficulty: level, alt: parseAlts(alts) }),
      ({ category }) => onSaved(category),
    );
  }

  return (
    <li className="border-b-2 border-dashed border-dot py-3">
      <form
        ref={formRef}
        onSubmit={submit}
        className="grid gap-3"
        aria-label={CATEGORY_COPY.editLabel(word.word)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') onCancel();
        }}
      >
        <WordFields
          idPrefix={`edit-${word.id}`}
          word={text}
          level={level}
          alts={alts}
          setWord={setText}
          setLevel={setLevel}
          setAlts={setAlts}
          error={error}
          errorId={errorId}
          autoFocus
        />
        <ErrorLine id={errorId} text={error?.text ?? null} />
        <div className="flex flex-wrap gap-3">
          <SketchButton type="submit" {...dead(busy || text.trim() === '')} className={DEAD}>
            {busy ? CATEGORY_COPY.saving : CATEGORY_COPY.save}
          </SketchButton>
          <SketchButton variant="ghost" onClick={onCancel}>
            {CATEGORY_COPY.cancelEdit}
          </SketchButton>
        </div>
      </form>
    </li>
  );
}

/** The word list, with a filter from 20 words. Exported for markup tests. */
export function WordList({
  category,
  filter,
  setFilter,
  editing,
  setEditing,
  onSaved,
  onDelete,
  deleting,
  error,
  headingRef,
}: {
  category: AdminCategory;
  filter: string;
  setFilter: (filter: string) => void;
  editing: string | null;
  setEditing: (wordId: string | null) => void;
  onSaved: (category: AdminCategory) => void;
  onDelete: (word: AdminWord) => void;
  deleting: string | null;
  error: string | null;
  /** The list's heading, focused after a word is deleted. */
  headingRef?: Ref<HTMLHeadingElement>;
}) {
  const listRef = useRef<HTMLUListElement>(null);
  /** The word whose Edit button gets focus back when its edit row closes. */
  const returnTo = useRef<string | null>(null);
  useEffect(() => {
    if (editing !== null || returnTo.current === null) return;
    const id = returnTo.current;
    returnTo.current = null;
    [...(listRef.current?.querySelectorAll<HTMLElement>('[data-edit]') ?? [])]
      .find((el) => el.dataset.edit === id)
      ?.focus();
  }, [editing]);
  const closeEdit = (id: string) => {
    returnTo.current = id;
    setEditing(null);
  };
  const showFilter = category.words.length >= ADMIN_WORD_FILTER_MIN;
  const shown = showFilter ? filterWords(category.words, filter) : category.words;
  return (
    <section aria-labelledby="admin-words-heading" className="grid content-start gap-3">
      <h3
        id="admin-words-heading"
        ref={headingRef}
        tabIndex={-1}
        className="text-[26px] leading-tight font-normal outline-none"
      >
        {CATEGORY_COPY.listHeading} (
        <span className="font-num font-black">{category.words.length}</span>)
      </h3>
      {showFilter && (
        <Field
          label={CATEGORY_COPY.filter}
          type="search"
          name="filter"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        />
      )}
      <ErrorLine id="admin-words-error" text={error} />
      {category.words.length === 0 ? (
        <p className="text-lg text-soft">{CATEGORY_COPY.noWords}</p>
      ) : shown.length === 0 ? (
        <p className="text-lg text-soft">{CATEGORY_COPY.noMatch}</p>
      ) : (
        <ul ref={listRef} className="grid">
          {shown.map((w) =>
            editing === w.id ? (
              <WordEditRow
                key={w.id}
                categoryId={category.id}
                word={w}
                onSaved={(next) => {
                  closeEdit(w.id);
                  onSaved(next);
                }}
                onCancel={() => closeEdit(w.id)}
              />
            ) : (
              <WordRow
                key={w.id}
                word={w}
                busy={deleting === w.id}
                onEdit={() => setEditing(w.id)}
                onDelete={() => onDelete(w)}
              />
            ),
          )}
        </ul>
      )}
    </section>
  );
}

function CategoryPage({ id, onBack }: { id: string; onBack: () => void }) {
  const [category, setCategory] = useState<AdminCategory | null>(null);
  const [filter, setFilter] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const load = useAction();
  const remove = useAction();
  const runLoad = load.run;
  const titleRef = useRef<HTMLHeadingElement>(null);
  const wordsHeadingRef = useRef<HTMLHeadingElement>(null);
  const loaded = category !== null;
  // The view changed under the button that opened it: say where we are now.
  useEffect(() => {
    if (loaded) titleRef.current?.focus();
  }, [loaded]);

  const fetchIt = useCallback(() => {
    runLoad(
      () => getCategory(id),
      (answer) => setCategory(answer.category),
    );
  }, [id, runLoad]);
  useEffect(fetchIt, [fetchIt]);

  function removeWord(word: AdminWord) {
    if (!category) return;
    setDeleting(word.id);
    remove.run(
      () => deleteWord(category.id, word.id),
      ({ category: next }) => {
        setDeleting(null);
        setCategory(next);
        // The row with the focused Delete is gone.
        wordsHeadingRef.current?.focus();
      },
      () => setDeleting(null),
    );
  }

  return (
    <div className="grid gap-6">
      <button type="button" onClick={onBack} className={LINK_BUTTON}>
        {CATEGORY_COPY.back}
      </button>
      {!category && !load.error && (
        <p role="status" className="text-xl text-soft">
          {CATEGORY_COPY.loading}
        </p>
      )}
      {!category && load.error && (
        <div className="grid gap-2">
          <ErrorLine id="admin-category-load-error" text={load.error.text} />
          <SketchButton variant="ghost" onClick={fetchIt} className="justify-self-start">
            {CATEGORY_COPY.retry}
          </SketchButton>
        </div>
      )}
      {category && (
        <>
          <h2
            id="admin-categories-heading"
            ref={titleRef}
            tabIndex={-1}
            className="flex items-center gap-3 text-[clamp(28px,5vw,40px)] leading-tight font-normal break-words outline-none"
          >
            <span aria-hidden>{category.emoji}</span>
            <span className="min-w-0">{category.title}</span>
          </h2>
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
            <div className="grid gap-6">
              <SettingsForm category={category} onSaved={setCategory} onDeleted={onBack} />
              <AddWordForm categoryId={category.id} onSaved={setCategory} />
              <BulkForm categoryId={category.id} onSaved={setCategory} />
            </div>
            <WordList
              category={category}
              filter={filter}
              setFilter={setFilter}
              editing={editing}
              setEditing={setEditing}
              onSaved={setCategory}
              onDelete={removeWord}
              deleting={deleting}
              error={remove.error?.text ?? null}
              headingRef={wordsHeadingRef}
            />
          </div>
        </>
      )}
    </div>
  );
}

/**
 * The editor: the list, or one category. Which one is open is page state, not a URL (`/admin` is
 * a single route; DECISIONS 107). `onSessionEnded` runs when a call comes back 401.
 */
export function CategoriesEditor({ onSessionEnded }: { onSessionEnded: () => void }) {
  const [open, setOpen] = useState<string | null>(null);
  const listHeadingRef = useRef<HTMLHeadingElement>(null);
  const cameBack = useRef(false);
  useEffect(() => {
    if (open !== null || !cameBack.current) return;
    cameBack.current = false;
    listHeadingRef.current?.focus();
  }, [open]);

  return (
    <SessionEnded.Provider value={onSessionEnded}>
      <section aria-labelledby="admin-categories-heading" className="grid gap-6">
        {open === null && (
          <h2
            id="admin-categories-heading"
            ref={listHeadingRef}
            tabIndex={-1}
            className="text-[28px] leading-tight font-normal outline-none"
          >
            {CATEGORY_COPY.heading}
          </h2>
        )}
        {open === null ? (
          <CategoryIndex
            onOpen={(id) => {
              setOpen(id);
              window.scrollTo({ top: 0 });
            }}
          />
        ) : (
          <CategoryPage
            id={open}
            onBack={() => {
              cameBack.current = true;
              setOpen(null);
              window.scrollTo({ top: 0 });
            }}
          />
        )}
      </section>
    </SessionEnded.Provider>
  );
}
