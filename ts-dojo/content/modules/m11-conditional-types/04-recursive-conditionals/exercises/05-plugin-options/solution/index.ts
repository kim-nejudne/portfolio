// A plugin has a name and a setup function that takes its options.
// `never` accepts every parameter type, so any setup fits (lesson 11.2).
export interface Plugin {
  name: string;
  setup: (options: never) => string;
}

// OptionsOf<P>: the options a plugin's setup takes; {} for a setup that takes none.
// A setup without parameters fits the second pattern too, with O left empty, which is
// unknown, and unknown in a union swallows every other member. So it is caught first.
export type OptionsOf<P> = P extends { setup: () => string }
  ? {}
  : P extends { setup: (options: infer O) => string }
    ? O
    : never;

// UnionToIntersection<U>: A | B becomes A & B.
// The inner condition distributes: one function per member, taking that member. Inferring
// one parameter from a union of functions intersects the candidates.
export type UnionToIntersection<U> = (
  U extends unknown ? (x: U) => void : never
) extends (x: infer I) => void
  ? I
  : never;

// One object type instead of an intersection (lesson 10.1).
type Simplify<T> = { [K in keyof T]: T[K] };

// AppOptions<P>: one object type with the options of every plugin in P.
// P[number] is the union of the plugins, and OptionsOf distributes over it.
export type AppOptions<P extends readonly Plugin[]> = Simplify<
  UnionToIntersection<OptionsOf<P[number]>>
>;

// createApp(plugins, options): runs each plugin's setup with the options, in order, and
// returns one line per plugin, `name: <what setup returned>`.
// Callers see the generic overload. AppOptions<P> is deferred inside a generic body, so the
// implementation has plain types, as lesson 11.1 did for parse.
export function createApp<P extends readonly Plugin[]>(
  plugins: P,
  options: AppOptions<P>,
): string[];
export function createApp(
  plugins: readonly { name: string; setup: (options: unknown) => string }[],
  options: unknown,
): string[] {
  return plugins.map((plugin) => `${plugin.name}: ${plugin.setup(options)}`);
}
