import {
  ANSWER_SECONDS_CHOICES,
  BUZZ_SECONDS_CHOICES,
  FALSE_START_MS_CHOICES,
  SCOREBOARD_EVERY_MAX,
  TEAM_COUNT_CHOICES,
} from '../../../shared/constants.js';
import type { HostView, RoomSettings, ScreenView } from '../../../shared/types.js';
import { HOVER } from '../lib/hover.js';
import type { HostCommand } from '../lib/useHostCommand.js';

interface HostSettingsProps {
  /** The remote's view, or the lobby of a Screen that holds the hostToken (F37). */
  view: HostView | ScreenView;
  command: HostCommand;
  /** Tighter rows for the Screen lobby, where every row and Start game must fit at 1280×720 (F38). */
  compact?: boolean;
}

/** Row sizes: the remote's thumb-sized rows, or the Screen lobby's tighter ones. */
const SIZES = {
  regular: {
    row: 'gap-3 p-4',
    label: 'text-lg',
    detail: 'text-sm',
    stepper: 'size-12 text-2xl',
    value: 'w-16',
    preset: 'h-12 px-3 text-lg',
    track: 'h-8 w-14',
    knob: 'size-6',
  },
  compact: {
    row: 'gap-2 px-3 py-1',
    label: 'text-base',
    // One line per row, and steppers and presets a little shorter than 2rem, so the presets, all
    // eight rows and Start game fit at 1280×720 with no scroll (F65, F73, F83).
    detail: 'sr-only',
    stepper: 'size-7 text-lg',
    value: 'w-12',
    preset: 'h-7 px-2 text-base',
    track: 'h-6 w-11',
    knob: 'size-4',
  },
};

type Sizes = (typeof SIZES)['regular'];

type Preset = Pick<
  RoomSettings,
  'autoOpenBuzzers' | 'wrongPenalty' | 'answerSeconds' | 'buzzSeconds' | 'falseStartMs'
>;

/**
 * Shortcuts that each send one `host:settings` (F73). Both set the same keys, so switching between
 * them leaves nothing behind; Competitive turns auto-open off because a false start needs a locked
 * question. Scoreboard and standings are left as the host set them.
 */
const PRESETS: readonly { name: string; settings: Preset }[] = [
  {
    name: 'Party',
    settings: {
      autoOpenBuzzers: true,
      wrongPenalty: false,
      answerSeconds: 0,
      buzzSeconds: 0,
      falseStartMs: 0,
    },
  },
  {
    name: 'Competitive',
    settings: {
      autoOpenBuzzers: false,
      wrongPenalty: true,
      answerSeconds: 5,
      buzzSeconds: 10,
      falseStartMs: 500,
    },
  },
];

/** True while every key the preset sets has the preset's value. */
function matches(settings: RoomSettings, preset: Preset) {
  return (Object.keys(preset) as (keyof Preset)[]).every((key) => settings[key] === preset[key]);
}

const row = 'flex items-center rounded-2xl border-2 border-edge bg-surface';
// The hover shows only under a mouse: the Screen lobby's settings (F52), never a phone.
const stepper = `rounded-xl border-2 border-edge bg-bg font-display text-accent transition not-disabled:active:scale-95 disabled:text-muted disabled:opacity-40 ${HOVER}`;
const presetButton = `rounded-xl border-2 font-display transition not-disabled:active:scale-95 disabled:opacity-40 ${HOVER}`;

/**
 * The remote's Settings tab (UI spec, Host remote), also shown in a hosting Screen's lobby. Each
 * control sends only the key it changes; the values shown are always the room's, from the latest
 * snapshot.
 */
export function HostSettings({ view, command, compact = false }: HostSettingsProps) {
  const { busy, run } = command;
  const size = compact ? SIZES.compact : SIZES.regular;
  const { settings } = view;
  const change = (patch: Partial<RoomSettings>) => run('host:settings', patch);
  const every = settings.scoreboardEvery;

  return (
    <section aria-label="Settings" className={`flex flex-col ${compact ? 'gap-1.5' : 'gap-3'}`}>
      <div role="group" aria-labelledby="presets-label" className={`${row} ${size.row}`}>
        <p className="flex-1">
          <span id="presets-label" className={`block font-bold ${size.label}`}>
            Presets
          </span>
          <span className={`${size.detail} text-muted`}>Set several switches at once.</span>
        </p>
        {PRESETS.map((preset) => {
          const active = matches(settings, preset.settings);
          return (
            <button
              key={preset.name}
              type="button"
              aria-pressed={active}
              onClick={() => change(preset.settings)}
              disabled={busy}
              className={`${presetButton} ${size.preset} ${
                active ? 'border-accent bg-accent text-accent-ink' : 'border-edge bg-bg text-accent'
              }`}
            >
              {preset.name}
            </button>
          );
        })}
      </div>
      <Switch
        label="Wrong-answer penalty"
        detail="A wrong answer loses the question's points."
        checked={settings.wrongPenalty}
        disabled={busy}
        onChange={(wrongPenalty) => change({ wrongPenalty })}
        size={size}
      />
      <Switch
        label="Auto-open buzzers"
        detail="Open the buzzers as soon as a question appears."
        checked={settings.autoOpenBuzzers}
        disabled={busy}
        onChange={(autoOpenBuzzers) => change({ autoOpenBuzzers })}
        size={size}
      />
      <ChoiceStepper
        id="answer-time-label"
        label="Answer time"
        detail="Seconds the first buzzer has to answer."
        noun="answer time"
        choices={ANSWER_SECONDS_CHOICES}
        value={settings.answerSeconds}
        disabled={busy}
        onChange={(answerSeconds) => change({ answerSeconds })}
        size={size}
      />
      <ChoiceStepper
        id="buzz-time-label"
        label="Buzz time"
        detail="Seconds to buzz in before the answer is revealed."
        noun="buzz time"
        choices={BUZZ_SECONDS_CHOICES}
        value={settings.buzzSeconds}
        disabled={busy}
        onChange={(buzzSeconds) => change({ buzzSeconds })}
        size={size}
      />
      <ChoiceStepper
        id="false-start-label"
        label="False start"
        detail="A press before the buzzers open waits this long after they do."
        noun="false start wait"
        choices={FALSE_START_MS_CHOICES}
        value={settings.falseStartMs}
        disabled={busy}
        onChange={(falseStartMs) => change({ falseStartMs })}
        size={size}
        format={(ms) => `${ms / 1000} s`}
      />
      <div className={`${row} ${size.row}`}>
        <p className="flex-1">
          <span id="scoreboard-every-label" className={`block font-bold ${size.label}`}>
            Scoreboard every
          </span>
          <span className={`${size.detail} text-muted`}>
            Shown on the Screen after that many questions.
          </span>
        </p>
        <button
          type="button"
          aria-label="Fewer questions between scoreboards"
          onClick={() => change({ scoreboardEvery: every - 1 })}
          disabled={busy || every <= 0}
          className={`${stepper} ${size.stepper}`}
        >
          −
        </button>
        <output
          aria-labelledby="scoreboard-every-label"
          className={`${size.value} text-center font-display`}
        >
          {every === 0 ? 'Never' : every}
        </output>
        <button
          type="button"
          aria-label="More questions between scoreboards"
          onClick={() => change({ scoreboardEvery: every + 1 })}
          disabled={busy || every >= SCOREBOARD_EVERY_MAX}
          className={`${stepper} ${size.stepper}`}
        >
          +
        </button>
      </div>
      <Switch
        label="Standings on the Screen"
        detail="The top 5 beside each question."
        checked={settings.showStandings}
        disabled={busy}
        onChange={(showStandings) => change({ showStandings })}
        size={size}
      />
      {/* Only in the lobby or between questions, where the server takes a new count (F83). */}
      <ChoiceStepper
        id="teams-label"
        label="Teams"
        detail="A new count regroups everyone. Only in the lobby or between questions."
        noun="teams"
        less="Fewer teams"
        choices={TEAM_COUNT_CHOICES}
        value={settings.teams}
        disabled={busy || !view.canChangeTeams}
        onChange={(teams) => change({ teams })}
        size={size}
        format={String}
      />
    </section>
  );
}

interface ChoiceStepperProps<T extends number> {
  id: string;
  label: string;
  detail: string;
  /** Names the − and + buttons: "Less answer time", "More answer time". */
  noun: string;
  /** Names the − button instead, where "Less" reads wrong: "Fewer teams". */
  less?: string;
  /** The allowed values, shortest first; 0 shows as Off. */
  choices: readonly T[];
  value: T;
  disabled: boolean;
  onChange: (value: T) => void;
  size: Sizes;
  /** Shows a value other than 0; whole seconds unless given. */
  format?: (value: T) => string;
}

/**
 * A row that steps through a fixed list of values: the answer time, buzz time, false start and
 * team count.
 */
function ChoiceStepper<T extends number>({
  id,
  label,
  detail,
  noun,
  less = `Less ${noun}`,
  choices,
  value,
  disabled,
  onChange,
  size,
  format = (seconds) => `${seconds} s`,
}: ChoiceStepperProps<T>) {
  const step = choices.indexOf(value);
  const shorter = choices[step - 1];
  const longer = choices[step + 1];
  return (
    <div className={`${row} ${size.row}`}>
      <p className="flex-1">
        <span id={id} className={`block font-bold ${size.label}`}>
          {label}
        </span>
        <span className={`${size.detail} text-muted`}>{detail}</span>
      </p>
      <button
        type="button"
        aria-label={less}
        onClick={() => shorter !== undefined && onChange(shorter)}
        disabled={disabled || shorter === undefined}
        className={`${stepper} ${size.stepper}`}
      >
        −
      </button>
      <output aria-labelledby={id} className={`${size.value} text-center font-display`}>
        {value === 0 ? 'Off' : format(value)}
      </output>
      <button
        type="button"
        aria-label={`More ${noun}`}
        onClick={() => longer !== undefined && onChange(longer)}
        disabled={disabled || longer === undefined}
        className={`${stepper} ${size.stepper}`}
      >
        +
      </button>
    </div>
  );
}

interface SwitchProps {
  label: string;
  detail: string;
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
  size: Sizes;
}

function Switch({ label, detail, checked, disabled, onChange, size }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      disabled={disabled}
      className={`${row} ${size.row} text-left transition disabled:opacity-40 ${HOVER}`}
    >
      <span className="flex-1">
        <span className={`block font-bold ${size.label}`}>{label}</span>
        <span className={`${size.detail} text-muted`}>{detail}</span>
      </span>
      <span
        aria-hidden
        className={`flex ${size.track} shrink-0 items-center rounded-full border-2 px-0.5 transition ${
          checked ? 'justify-end border-accent bg-accent' : 'justify-start border-edge bg-bg'
        }`}
      >
        <span className={`${size.knob} rounded-full ${checked ? 'bg-accent-ink' : 'bg-muted'}`} />
      </span>
    </button>
  );
}
