// A command returns what it prints.
export type Command = () => string;

export interface Cli<C extends string> {
  // Whether name is one of the commands.
  has(name: string): name is C;
  // Runs the named command, or the fallback for a name that isn't one.
  run(name: string): string;
}

// NoInfer: the fallback is checked against the keys instead of outranking them as a candidate.
export function createCli<C extends string>(
  commands: Record<C, Command>,
  fallback: NoInfer<C>,
): Cli<C> {
  // Object.hasOwn skips inherited members such as toString, which `in` would find.
  const has = (name: string): name is C => Object.hasOwn(commands, name);
  return {
    has,
    run: (name) => (has(name) ? commands[name]() : commands[fallback]()),
  };
}

export const dojo = createCli(
  {
    help: () => 'usage: dojo <command>',
    version: () => '1.0.0',
    lessons: () => '62 lessons',
  },
  'help',
);
