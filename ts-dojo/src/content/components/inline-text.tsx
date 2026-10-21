// Short content text with its code spans shown as code (src/content/inline-code.ts): hints, and
// the question and explanation of a Check yourself or `predict` question.
import { codeSpans } from '../inline-code';

export function InlineText({ text }: { text: string }) {
  return codeSpans(text).map((span, index) =>
    span.code ? (
      <code
        key={index}
        className="rounded bg-muted px-1 py-0.5 font-mono text-[0.9em]"
      >
        {span.text}
      </code>
    ) : (
      span.text
    ),
  );
}
