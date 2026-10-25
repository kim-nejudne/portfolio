// The page's globals. This file has no import or export, so it is a script, and what it
// declares is global: index.ts and the tests see it without an import. Declare BUILD and
// track here.
declare const BUILD: { version: string; debug: boolean };
declare function track(event: string, data: { version: string }): void;
