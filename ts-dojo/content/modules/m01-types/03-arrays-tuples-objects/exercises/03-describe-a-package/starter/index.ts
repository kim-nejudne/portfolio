// A first draft. Rewrite both types to match the prompt.

// A version: major, minor, then an optional patch.
export type Version = number[];

// A package: the name never changes, the description may be left out,
// and code that reads the keywords can't change the list.
export type Package = {
  name: string;
  version: Version;
  description: string;
  keywords: string[];
};
