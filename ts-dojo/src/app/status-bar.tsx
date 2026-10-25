// The status bar under every page (the terminal restyle, 25 October 2026), in the shape of a
// vim or tmux status line: the app's name as the mode block, the current route, and the two
// theme controls, `theme: catppuccin ▾` and `mode: system ▾`. Each is a Base UI Select
// (src/components/ui/select.tsx), so it is keyboard-reachable with a visible focus state and
// its list shows the ANSI swatches of every scheme in the mode in force. A choice writes the §7
// settings object (`scheme`, `theme`); src/app/theme.ts applies it, here and in every tab.
import { useLocation } from 'react-router';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectItemText,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  THEME_PREFERENCES,
  isThemePreference,
  writeSettings,
  type ThemePreference,
} from '@/store/settings';
import { useSettings } from '@/store/use-settings';
import type { AnsiColors } from '@/theme/palette';
import { SCHEMES, isSchemeId } from '@/theme/schemes';
import { DARK_QUERY, resolveScheme, resolveTheme } from './theme';

const SWATCHES = [
  'black',
  'red',
  'green',
  'yellow',
  'blue',
  'magenta',
  'cyan',
  'white',
] as const satisfies readonly (keyof AnsiColors)[];

function systemDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia(DARK_QUERY).matches;
}

export function StatusBar() {
  const { pathname } = useLocation();
  const settings = useSettings();
  const scheme = resolveScheme(settings.scheme);
  const preference = settings.theme ?? 'system';
  const mode = resolveTheme(preference, systemDark());
  return (
    <footer
      role="contentinfo"
      aria-label="Status bar"
      className="flex h-7 shrink-0 items-stretch border-t font-mono text-xs"
    >
      <span className="flex items-center bg-primary px-2 font-semibold text-primary-foreground">
        ts-dojo
      </span>
      <span
        className="hidden min-w-0 items-center truncate px-2 text-muted-foreground sm:flex"
        data-field="route"
      >
        {pathname}
      </span>
      <span className="ml-auto flex items-stretch">
        <SchemePicker value={scheme} mode={mode} />
        <ModePicker value={preference} />
      </span>
    </footer>
  );
}

function SchemePicker({
  value,
  mode,
}: {
  value: string;
  mode: 'light' | 'dark';
}) {
  return (
    <Select
      value={value}
      onValueChange={(next) => {
        if (isSchemeId(next)) writeSettings({ scheme: next });
      }}
    >
      <SelectTrigger id="scheme-picker" aria-label="Colour scheme">
        <span className="text-muted-foreground">theme:</span>
        <SelectValue />
      </SelectTrigger>
      <SelectContent aria-label="Colour schemes">
        {SCHEMES.map((scheme) => (
          <SelectItem key={scheme.id} value={scheme.id}>
            <SelectItemText>{scheme.id}</SelectItemText>
            <span className="text-muted-foreground">{scheme[mode].name}</span>
            <Swatches ansi={scheme[mode].ansi} />
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function ModePicker({ value }: { value: ThemePreference }) {
  return (
    <Select
      value={value}
      onValueChange={(next) => {
        if (isThemePreference(next)) writeSettings({ theme: next });
      }}
    >
      <SelectTrigger id="mode-picker" aria-label="Light or dark mode">
        <span className="text-muted-foreground">mode:</span>
        <SelectValue />
      </SelectTrigger>
      <SelectContent aria-label="Modes">
        {THEME_PREFERENCES.map((preference) => (
          <SelectItem key={preference} value={preference}>
            <SelectItemText>{preference}</SelectItemText>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** The scheme's eight normal ANSI colours, as a terminal emulator's theme preview shows them. */
function Swatches({ ansi }: { ansi: AnsiColors }) {
  return (
    <span className="ml-auto inline-flex gap-px pl-2" aria-hidden="true">
      {SWATCHES.map((name) => (
        <i
          key={name}
          className="block size-2"
          style={{ background: ansi[name] }}
        />
      ))}
    </span>
  );
}
