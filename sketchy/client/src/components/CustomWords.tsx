import { type Ref, useEffect, useRef, useState } from 'react';
import { CUSTOM_WORD_MAX, CUSTOM_WORDS_MAX } from '../../../shared/constants.js';
import type { Translate } from '../lib/copy.js';
import { parseCustomWords } from '../lib/customWords.js';
import { STATUS_MS } from '../lib/hostSend.js';
import type { GameSocket } from '../lib/socket.js';
import { FULL_SHEET, HAND_INPUT, SHEET_TITLE, sheetButton } from './sketch/sheet.js';

/**
 * The lobby button that opens "Add your own words", on the token Screen and the crown phone, with
 * how many are in. The count is all any view carries: the words never come back from the server.
 */
export function CustomWordsButton({
  ref,
  count,
  open,
  onOpen,
  t,
  className,
}: {
  ref?: Ref<HTMLButtonElement>;
  count: number;
  open: boolean;
  onOpen: () => void;
  t: Translate;
  className: string;
}) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onOpen}
      aria-haspopup="dialog"
      aria-expanded={open}
      className={className}
    >
      {t('customWords')} <span aria-hidden="true">✍️</span>
      {count > 0 && <> · {count}</>}
    </button>
  );
}

/**
 * "Add your own words" (Custom words), mounted while open: a box for one word or phrase per line
 * or comma-separated, Add, and Clear all (tap twice). Each Add sends `host:customWords` with the
 * new words, which the server adds to the room's list; Clear all sends `clear`. The box
 * holds only what is being typed: the list itself stays on the server, and the panel shows its
 * count from the latest snapshot. Done or Esc closes it.
 */
export function CustomWordsPanel({
  count,
  socket,
  t,
  onClose,
  onScreen,
}: {
  count: number;
  socket: GameSocket;
  t: Translate;
  onClose: () => void;
  /** The token Screen: everyone in the room can read the box, so it says so. */
  onScreen: boolean;
}) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clearArmed, setClearArmed] = useState(false);
  const box = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    box.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // "Tap again to clear" lapses on its own.
  useEffect(() => {
    if (!clearArmed) return;
    const id = setTimeout(() => setClearArmed(false), STATUS_MS);
    return () => clearTimeout(id);
  }, [clearArmed]);

  const send = async (words: string[], clear = false): Promise<boolean> => {
    setSending(true);
    setError(null);
    try {
      const res = await socket
        .timeout(5000)
        .emitWithAck('host:customWords', clear ? { words, clear } : { words });
      if (res.ok) return true;
      setError(
        res.error === 'tooManyWords'
          ? t('customWordsTooMany', {
              max: CUSTOM_WORDS_MAX,
              n: Math.max(0, CUSTOM_WORDS_MAX - count),
            })
          : t(res.error === 'rateLimited' ? 'tooFast' : 'settingsFailed'),
      );
    } catch {
      setError(t('settingsFailed'));
    } finally {
      setSending(false);
    }
    return false;
  };

  const add = async () => {
    if (sending) return;
    const parsed = parseCustomWords(text);
    if (!parsed.ok) {
      setError(
        parsed.error === 'tooLong'
          ? t('customWordsTooLong', { max: CUSTOM_WORD_MAX, word: parsed.word })
          : t('customWordsTooMany', {
              max: CUSTOM_WORDS_MAX,
              n: Math.max(0, CUSTOM_WORDS_MAX - count),
            }),
      );
      return;
    }
    if (parsed.words.length === 0) return;
    if (await send(parsed.words)) {
      setText('');
      box.current?.focus();
    }
  };

  const clear = async () => {
    if (sending) return;
    if (!clearArmed) {
      setClearArmed(true);
      return;
    }
    setClearArmed(false);
    await send([], true);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="custom-words-title"
      data-sheet="custom-words"
      className={`${FULL_SHEET} px-[max(5vmin,env(safe-area-inset-left))] pt-[max(3vmin,env(safe-area-inset-top))] pb-[max(3vmin,env(safe-area-inset-bottom))] text-[max(3.2vmin,16px)]`}
    >
      <div className="mx-auto flex max-w-[150vmin] flex-col gap-[2vmin]">
        <div className="flex items-center justify-between gap-[3vmin]">
          <h2 id="custom-words-title" className={`${SHEET_TITLE} text-[max(5vmin,24px)]`}>
            {t('customWords')}
          </h2>
          <button type="button" onClick={onClose} className={sheetButton('primary')}>
            {t('settingsDone')}
          </button>
        </div>

        <p className="text-soft">{t('customWordsHint', { max: CUSTOM_WORDS_MAX })}</p>
        {onScreen && (
          <p className="self-start sketch-border bg-sticky px-[2.5vmin] py-[0.8vmin] shadow-[0.28vmin_0.42vmin_0_var(--color-ink)]">
            {t('customWordsScreenNote')}
          </p>
        )}

        {/* Add sits above the box: an on-screen keyboard opening under the box can't cover it. */}
        <div className="flex flex-wrap items-center justify-between gap-[2vmin]">
          <p role="status" className="min-h-[1.5em] text-red">
            {error ?? (clearArmed ? t('customWordsClearConfirm') : '')}
          </p>
          <button
            type="button"
            onClick={add}
            aria-disabled={sending || text.trim() === ''}
            className={sheetButton('primary')}
          >
            {t('customWordsAdd')}
          </button>
        </div>

        <label className="flex flex-col gap-[1vmin]">
          <span className="sr-only">{t('customWordsLabel')}</span>
          <textarea
            ref={box}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setError(null);
            }}
            rows={5}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            className={`${HAND_INPUT} resize-none text-[max(3.2vmin,16px)]`}
          />
        </label>

        <div className="flex flex-wrap items-center justify-between gap-[2vmin] border-t-[1.5px] border-dashed border-dot pt-[2vmin]">
          <p>{t('customWordsCount', { n: count })}</p>
          {count > 0 && (
            <button
              type="button"
              onClick={clear}
              aria-disabled={sending}
              className={sheetButton(clearArmed ? 'armed' : 'ghost')}
            >
              {clearArmed ? t('customWordsClearConfirm') : t('customWordsClear')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
