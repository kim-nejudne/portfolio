// A version: major, minor, then an optional patch.
export type Version = [major: number, minor: number, patch?: number];

// A package: the name never changes, the description may be left out,
// and code that reads the keywords can't change the list.
export type Package = {
  readonly name: string;
  version: Version;
  description?: string;
  keywords: readonly string[];
};
