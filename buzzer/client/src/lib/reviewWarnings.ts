// The level review's warnings (F123): an answer or a question that repeats within the category, and
// text long enough to shrink a lot on the Screen. They inform the admin and never block anything.
import { QUESTION_LONG_TEXT } from '../../../shared/constants.js';
import type { Question } from '../../../shared/types.js';

/** A level's questions as the warnings compare them, with the name its references use ("Medium"). */
export interface ReviewLevel {
  name: string;
  questions: readonly Pick<Question, 'id' | 'text' | 'answer'>[];
}

/** How much of the longer text the shorter must be for containment to count as nearly the same. */
export const NEAR_SHARE = 0.8;

/**
 * Text as the comparisons read it: trimmed, case- and accent-folded, punctuation dropped and runs of
 * spaces made one. "  The Nîle! " and "the nile" fold alike.
 */
export function foldText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Two folded question texts are equal, or one holds the other and is at least 80% of its length.
 * Empty text (a picture-only question) matches nothing.
 */
export function nearlySame(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  return short.length >= NEAR_SHARE * long.length && long.includes(short);
}

/** Question text longer than `QUESTION_LONG_TEXT`, trimmed, shrinks a lot on the Screen. */
export const isLongText = (text: string) => text.trim().length > QUESTION_LONG_TEXT;

/** "Q6", "Q6 and Medium Q4", "Q2, Q6 and Medium Q4". */
function listed(refs: readonly string[]): string {
  if (refs.length <= 1) return refs.join('');
  return `${refs.slice(0, -1).join(', ')} and ${refs.at(-1)}`;
}

/**
 * Each question's warnings, by question id; a question without any is left out. `level` is the one
 * being reviewed; `others` are the category's other levels (each its draft when it has one, else
 * live). A question of `level` is "Q4"; one of another level is "<name> Q4". A question is never
 * compared with itself.
 */
export function reviewWarnings(
  level: ReviewLevel,
  others: readonly ReviewLevel[],
): Map<string, string[]> {
  const folded = (l: ReviewLevel, own: boolean) =>
    l.questions.map((q, index) => ({
      id: q.id,
      ref: own ? `Q${index + 1}` : `${l.name} Q${index + 1}`,
      text: foldText(q.text),
      answer: foldText(q.answer),
    }));
  const mine = folded(level, true);
  const all = [...mine, ...others.flatMap((l) => folded(l, false))];

  const warnings = new Map<string, string[]>();
  level.questions.forEach((question, index) => {
    const me = mine[index]!;
    const rest = all.filter((other) => other !== me);
    const lines: string[] = [];

    const sameAnswer = me.answer ? rest.filter((o) => o.answer === me.answer) : [];
    if (sameAnswer.length > 0) lines.push(`Same answer as ${listed(sameAnswer.map((o) => o.ref))}`);

    const equal = rest.filter((o) => me.text && o.text === me.text);
    const near = rest.filter((o) => o.text !== me.text && nearlySame(me.text, o.text));
    if (equal.length > 0) lines.push(`Same question as ${listed(equal.map((o) => o.ref))}`);
    if (near.length > 0) {
      lines.push(`Nearly the same question as ${listed(near.map((o) => o.ref))}`);
    }

    const length = question.text.trim().length;
    if (isLongText(question.text)) {
      lines.push(`Long question (${length} characters): it shows small on the Screen`);
    }

    if (lines.length > 0) warnings.set(me.id, lines);
  });
  return warnings;
}

/** All the warnings' lines, for the footer's "2 warnings". */
export function warningCount(warnings: ReadonlyMap<string, readonly string[]>): number {
  let count = 0;
  for (const lines of warnings.values()) count += lines.length;
  return count;
}
