// Code spans in short content text (spec §3 `exercise.yaml` hints, §1 Check yourself and
// `predict` questions): plain text in which a pair of backticks marks code, as Markdown writes
// it and as §3's hint example does. Nothing else is parsed; a lone backtick stays as it is.

export interface Span {
  code: boolean;
  text: string;
}

const CODE_SPAN = /`([^`]+)`/g;

export function codeSpans(text: string): Span[] {
  const spans: Span[] = [];
  let at = 0;
  for (const match of text.matchAll(CODE_SPAN)) {
    if (match.index > at) {
      spans.push({ code: false, text: text.slice(at, match.index) });
    }
    spans.push({ code: true, text: match[1] as string });
    at = match.index + match[0].length;
  }
  if (at < text.length) spans.push({ code: false, text: text.slice(at) });
  return spans;
}

export function hasCodeSpan(text: string): boolean {
  return codeSpans(text).some((span) => span.code);
}

/** The text a reader sees: the code spans without their backticks. */
export function shownText(text: string): string {
  return codeSpans(text)
    .map((span) => span.text)
    .join('');
}
