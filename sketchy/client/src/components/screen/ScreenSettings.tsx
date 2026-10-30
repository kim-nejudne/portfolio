import { type Ref, useEffect, useRef, useState } from 'react';
import {
  COPY_LANGUAGES,
  CYCLES_CHOICES,
  DIFFICULTY_CHOICES,
  DRAW_SECONDS_CHOICES,
  GUESS_FEED_CHOICES,
  PRESETS,
  WORDS_CHOICES,
  type PresetId,
} from '../../../../shared/constants.js';
import type { RoomSettings } from '../../../../shared/types.js';
import type { CopyKey, Translate } from '../../lib/copy.js';
import { PRESET_IDS, presetOf } from '../../lib/settings.js';
import type { GameSocket } from '../../lib/socket.js';

const PRESET_COPY: Record<PresetId, { label: CopyKey; note: CopyKey }> = {
  quick: { label: 'presetQuick', note: 'presetQuickNote' },
  classic: { label: 'presetClassic', note: 'presetClassicNote' },
  barkadaNight: { label: 'presetBarkadaNight', note: 'presetBarkadaNightNote' },
};

export const presetLabel = (t: Translate, id: PresetId) => t(PRESET_COPY[id].label);

const ON_OFF = [true, false] as const;

type Option<K extends keyof RoomSettings> = { value: RoomSettings[K]; label: string };

/** Every setting in the Settings table, in its order, with its allowed values. */
function rows(t: Translate): {
  [K in keyof RoomSettings]: { label: string; options: Option<K>[] };
} {
  const onOff = ON_OFF.map((value) => ({ value, label: t(value ? 'optOn' : 'optOff') }));
  const language = { en: t('optEnglish'), taglish: t('optTaglish'), mixed: t('optMixed') };
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
    words: {
      label: t('settingWords'),
      options: WORDS_CHOICES.map((value) => ({ value, label: language[value] })),
    },
    spicy: { label: t('settingSpicy'), options: [...onOff].reverse() },
    guessFeed: {
      label: t('settingGuessFeed'),
      options: GUESS_FEED_CHOICES.map((value) => ({
        value,
        label: t(value === 'all' ? 'optAll' : value === 'clean' ? 'optClean' : 'optOff'),
      })),
    },
    copy: {
      label: t('settingCopy'),
      options: COPY_LANGUAGES.map((value) => ({ value, label: language[value] })),
    },
    autoAdvance: { label: t('settingAutoAdvance'), options: onOff },
  };
}

const SETTING_KEYS = [
  'drawSeconds',
  'cycles',
  'hints',
  'difficulty',
  'words',
  'spicy',
  'guessFeed',
  'copy',
  'autoAdvance',
] as const satisfies readonly (keyof RoomSettings)[];

const pill =
  'min-h-11 min-w-11 rounded-[1.5vmin] px-[2vmin] py-[0.8vmin] font-bold focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-white aria-pressed:bg-[#FF6B35] aria-pressed:text-[#1D1B22] bg-white/10 aria-disabled:opacity-60';

/** The token Screen's lobby button that opens the settings panel. */
export function SettingsButton({
  ref,
  open,
  onOpen,
  t,
}: {
  ref?: Ref<HTMLButtonElement>;
  open: boolean;
  onOpen: () => void;
  t: Translate;
}) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onOpen}
      aria-haspopup="dialog"
      aria-expanded={open}
      className="min-h-11 min-w-11 rounded-[2vmin] bg-white/10 px-[3vmin] py-[1vmin] text-[max(3vmin,16px)] font-bold focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-white"
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
  socket,
  t,
  onClose,
}: {
  settings: RoomSettings;
  socket: GameSocket;
  t: Translate;
  onClose: () => void;
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
      if (!res.ok) setError(t('settingsFailed'));
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
      sending={sending}
      error={error}
      onSend={send}
      onClose={onClose}
      t={t}
    />
  );
}

/** The open panel: presets, then every setting. Rendered from `settings` alone. */
export function SettingsPanel({
  ref,
  settings,
  sending,
  error,
  onSend,
  onClose,
  t,
}: {
  ref?: Ref<HTMLDivElement>;
  settings: RoomSettings;
  sending: boolean;
  error: string | null;
  onSend: (changes: Partial<RoomSettings>) => void;
  onClose: () => void;
  t: Translate;
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
      className="absolute inset-0 z-20 overflow-y-auto overscroll-contain bg-[#1D1B22] px-[5vmin] py-[3vmin] text-[max(3.2vmin,16px)] outline-none"
    >
      <div className="mx-auto flex max-w-[150vmin] flex-col gap-[2vmin]">
        <div className="flex items-center justify-between gap-[3vmin]">
          <h2 id="settings-title" className="font-display text-[max(5vmin,26px)] font-bold">
            {t('settings')} <span aria-hidden="true">⚙</span>
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 min-w-11 rounded-[2vmin] bg-[#FF6B35] px-[4vmin] py-[1vmin] text-[max(3.5vmin,18px)] font-bold text-[#1D1B22] focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            {t('settingsDone')}
          </button>
        </div>

        <fieldset className="flex flex-col gap-[1vmin]">
          <legend className="mb-[1vmin] text-white/80">
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
                className={`${pill} flex flex-col items-center py-[1.5vmin]`}
              >
                <span className="text-[max(3.5vmin,18px)]">{t(PRESET_COPY[id].label)}</span>
                <span className="font-normal">
                  {t('secondsShort', { n: PRESETS[id].settings.drawSeconds })} ·{' '}
                  {PRESETS[id].settings.cycles === 1
                    ? t('roundOne')
                    : t('rounds', { n: PRESETS[id].settings.cycles })}
                </span>
                <span className="font-normal">{t(PRESET_COPY[id].note)}</span>
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

        <p role="status" className="min-h-[1.5em] text-[#FFD166]">
          {error ?? ''}
        </p>
      </div>
    </div>
  );
}

function SettingRow<K extends keyof RoomSettings>({
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
      <legend className="mb-[1vmin] text-white/80">{label}</legend>
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
            className={pill}
          >
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
