// A prompt line (the terminal restyle, 25 October 2026): the `❯` glyph in the accent colour
// before a text field, which keeps its own label and id. Decorative, so the glyph is hidden
// from assistive technology.
import type { ReactNode } from 'react';
import { cn } from 'cn';

export function PromptLine({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn('prompt-line inline-flex items-center gap-2', className)}
    >
      <span className="prompt-glyph" aria-hidden="true">
        ❯
      </span>
      {children}
    </span>
  );
}
