import { type ReactNode, type Ref, useEffect, useRef, useState } from 'react';
import {
  CYCLES_CHOICES,
  DIFFICULTY_CHOICES,
  DRAW_SECONDS_CHOICES,
  GUESS_FEED_CHOICES,
  PRESETS,
  type PresetId,
} from '../../../../shared/constants.js';
import type { LobbyCategoryView, RoomSettings } from '../../../../shared/types.js';
import type { CopyKey, Translate } from '../../lib/copy.js';
import { PRESET_IDS, presetOf, saveCategoryPick, toggleCategory } from '../../lib/settings.js';
import type { GameSocket } from '../../lib/socket.js';
import { FULL_SHEET, OPTION, SHEET_TITLE, sheetButton } from '../sketch/sheet.js';

const PRESET_COPY: Record<PresetId, { label: CopyKey; note: CopyKey }> = {
  quick: { label: 'presetQuick', note: 'presetQuickNote' },
  classic: { label: 'presetClassic', note: 'presetClassicNote' },
  partyNight: { label: 'presetPartyNight', note: 'presetPartyNightNote' },
};

export const presetLabel = (t: Translate, id: PresetId) => t(PRESET_COPY[id].label);

/**
 * The lobby's one-line summary: "Classic · 60 s · 2 rounds · 8 categories". With the host's
 * category list (`known`), ids the store has since deleted or hidden aren't counted.
 */
export function settingsLine(
  t: Translate,
  settings: RoomSettings,
  known?: readonly Pick<LobbyCategoryView, 'id'>[],
): string {
  const summary = t('settingsSummary', {
    seconds: settings.drawSeconds,
    cycles: settings.cycles === 1 ? t('roundOne') : t('rounds', { n: settings.cycles }),
  });
  const preset = presetOf(settings);
  const line = preset ? t('presetSummary', { preset: presetLabel(t, preset), summary }) : summary;
  const ids = known && known.length > 0 ? new Set(known.map((c) => c.id)) : null;
  const n = ids
    ? settings.categories.filter((id) => ids.has(id)).length
    : settings.categories.length;
  return `${line} · ${n === 1 ? t('categoryOne') : t('categoriesCount', { n })}`;
}

const ON_OFF = [true, false] as const;

/** The settings picked from a few values; `categories` has its own chips. */
type ChoiceKey = Exclude<keyof RoomSettings, 'categories'>;

type Option<K extends ChoiceKey> = { value: RoomSettings[K]; label: string };

/** Every setting in the Settings table, in its order, with its allowed values. */
function rows(t: Translate): {
  [K in ChoiceKey]: { label: string; options: Option<K>[] };
} {
  const onOff = ON_OFF.map((value) => ({ value, label: t(value ? 'optOn' : 'optOff') }));
  return {
    drawSeconds: {
      label: t('settingDrawSeconds'),
      options: DRAW_SECONDS_CHOICES.map((n) => ({ value: n, label: t('secondsShort', { n }) })),
    },
    cycles: {
      label: t('settingCycles'),
      options: CYCLES_CHOICES.map((n) => ({ value: n, label: String(n) })),
    },
    hints: { label: t('settingHints'), options: onOff },
    difficulty: {
      label: t('settingDifficulty'),
      options: DIFFICULTY_CHOICES.map((value) => ({
        value,
        label: t(value === 'easy' ? 'optEasy' : 'optMixed'),
      })),
    },
    guessFeed: {
      label: t('settingGuessFeed'),
      options: GUESS_FEED_CHOICES.map((value) => ({
        value,
        label: t(value === 'all' ? 'optAll' : value === 'clean' ? 'optClean' : 'optOff'),
      })),
    },
    autoAdvance: { label: t('settingAutoAdvance'), options: onOff },
  };
}

const SETTING_KEYS = [
  'drawSeconds',
  'cycles',
  'hints',
  'difficulty',
  'guessFeed',
  'autoAdvance',
] as const satisfies readonly ChoiceKey[];

/** The token Screen's lobby button that opens the settings panel. */
export function SettingsButton({
  ref,
  open,
  onOpen,
  t,
  className,
}: {
  ref?: Ref<HTMLButtonElement>;
  open: boolean;
  onOpen: () => void;
  t: Translate;
  /** The lobby's look for it (F62: a small hand-bordered paper button). */
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
      {t('settings')} <span aria-hidden="true">⚙</span>
    </button>
  );
}

/**
 * The token Screen's lobby settings, mounted while open: the three presets (a client-side shortcut
 * that sends `host:settings` with their values) and every setting. The lobby keeps it collapsed
 * behind "Settings ⚙"; the defaults are good enough that most hosts never open it. Each tap sends
 * `host:settings`; the buttons show the room's settings from the latest snapshot, never a guess at
 * the result. Done or Esc closes it.
 */
export function ScreenSettings({
  settings,
  categories,
  socket,
  t,
  onClose,
  children,
}: {
  settings: RoomSettings;
  /** The host block's visible categories, for the picker. */
  categories: readonly LobbyCategoryView[];
  socket: GameSocket;
  t: Translate;
  onClose: () => void;
  /** Below the settings: the crown phone's players list (F25). */
  children?: ReactNode;
}) {
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialog = useRef<HTMLDivElement>(null);

  useEffect(() => {
    dialog.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const send = async (changes: Partial<RoomSettings>) => {
    if (sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await socket.timeout(5000).emitWithAck('host:settings', changes);
      if (!res.ok) setError(t(res.error === 'rateLimited' ? 'tooFast' : 'settingsFailed'));
      // The pick this device remembers for the next room it hosts (Host controls, Categories).
      else if (changes.categories) saveCategoryPick(changes.categories);
    } catch {
      setError(t('settingsFailed'));
    } finally {
      setSending(false);
    }
  };

  return (
    <SettingsPanel
      ref={dialog}
      settings={settings}
      categories={categories}
      sending={sending}
      error={error}
      onSend={send}
      onClose={onClose}
      t={t}
    >
      {children}
    </SettingsPanel>
  );
}

/** The open panel: presets, then every setting. Rendered from `settings` alone. */
export function SettingsPanel({
  ref,
  settings,
  categories,
  sending,
  error,
  onSend,
  onClose,
  t,
  children,
}: {
  ref?: Ref<HTMLDivElement>;
  settings: RoomSettings;
  categories: readonly LobbyCategoryView[];
  sending: boolean;
  error: string | null;
  onSend: (changes: Partial<RoomSettings>) => void;
  onClose: () => void;
  t: Translate;
  children?: ReactNode;
}) {
  const preset = presetOf(settings);
  const table = rows(t);
  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-title"
      tabIndex={-1}
      data-sheet="settings"
      className={`${FULL_SHEET} px-[max(5vmin,env(safe-area-inset-left))] pt-[max(3vmin,env(safe-area-inset-top))] pb-[max(12vmin,env(safe-area-inset-bottom))] text-[max(3.2vmin,16px)] outline-none`}
    >
      <div className="mx-auto flex max-w-[150vmin] flex-col gap-[2vmin]">
        <div className="flex items-center justify-between gap-[3vmin]">
          <h2 id="settings-title" className={`${SHEET_TITLE} text-[max(5vmin,26px)]`}>
            {t('settings')} <span aria-hidden="true">⚙</span>
          </h2>
          <button type="button" onClick={onClose} className={sheetButton('primary')}>
            {t('settingsDone')}
          </button>
        </div>

        <fieldset className="flex flex-col gap-[1vmin]">
          <legend className="mb-[1vmin] text-soft">
            {t('presets')}
            {preset === null && <> · {t('presetCustom')}</>}
          </legend>
          <div className="grid grid-cols-1 gap-[2vmin] [@media(min-aspect-ratio:1/1)]:grid-cols-3">
            {PRESET_IDS.map((id) => (
              <button
                key={id}
                type="button"
                aria-pressed={preset === id}
                aria-disabled={sending}
                onClick={() => {
                  if (!sending) onSend(PRESETS[id].settings);
                }}
                className={`${OPTION} flex flex-col items-center py-[1.5vmin]`}
              >
                <span className="text-[max(3.5vmin,18px)]">{t(PRESET_COPY[id].label)}</span>
                <span>
                  {t('secondsShort', { n: PRESETS[id].settings.drawSeconds })} ·{' '}
                  {PRESETS[id].settings.cycles === 1
                    ? t('roundOne')
                    : t('rounds', { n: PRESETS[id].settings.cycles })}
                </span>
                <span>{t(PRESET_COPY[id].note)}</span>
              </button>
            ))}
          </div>
        </fieldset>

        <div className="grid grid-cols-1 gap-x-[3vmin] gap-y-[2vmin] [@media(min-aspect-ratio:1/1)]:grid-cols-2 [@media(min-aspect-ratio:16/10)]:grid-cols-3">
          {SETTING_KEYS.map((key) => (
            <SettingRow
              key={key}
              label={table[key].label}
              options={table[key].options as Option<typeof key>[]}
              value={settings[key]}
              disabled={sending}
              onPick={(value) => onSend({ [key]: value })}
            />
          ))}
        </div>

        <CategoryChips
          categories={categories}
          chosen={settings.categories}
          disabled={sending}
          onPick={(ids) => onSend({ categories: ids })}
          t={t}
        />

        <p role="status" className="min-h-[1.5em] text-red">
          {error ?? ''}
        </p>
        {children}
      </div>
    </div>
  );
}

/**
 * Categories (Host controls): one chip per visible category with its emoji, title and word count,
 * ticked when it is in the game; a tap toggles it. Presets never change these.
 */
function CategoryChips({
  categories,
  chosen,
  disabled,
  onPick,
  t,
}: {
  categories: readonly LobbyCategoryView[];
  chosen: readonly string[];
  disabled: boolean;
  onPick: (ids: string[]) => void;
  t: Translate;
}) {
  return (
    <fieldset className="flex flex-col gap-[1vmin]" data-settings="categories">
      <legend className="mb-[1vmin] text-soft">{t('settingCategories')}</legend>
      {categories.length === 0 ? (
        <p className="text-soft">{t('categoriesNone')}</p>
      ) : (
        <div className="flex flex-wrap gap-[1.2vmin]">
          {categories.map((c) => {
            const on = chosen.includes(c.id);
            return (
              <button
                key={c.id}
                type="button"
                aria-pressed={on}
                aria-disabled={disabled}
                onClick={() => {
                  if (!disabled) onPick(toggleCategory(chosen, c.id));
                }}
                className={`${OPTION} inline-flex max-w-full items-center gap-[1vmin] text-left`}
              >
                <span aria-hidden="true" className="w-[1.2em] shrink-0 text-center">
                  {on ? '✓' : ''}
                </span>
                <span aria-hidden="true" className="shrink-0">
                  {c.emoji}
                </span>
                <span className="min-w-0 break-words">{c.title}</span>
                {/* Soft grey is too faint on the highlighter, so a ticked chip's count is ink. */}
                <span className={on ? 'shrink-0' : 'shrink-0 text-soft'}>
                  · {t('categoryWords', { n: c.wordCount })}
                </span>
              </button>
            );
          })}
        </div>
      )}
      {/* A hint, not a block: custom words alone can still make a game. Start says it too. */}
      {categories.length > 0 && !categories.some((c) => chosen.includes(c.id)) && (
        <p className="text-soft">{t('pickCategory')}</p>
      )}
    </fieldset>
  );
}

function SettingRow<K extends ChoiceKey>({
  label,
  options,
  value,
  disabled,
  onPick,
}: {
  label: string;
  options: Option<K>[];
  value: RoomSettings[K];
  disabled: boolean;
  onPick: (value: RoomSettings[K]) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-[1vmin]">
      <legend className="mb-[1vmin] text-soft">{label}</legend>
      <div className="flex flex-wrap gap-[1.2vmin]">
        {options.map((option) => (
          <button
            key={String(option.value)}
            type="button"
            aria-pressed={option.value === value}
            aria-disabled={disabled}
            onClick={() => {
              if (!disabled && option.value !== value) onPick(option.value);
            }}
            className={OPTION}
          >
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
