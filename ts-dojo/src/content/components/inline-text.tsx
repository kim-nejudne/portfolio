// Short content text with its code spans shown as code (src/content/inline-code.ts): hints, and
// the question and explanation of a Check yourself or `predict` question.
import { codeSpans } from '../inline-code';

export function InlineText({ text }: { text: string }) {
  return codeSpans(text).map((span, index) =>
    span.code ? (
      <code key={index} className="bg-muted px-1 font-mono text-[0.95em]">
        {span.text}
      </code>
    ) : (
      span.text
    ),
  );
}
