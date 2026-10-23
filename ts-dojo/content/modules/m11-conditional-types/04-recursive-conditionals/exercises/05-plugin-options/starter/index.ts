// A plugin has a name and a setup function that takes its options.
// `never` accepts every parameter type, so any setup fits (lesson 11.2).
export interface Plugin {
  name: string;
  setup: (options: never) => string;
}

// OptionsOf<P>: the options a plugin's setup takes; {} for a setup that takes none.
export type OptionsOf<P> = unknown;

// UnionToIntersection<U>: A | B becomes A & B.
export type UnionToIntersection<U> = unknown;

// AppOptions<P>: one object type with the options of every plugin in P.
export type AppOptions<P extends readonly Plugin[]> = unknown;

// createApp(plugins, options): runs each plugin's setup with the options, in order, and
// returns one line per plugin, `name: <what setup returned>`.
export function createApp<P extends readonly Plugin[]>(
  plugins: P,
  options: AppOptions<P>,
): string[] {
  throw new Error(
    `not implemented: ${plugins.length} plugins, ${String(options)}`,
  );
}
