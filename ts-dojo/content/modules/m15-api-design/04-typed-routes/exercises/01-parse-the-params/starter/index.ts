// The parameters of a route pattern: a string property for each segment that starts with `:`.
export type Params<P extends string> = Record<string, string>;
