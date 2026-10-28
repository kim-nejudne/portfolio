import { ANSWER_SECONDS_CHOICES, SCOREBOARD_EVERY_MAX } from '../../../shared/constants.js';
import type { HostView, RoomSettings, ScreenView } from '../../../shared/types.js';
import type { HostCommand } from '../lib/useHostCommand.js';

interface HostSettingsProps {
  /** The remote's view, or the lobby of a Screen that holds the hostToken (F37). */
  view: HostView | ScreenView;
  command: HostCommand;
}

const stepper =
  'size-12 rounded-xl border-2 border-edge font-display text-2xl transition not-disabled:active:scale-95 disabled:opacity-40';

/**
 * The remote's Settings tab (UI spec, Host remote), also shown in a hosting Screen's lobby. Each
 * control sends only the key it changes; the values shown are always the room's, from the latest
 * snapshot.
 */
export function HostSettings({ view, command }: HostSettingsProps) {
  const { busy, run } = command;
  const { settings } = view;
  const change = (patch: Partial<RoomSettings>) => run('host:settings', patch);
  const every = settings.scoreboardEvery;
  const answerStep = ANSWER_SECONDS_CHOICES.indexOf(settings.answerSeconds);
  const shorter = ANSWER_SECONDS_CHOICES[answerStep - 1];
  const longer = ANSWER_SECONDS_CHOICES[answerStep + 1];

  return (
    <section aria-label="Settings" className="flex flex-col gap-3">
      <Switch
        label="Wrong-answer penalty"
        detail="A wrong answer loses the question's points."
        checked={settings.wrongPenalty}
        disabled={busy}
        onChange={(wrongPenalty) => change({ wrongPenalty })}
      />
      <Switch
        label="Auto-open buzzers"
        detail="Open the buzzers as soon as a question appears."
        checked={settings.autoOpenBuzzers}
        disabled={busy}
        onChange={(autoOpenBuzzers) => change({ autoOpenBuzzers })}
      />
      <div className="flex items-center gap-3 rounded-2xl border-2 border-edge bg-surface p-4">
        <p className="flex-1">
          <span id="answer-time-label" className="block text-lg">
            Answer time
          </span>
          <span className="text-sm text-muted">Seconds the first buzzer has to answer.</span>
        </p>
        <button
          type="button"
          aria-label="Less answer time"
          onClick={() => shorter !== undefined && change({ answerSeconds: shorter })}
          disabled={busy || shorter === undefined}
          className={stepper}
        >
          −
        </button>
        <output aria-labelledby="answer-time-label" className="w-16 text-center font-display">
          {settings.answerSeconds === 0 ? 'Off' : `${settings.answerSeconds} s`}
        </output>
        <button
          type="button"
          aria-label="More answer time"
          onClick={() => longer !== undefined && change({ answerSeconds: longer })}
          disabled={busy || longer === undefined}
          className={stepper}
        >
          +
        </button>
      </div>
      <div className="flex items-center gap-3 rounded-2xl border-2 border-edge bg-surface p-4">
        <p className="flex-1">
          <span id="scoreboard-every-label" className="block text-lg">
            Scoreboard every
          </span>
          <span className="text-sm text-muted">Shown on the Screen after that many questions.</span>
        </p>
        <button
          type="button"
          aria-label="Fewer questions between scoreboards"
          onClick={() => change({ scoreboardEvery: every - 1 })}
          disabled={busy || every <= 0}
          className={stepper}
        >
          −
        </button>
        <output aria-labelledby="scoreboard-every-label" className="w-16 text-center font-display">
          {every === 0 ? 'Never' : every}
        </output>
        <button
          type="button"
          aria-label="More questions between scoreboards"
          onClick={() => change({ scoreboardEvery: every + 1 })}
          disabled={busy || every >= SCOREBOARD_EVERY_MAX}
          className={stepper}
        >
          +
        </button>
      </div>
    </section>
  );
}

interface SwitchProps {
  label: string;
  detail: string;
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}

function Switch({ label, detail, checked, disabled, onChange }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      disabled={disabled}
      className="flex items-center gap-3 rounded-2xl border-2 border-edge bg-surface p-4 text-left transition disabled:opacity-40"
    >
      <span className="flex-1">
        <span className="block text-lg">{label}</span>
        <span className="text-sm text-muted">{detail}</span>
      </span>
      <span
        aria-hidden
        className={`flex h-8 w-14 shrink-0 items-center rounded-full p-1 transition ${
          checked ? 'justify-end bg-accent' : 'justify-start bg-edge'
        }`}
      >
        <span className="size-6 rounded-full bg-ink" />
      </span>
    </button>
  );
}
