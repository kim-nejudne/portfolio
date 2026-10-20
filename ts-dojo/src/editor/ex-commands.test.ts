// The §4 ex command table (§12 F3: "every ex command in §4 does what its row says"): every
// command and alias is registered once, each parses into the action its row describes, and the
// palette lists the whole table. The engine is replaced by a recording `defineEx`.
import { describe, expect, it } from 'vitest';
import type { EditorAction } from './host.ts';
import {
  EX_COMMANDS,
  paletteCommands,
  parseBackground,
  parseExInput,
  registerExCommands,
  type DefineEx,
} from './ex-commands.ts';

interface Registered {
  name: string;
  prefix: string | undefined;
  fn: Parameters<DefineEx>[2];
}

function register() {
  const registered: Registered[] = [];
  const actions: EditorAction[] = [];
  const errors: string[] = [];
  registerExCommands(
    (name, prefix, fn) => registered.push({ name, prefix, fn }),
    (action) => actions.push(action),
    (message) => errors.push(message),
  );
  const run = (name: string, argString = ''): void => {
    const entry = registered.find((r) => r.name === name);
    if (entry === undefined) throw new Error(`${name} is not registered`);
    entry.fn({}, { argString });
  };
  return { registered, actions, errors, run };
}

/** The §4 table's command column, in its order, as the row labels. */
const SPEC_LABELS = [
  ':w',
  ':test',
  ':kill',
  ':hint',
  ':sol',
  ':reset',
  ':done',
  ':next',
  ':prev',
  ':lesson next',
  ':roadmap',
  ':theory',
  ':practice',
  ':output',
  ':focus left',
  ':layout split',
  ':prompt',
  ':b <file>',
  ':ls',
  ':bnext',
  ':bprev',
  ':e <name>',
  ':bd',
  ':dnext',
  ':dprev',
  ':info',
  ':def',
  ':set rnu',
  ':export',
  ':help',
];

describe('EX_COMMANDS (the §4 table)', () => {
  it('lists every §4 row in order with its aliases', () => {
    expect(EX_COMMANDS.map((c) => c.label)).toEqual(SPEC_LABELS);
    const aliases = Object.fromEntries(
      EX_COMMANDS.filter((c) => c.aliases.length > 0).map((c) => [
        c.label,
        c.aliases,
      ]),
    );
    expect(aliases).toEqual({
      ':w': [':run'],
      ':test': [':t'],
      ':sol': [':solution'],
      ':next': [':n'],
      ':prev': [':N'],
      ':roadmap': [':rm'],
      ':help': [':h'],
    });
    for (const command of EX_COMMANDS) {
      expect(command.description.length, command.label).toBeGreaterThan(0);
    }
  });

  it('registers every name once, with a prefix that is a prefix of the name', () => {
    const { registered } = register();
    const names = registered.map((r) => r.name);
    expect(new Set(names).size).toBe(names.length);
    for (const { name, prefix } of registered) {
      if (prefix !== undefined)
        expect(name.startsWith(prefix), name).toBe(true);
    }
    expect(names).toEqual(
      expect.arrayContaining([
        'write',
        'run',
        'test',
        'kill',
        'hint',
        'solution',
        'reset',
        'done',
        'next',
        'prev',
        'N',
        'lesson',
        'roadmap',
        'rm',
        'theory',
        'practice',
        'output',
        'focus',
        'layout',
        'prompt',
        'buffer',
        'ls',
        'bnext',
        'bprev',
        'edit',
        'bdelete',
        'dnext',
        'dprev',
        'info',
        'def',
        'export',
        'help',
      ]),
    );
    // `:set` is the engine's own command: never redefined.
    expect(names).not.toContain('set');
    // The spec's short forms are the engine prefixes.
    const prefixOf = Object.fromEntries(
      registered.map((r) => [r.name, r.prefix]),
    );
    expect(prefixOf['write']).toBe('w');
    expect(prefixOf['test']).toBe('t');
    expect(prefixOf['next']).toBe('n');
    expect(prefixOf['help']).toBe('h');
    expect(prefixOf['solution']).toBe('sol');
    expect(prefixOf['buffer']).toBe('b');
    expect(prefixOf['edit']).toBe('e');
    expect(prefixOf['bdelete']).toBe('bd');
  });

  it('parses each command and alias into the action its row describes', () => {
    const { run, actions, errors } = register();
    run('write');
    run('run');
    run('test');
    run('kill');
    run('hint');
    run('solution');
    run('reset');
    run('done');
    run('next');
    run('prev');
    run('N');
    run('lesson', ' next');
    run('lesson', 'prev');
    run('roadmap');
    run('rm');
    run('theory');
    run('practice');
    run('output');
    run('focus', 'left');
    run('focus', ' down ');
    run('layout', 'theory');
    run('prompt');
    run('buffer', ' shapes.ts');
    run('ls');
    run('bnext');
    run('bprev');
    run('edit', 'scratch');
    run('bdelete');
    run('dnext');
    run('dprev');
    run('info');
    run('def');
    run('export');
    run('help');
    expect(errors).toEqual([]);
    expect(actions).toEqual([
      { type: 'run' },
      { type: 'run' },
      { type: 'test' },
      { type: 'kill' },
      { type: 'hint' },
      { type: 'solution' },
      { type: 'reset' },
      { type: 'done' },
      { type: 'next' },
      { type: 'prev' },
      { type: 'prev' },
      { type: 'lesson', direction: 'next' },
      { type: 'lesson', direction: 'prev' },
      { type: 'roadmap' },
      { type: 'roadmap' },
      { type: 'focusPane', pane: 'theory' },
      { type: 'focusPane', pane: 'editor' },
      { type: 'focusPane', pane: 'output' },
      { type: 'focusDirection', direction: 'left' },
      { type: 'focusDirection', direction: 'down' },
      { type: 'layout', mode: 'theory' },
      { type: 'prompt' },
      { type: 'buffer', name: 'shapes.ts' },
      { type: 'buffers' },
      { type: 'bnext' },
      { type: 'bprev' },
      { type: 'edit', name: 'scratch' },
      { type: 'bdelete' },
      { type: 'dnext' },
      { type: 'dprev' },
      { type: 'info' },
      { type: 'def' },
      { type: 'export' },
      { type: 'help' },
    ]);
  });

  it('reports a bad or missing argument instead of running', () => {
    const { run, actions, errors } = register();
    run('focus', 'sideways');
    run('layout', '');
    run('lesson', 'first');
    run('buffer', '');
    run('edit', '');
    run('write', 'now');
    expect(actions).toEqual([]);
    expect(errors).toEqual([
      ':focus takes one of: left, right, up, down',
      ':layout takes one of: split, theory, practice',
      ':lesson takes one of: next, prev',
      ':b needs a file name',
      ':e needs a buffer name',
      ':run takes no argument',
    ]);
  });

  it('parseBackground accepts exactly dark and light', () => {
    expect(parseBackground('dark')).toBe('dark');
    expect(parseBackground('light')).toBe('light');
    expect(parseBackground('sepia')).toBeNull();
    expect(parseBackground(undefined)).toBeNull();
  });
});

describe('paletteCommands (§6: every ex command in the Ctrl-p palette)', () => {
  it('lists one item per command, one per fixed variant, and a pre-filled line for a free argument', () => {
    const items = paletteCommands();
    const byLabel = Object.fromEntries(items.map((i) => [i.label, i]));
    expect(byLabel[':w']).toMatchObject({ input: 'w', aliases: [':run'] });
    expect(byLabel[':focus left']).toMatchObject({ input: 'focus left' });
    expect(byLabel[':focus down']).toMatchObject({ input: 'focus down' });
    expect(byLabel[':layout practice']).toMatchObject({
      input: 'layout practice',
    });
    expect(byLabel[':lesson prev']).toMatchObject({ input: 'lesson prev' });
    expect(byLabel[':set bg=dark']).toMatchObject({ input: 'set bg=dark' });
    expect(byLabel[':set nowrap']).toMatchObject({ input: 'set nowrap' });
    expect(byLabel[':b <file>']).toMatchObject({ input: null, prefill: 'b ' });
    expect(byLabel[':e <name>']).toMatchObject({ input: null, prefill: 'e ' });
    expect(byLabel[':help']).toMatchObject({ input: 'help', aliases: [':h'] });
    // Every table entry is represented.
    for (const command of EX_COMMANDS) {
      const base = command.label.split(' ')[0] ?? '';
      expect(
        items.some((i) => i.label.startsWith(base)),
        command.label,
      ).toBe(true);
    }
    expect(items.length).toBe(
      EX_COMMANDS.reduce((n, c) => n + (c.variants?.length ?? 1), 0),
    );
  });
});

describe('parseExInput (the palette without an editor, F8)', () => {
  it('turns every palette item with a fixed input into its action', () => {
    for (const item of paletteCommands()) {
      if (item.input === null) continue;
      const parsed = parseExInput(item.input);
      if (item.label.startsWith(':set')) {
        expect(parsed, item.label).toBeNull();
        continue;
      }
      expect(typeof parsed, item.label).toBe('object');
    }
    expect(parseExInput('next')).toEqual({ type: 'next' });
    expect(parseExInput('n')).toEqual({ type: 'next' });
    expect(parseExInput('focus left')).toEqual({
      type: 'focusDirection',
      direction: 'left',
    });
    expect(parseExInput('layout theory')).toEqual({
      type: 'layout',
      mode: 'theory',
    });
  });

  it('gives the row’s message for a bad argument and null for an unknown command', () => {
    expect(parseExInput('layout wide')).toBe(
      ':layout takes one of: split, theory, practice',
    );
    expect(parseExInput('frobnicate')).toBeNull();
    expect(parseExInput('')).toBeNull();
  });
});
