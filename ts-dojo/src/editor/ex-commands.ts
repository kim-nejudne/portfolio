// The §4 ex command table as data: every command and alias, what its row says, how its
// arguments parse into an EditorAction, and how it is registered with `Vim.defineEx`. The
// palette (§6) and the `?` overlay render this same table, so nothing is listed twice. `:set`
// is the engine's own command (its options are defined with `Vim.defineOption` in
// options.ts) and is listed here only for the palette and the overlay.
import type {
  Background,
  EditorAction,
  FocusDirection,
  LayoutMode,
  Pane,
} from './host';

/** One name the engine accepts: `defineEx(name, prefix)`; `prefix` is the shortest form (`w` for `write`). */
export interface ExName {
  name: string;
  prefix?: string;
}

export interface ExCommand {
  /** As the §4 table shows it: `:w`, `:b <file>`. */
  label: string;
  /** The row's aliases, shown as typed: `:run`. */
  aliases: string[];
  /** Every name registered with the engine; empty for a command the engine owns. */
  names: ExName[];
  /** The row's "Does" column. */
  description: string;
  /** The argument forms the palette lists as their own items (`:focus left`). */
  variants?: string[];
  /** A free argument (`<file>`); the palette opens the command line pre-filled. */
  argument?: string;
  /** Turns the argument string into an action, or a message for a bad argument. */
  parse?: (args: string) => EditorAction | string;
  /** The §12 feature whose page proves the row (F3 for the editor's own rows). */
  feature: string;
}

const PANES: Record<string, Pane> = {
  theory: 'theory',
  practice: 'editor',
  output: 'output',
};
const DIRECTIONS: readonly FocusDirection[] = ['left', 'right', 'up', 'down'];
const LAYOUTS: readonly LayoutMode[] = ['split', 'theory', 'practice'];
const BACKGROUNDS: readonly Background[] = ['dark', 'light'];

const noArgs =
  (action: EditorAction) =>
  (args: string): EditorAction | string =>
    args === '' ? action : `:${action.type} takes no argument`;

const oneOf =
  <T extends string>(
    label: string,
    choices: readonly T[],
    make: (choice: T) => EditorAction,
  ) =>
  (args: string): EditorAction | string => {
    const choice = choices.find((c) => c === args);
    return choice === undefined
      ? `${label} takes one of: ${choices.join(', ')}`
      : make(choice);
  };

const paneFocus = (word: string): ExCommand => {
  const pane = PANES[word];
  if (pane === undefined) throw new Error(`no pane named ${word}`);
  return {
    label: `:${word}`,
    aliases: [],
    names: [{ name: word }],
    description: 'Focuses that pane.',
    parse: noArgs({ type: 'focusPane', pane }),
    feature: 'F8',
  };
};

/** The §4 table in its order; one entry per command (a row that lists several commands gives several entries). */
export const EX_COMMANDS: readonly ExCommand[] = [
  {
    label: ':w',
    aliases: [':run'],
    names: [{ name: 'write', prefix: 'w' }, { name: 'run' }],
    description: 'Transpiles the project and runs the entry file.',
    parse: noArgs({ type: 'run' }),
    feature: 'F4',
  },
  {
    label: ':test',
    aliases: [':t'],
    names: [{ name: 'test', prefix: 't' }],
    description: 'Runs the tests and the full verification (§5).',
    parse: noArgs({ type: 'test' }),
    feature: 'F7',
  },
  {
    label: ':kill',
    aliases: [],
    names: [{ name: 'kill' }],
    description: 'Terminates a running sandbox.',
    parse: noArgs({ type: 'kill' }),
    feature: 'F4',
  },
  {
    label: ':hint',
    aliases: [],
    names: [{ name: 'hint' }],
    description: 'Reveals the next hint.',
    parse: noArgs({ type: 'hint' }),
    feature: 'F8',
  },
  {
    label: ':sol',
    aliases: [':solution'],
    names: [{ name: 'solution', prefix: 'sol' }],
    description:
      'Opens the solution read-only in a split; :sol again closes it.',
    parse: noArgs({ type: 'solution' }),
    feature: 'F8',
  },
  {
    label: ':reset',
    aliases: [],
    names: [{ name: 'reset' }],
    description: 'Restores the starter after a confirmation.',
    parse: noArgs({ type: 'reset' }),
    feature: 'F8',
  },
  {
    label: ':done',
    aliases: [],
    names: [{ name: 'done' }],
    description: "Marks the lesson's theory as read, from either pane.",
    parse: noArgs({ type: 'done' }),
    feature: 'F8',
  },
  {
    label: ':next',
    aliases: [':n'],
    names: [{ name: 'next', prefix: 'n' }],
    description: 'Next exercise; past the last, the next lesson.',
    parse: noArgs({ type: 'next' }),
    feature: 'F8',
  },
  {
    label: ':prev',
    aliases: [':N'],
    names: [{ name: 'prev' }, { name: 'N' }],
    description: 'Previous exercise; before the first, the previous lesson.',
    parse: noArgs({ type: 'prev' }),
    feature: 'F8',
  },
  {
    label: ':lesson next',
    aliases: [],
    names: [{ name: 'lesson' }],
    description: 'Next or previous lesson directly.',
    variants: ['next', 'prev'],
    parse: oneOf(':lesson', ['next', 'prev'] as const, (direction) => ({
      type: 'lesson',
      direction,
    })),
    feature: 'F8',
  },
  {
    label: ':roadmap',
    aliases: [':rm'],
    names: [{ name: 'roadmap' }, { name: 'rm' }],
    description: 'Goes to the roadmap.',
    parse: noArgs({ type: 'roadmap' }),
    feature: 'F3',
  },
  paneFocus('theory'),
  paneFocus('practice'),
  paneFocus('output'),
  {
    label: ':focus left',
    aliases: [],
    names: [{ name: 'focus' }],
    description: 'Pane focus; what Ctrl-h/j/k/l call.',
    variants: [...DIRECTIONS],
    parse: oneOf(':focus', DIRECTIONS, (direction) => ({
      type: 'focusDirection',
      direction,
    })),
    feature: 'F8',
  },
  {
    label: ':layout split',
    aliases: [],
    names: [{ name: 'layout' }],
    description: 'Two panes, or one full width.',
    variants: [...LAYOUTS],
    parse: oneOf(':layout', LAYOUTS, (mode) => ({ type: 'layout', mode })),
    feature: 'F8',
  },
  {
    label: ':prompt',
    aliases: [],
    names: [{ name: 'prompt' }],
    description: 'Shows or hides the exercise prompt above the editor.',
    parse: noArgs({ type: 'prompt' }),
    feature: 'F8',
  },
  {
    label: ':b <file>',
    aliases: [],
    names: [{ name: 'buffer', prefix: 'b' }],
    description:
      'Opens that file tab in a multi-file exercise; a scratch buffer in /repl.',
    argument: '<file>',
    parse: (args) =>
      args === '' ? ':b needs a file name' : { type: 'buffer', name: args },
    feature: 'F3',
  },
  {
    label: ':ls',
    aliases: [],
    names: [{ name: 'ls' }],
    description: 'Lists the file tabs, or the scratch buffers in /repl.',
    parse: noArgs({ type: 'buffers' }),
    feature: 'F3',
  },
  {
    label: ':bnext',
    aliases: [],
    names: [{ name: 'bnext', prefix: 'bn' }],
    description: 'The next file tab; what gt calls.',
    parse: noArgs({ type: 'bnext' }),
    feature: 'F3',
  },
  {
    label: ':bprev',
    aliases: [],
    names: [{ name: 'bprev', prefix: 'bp' }],
    description: 'The previous file tab; what gT calls.',
    parse: noArgs({ type: 'bprev' }),
    feature: 'F3',
  },
  {
    label: ':e <name>',
    aliases: [],
    names: [{ name: 'edit', prefix: 'e' }],
    description: '/repl only: creates or opens a scratch buffer.',
    argument: '<name>',
    parse: (args) =>
      args === '' ? ':e needs a buffer name' : { type: 'edit', name: args },
    feature: 'F5',
  },
  {
    label: ':bd',
    aliases: [],
    names: [{ name: 'bdelete', prefix: 'bd' }],
    description: '/repl only: deletes the scratch buffer after a confirmation.',
    parse: noArgs({ type: 'bdelete' }),
    feature: 'F5',
  },
  {
    label: ':dnext',
    aliases: [],
    names: [{ name: 'dnext' }],
    description: 'The next diagnostic; what ]d calls.',
    parse: noArgs({ type: 'dnext' }),
    feature: 'F3',
  },
  {
    label: ':dprev',
    aliases: [],
    names: [{ name: 'dprev' }],
    description: 'The previous diagnostic; what [d calls.',
    parse: noArgs({ type: 'dprev' }),
    feature: 'F3',
  },
  {
    label: ':info',
    aliases: [],
    names: [{ name: 'info' }],
    description: 'Quick info at the cursor; what K calls.',
    parse: noArgs({ type: 'info' }),
    feature: 'F3',
  },
  {
    label: ':def',
    aliases: [],
    names: [{ name: 'def' }],
    description: 'Go to definition; what gd calls.',
    parse: noArgs({ type: 'def' }),
    feature: 'F3',
  },
  {
    label: ':set rnu',
    aliases: [],
    names: [],
    description: 'Editor and theme options; persisted.',
    variants: ['rnu', 'nornu', 'nu', 'wrap', 'nowrap', 'bg=dark', 'bg=light'],
    feature: 'F3',
  },
  {
    label: ':export',
    aliases: [],
    names: [{ name: 'export' }],
    description: 'Downloads the progress JSON (§7).',
    parse: noArgs({ type: 'export' }),
    feature: 'F9',
  },
  {
    label: ':help',
    aliases: [':h'],
    names: [{ name: 'help', prefix: 'h' }],
    description: 'The keyboard help overlay.',
    parse: noArgs({ type: 'help' }),
    feature: 'F3',
  },
];

/** `Vim.defineEx` as the registry needs it (the engine's own `ExFn` takes the CodeMirror adapter first). */
export type DefineEx = (
  name: string,
  prefix: string | undefined,
  fn: (cm: unknown, params: { argString?: string }) => void,
) => void;

/**
 * Registers every table entry with the engine. A command's argument string is parsed by its
 * row; a bad argument goes to `onError` as a message, a good one to `run`.
 */
export function registerExCommands(
  defineEx: DefineEx,
  run: (action: EditorAction) => void,
  onError: (message: string) => void,
): void {
  for (const command of EX_COMMANDS) {
    const { parse } = command;
    if (parse === undefined) continue;
    for (const { name, prefix } of command.names) {
      defineEx(name, prefix, (_cm, params) => {
        const result = parse((params.argString ?? '').trim());
        if (typeof result === 'string') onError(result);
        else run(result);
      });
    }
  }
}

/** `:set bg=dark` as the engine's option callback sees it; shared with options.ts. */
export function parseBackground(value: unknown): Background | null {
  return BACKGROUNDS.find((b) => b === value) ?? null;
}

/** The `:` input a palette item runs, or null when the item needs typing (`:b <file>`). */
export interface PaletteCommand {
  /** `:focus left`, `:b <file>`. */
  label: string;
  description: string;
  /** The ex input to run, without the colon; null opens the command line pre-filled with `prefill`. */
  input: string | null;
  prefill: string;
  aliases: string[];
}

/** One palette item per command, and per fixed variant where a row has them. */
export function paletteCommands(
  commands: readonly ExCommand[] = EX_COMMANDS,
): PaletteCommand[] {
  const items: PaletteCommand[] = [];
  for (const command of commands) {
    const base = command.label.split(' ')[0] ?? command.label;
    const name = base.slice(1);
    if (command.variants !== undefined) {
      for (const variant of command.variants) {
        items.push({
          label: `${base} ${variant}`,
          description: command.description,
          input: `${name} ${variant}`,
          prefill: `${name} ${variant}`,
          aliases: command.aliases,
        });
      }
    } else if (command.argument !== undefined) {
      items.push({
        label: command.label,
        description: command.description,
        input: null,
        prefill: `${name} `,
        aliases: command.aliases,
      });
    } else {
      items.push({
        label: command.label,
        description: command.description,
        input: name,
        prefill: name,
        aliases: command.aliases,
      });
    }
  }
  return items;
}
