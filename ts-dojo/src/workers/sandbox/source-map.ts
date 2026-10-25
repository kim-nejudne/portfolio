// Inline source maps (§4 Running: runtime errors and console lines show the TypeScript file and
// line "mapped through the inline source map"). `ts.transpileModule` with `inlineSourceMap`
// appends `//# sourceMappingURL=data:application/json;base64,...` to each module; Chrome does
// not apply maps to `Error.stack`, so the worker decodes the v3 mappings itself. Pure.

export interface SourceMapV3 {
  version: number;
  sources: string[];
  mappings: string;
  names?: string[];
  sourceRoot?: string;
}

/** One generated-column → original-position segment. */
interface Segment {
  generatedColumn: number;
  source: number;
  line: number;
  column: number;
}

export interface DecodedSourceMap {
  sources: string[];
  /** Per generated line (0-based), segments sorted by generated column. */
  lines: Segment[][];
}

export interface OriginalPosition {
  source: string;
  /** 1-based. */
  line: number;
  /** 1-based. */
  column: number;
}

const INLINE_MAP =
  /\/\/[#@]\s*sourceMappingURL=data:application\/json(?:;charset=[^;,]+)?;base64,([A-Za-z0-9+/=]+)\s*$/;

const BASE64 =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function decodeBase64(text: string): string {
  const bytes = Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/** Decodes one VLQ run (`mappings` segments): the values and where the next one starts. */
function decodeVlq(text: string, from: number, to: number): number[] {
  const values: number[] = [];
  let shift = 0;
  let value = 0;
  for (let i = from; i < to; i += 1) {
    const digit = BASE64.indexOf(text[i] as string);
    if (digit === -1) throw new Error(`bad VLQ character ${text[i] as string}`);
    value += (digit & 31) << shift;
    if ((digit & 32) !== 0) {
      shift += 5;
      continue;
    }
    values.push((value & 1) !== 0 ? -(value >> 1) : value >> 1);
    shift = 0;
    value = 0;
  }
  return values;
}

export function decodeMappings(mappings: string): Segment[][] {
  const lines: Segment[][] = [];
  let source = 0;
  let line = 0;
  let column = 0;
  for (const lineText of mappings.split(';')) {
    const segments: Segment[] = [];
    let generatedColumn = 0;
    if (lineText !== '') {
      for (const segmentText of lineText.split(',')) {
        const fields = decodeVlq(segmentText, 0, segmentText.length);
        generatedColumn += fields[0] ?? 0;
        if (fields.length >= 4) {
          source += fields[1] ?? 0;
          line += fields[2] ?? 0;
          column += fields[3] ?? 0;
          segments.push({ generatedColumn, source, line, column });
        }
      }
    }
    lines.push(segments);
  }
  return lines;
}

/** The inline map at the end of `js`, or null when there is none. */
export function parseInlineSourceMap(js: string): DecodedSourceMap | null {
  const match = INLINE_MAP.exec(js);
  if (match === null) return null;
  let raw: SourceMapV3;
  try {
    raw = JSON.parse(decodeBase64(match[1] as string)) as SourceMapV3;
  } catch {
    return null;
  }
  if (raw.version !== 3 || !Array.isArray(raw.sources)) return null;
  const root = raw.sourceRoot ?? '';
  return {
    sources: raw.sources.map((s) => root + s),
    lines: decodeMappings(raw.mappings),
  };
}

/** The original position for a 1-based generated line and column: the nearest segment at or before the column. */
export function originalPosition(
  map: DecodedSourceMap,
  line: number,
  column: number,
): OriginalPosition | null {
  const segments = map.lines[line - 1];
  if (segments === undefined || segments.length === 0) return null;
  const target = column - 1;
  let best: Segment | null = null;
  for (const segment of segments) {
    if (segment.generatedColumn > target) break;
    best = segment;
  }
  best ??= segments[0] ?? null;
  if (best === null) return null;
  const source = map.sources[best.source];
  if (source === undefined) return null;
  return { source, line: best.line + 1, column: best.column + 1 };
}
