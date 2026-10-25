// A command returns what it prints.
export type Command = () => string;

export interface Cli<C extends string> {
  // Whether name is one of the commands.
  has(name: string): name is C;
  // Runs the named command, or the fallback for a name that isn't one.
  run(name: string): string;
}

export function createCli<C extends string>(
  commands: Record<C, Command>,
  fallback: C,
): Cli<C> {
  return {
    has: (name) => Object.hasOwn(commands, name),
    run: (name) => commands[name](),
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
