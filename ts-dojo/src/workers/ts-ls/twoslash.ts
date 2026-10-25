// Twoslash queries in the editor (spec §4 Type feedback): a line matching `//\s*\^\?` asks for
// the quick info at the `^` column on the line above. This finds the sites; the core answers
// them. A site has no offset when there is no line above or the `^` is past the end of it,
// which the core reports as an error entry (§12 F2).

export const TWOSLASH_QUERY_LINE = /^(\s*)\/\/(\s*)\^\?/;

export interface TwoslashQuerySite {
  /** 1-based line of the `^?` comment. */
  line: number;
  /** 1-based column of the `^`. */
  column: number;
  /** 0-based offset of the character under the `^` on the line above, or null when there is none. */
  offset: number | null;
}

export function findTwoslashQueries(text: string): TwoslashQuerySite[] {
  const sites: TwoslashQuerySite[] = [];
  let lineStart = 0;
  let previousStart = 0;
  let previousLength = -1;
  text.split('\n').forEach((raw, index) => {
    const line = raw.endsWith('\r') ? raw.slice(0, -1) : raw;
    const match = TWOSLASH_QUERY_LINE.exec(line);
    if (match !== null) {
      const caret =
        (match[1] as string).length + 2 + (match[2] as string).length;
      const offset =
        index > 0 && caret < previousLength ? previousStart + caret : null;
      sites.push({ line: index + 1, column: caret + 1, offset });
    }
    previousStart = lineStart;
    previousLength = line.length;
    lineStart += raw.length + 1;
  });
  return sites;
}
