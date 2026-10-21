// `/settings` (spec §6, §7; §12 F10): theme, relative numbers, font size, default timeout, the
// vimrc and the compiler defaults, each written to the §7 settings object the moment it is valid
// (the two text areas on Save). Nothing here applies a setting itself: the theme
// (src/app/theme.ts), the font size (src/app/font-size.ts), every open editor
// (src/editor/controller.ts) and `/repl`'s project follow the settings writes, this tab's or
// another's, so every change applies without a reload. The run deadline is read at each run.
// Keyboard: native controls in Tab order; the global keys stay out of the text fields.
import { useState } from 'react';
import { cn } from 'cn';
import { Input } from '@/components/ui/input';
import { DEFAULT_TIMEOUT_MS } from '@/protocol/sandbox';
import {
  FONT_SIZE,
  THEME_PREFERENCES,
  TIMEOUT_RANGE,
  writeSettings,
  type ThemePreference,
} from '@/store/settings';
import { useSettings } from '@/store/use-settings';
import { CompilerDefaultsField } from './settings/compiler-field';
import {
  effectiveRelativeNumbers,
  parseFontSize,
  parseTimeout,
  type Parsed,
} from './settings/model';
import { VimrcField } from './settings/vimrc-field';

const THEME_LABELS: Record<ThemePreference, string> = {
  system: 'System',
  light: 'Light',
  dark: 'Dark',
};

export function SettingsPage() {
  const settings = useSettings();
  return (
    <section className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Kept in this browser and included in the progress export. A change
          applies at once, in every open tab.
        </p>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">Theme</legend>
        <div className="flex flex-wrap gap-4">
          {THEME_PREFERENCES.map((theme) => (
            <label key={theme} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="theme"
                value={theme}
                checked={(settings.theme ?? 'system') === theme}
                onChange={() => writeSettings({ theme })}
              />
              {THEME_LABELS[theme]}
            </label>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          System follows the operating system. <code>:set bg=dark</code> and{' '}
          <code>:set bg=light</code> in the editor change it too.
        </p>
      </fieldset>

      <div className="flex flex-col gap-2">
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={effectiveRelativeNumbers(settings)}
            onChange={(event) =>
              writeSettings({ relativeNumbers: event.target.checked })
            }
          />
          Relative line numbers
        </label>
        <p className="text-xs text-muted-foreground">
          The same as <code>:set rnu</code> and <code>:set nornu</code>; when
          neither was chosen, the vimrc&apos;s <code>set rnu</code> decides.
        </p>
      </div>

      <NumberField
        id="font-size"
        label="Font size"
        unit="px"
        min={FONT_SIZE.min}
        max={FONT_SIZE.max}
        stored={settings.fontSize ?? FONT_SIZE.default}
        parse={parseFontSize}
        onValid={(fontSize) => writeSettings({ fontSize })}
        description="The editor and the code blocks in lessons."
      />

      <NumberField
        id="default-timeout"
        label="Default timeout"
        unit="ms"
        min={TIMEOUT_RANGE.min}
        max={TIMEOUT_RANGE.max}
        stored={settings.defaultTimeoutMs ?? DEFAULT_TIMEOUT_MS}
        parse={parseTimeout}
        onValid={(defaultTimeoutMs) => writeSettings({ defaultTimeoutMs })}
        description="How long a run may take before it is killed: in /repl, for Run in a lesson, and for exercises that set no timeout of their own."
      />

      <VimrcField stored={settings.vimrc} />

      <CompilerDefaultsField stored={settings.compilerDefaults} />
    </section>
  );
}

interface NumberFieldProps {
  id: string;
  label: string;
  unit: string;
  min: number;
  max: number;
  stored: number;
  parse: (text: string) => Parsed<number>;
  onValid: (value: number) => void;
  description: string;
}

/** Written as soon as the text is a valid value; an invalid one is explained and not written. */
function NumberField(props: NumberFieldProps) {
  const [draft, setDraft] = useState(String(props.stored));
  const [seen, setSeen] = useState(props.stored);
  // A write from elsewhere (another tab, an import) replaces the text shown.
  if (seen !== props.stored) {
    setSeen(props.stored);
    setDraft(String(props.stored));
  }
  const parsed = props.parse(draft);
  const helpId = `${props.id}-help`;
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={props.id} className="text-sm font-medium">
        {props.label} ({props.unit})
      </label>
      <Input
        id={props.id}
        type="number"
        inputMode="numeric"
        min={props.min}
        max={props.max}
        step={1}
        value={draft}
        onChange={(event) => {
          const text = event.target.value;
          setDraft(text);
          const next = props.parse(text);
          if (next.ok && next.value !== props.stored) props.onValid(next.value);
        }}
        aria-invalid={!parsed.ok}
        aria-describedby={helpId}
        className="w-36"
      />
      <p
        id={helpId}
        className={cn(
          'text-xs',
          parsed.ok ? 'text-muted-foreground' : 'text-destructive',
        )}
      >
        {parsed.ok
          ? props.description
          : `${props.label} must be ${parsed.error}; nothing was saved.`}
      </p>
    </div>
  );
}
