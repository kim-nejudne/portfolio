// shadcn's Input over Base UI, restyled as a prompt line (25 October 2026): square, a 1px
// border, monospace, the caret in the scheme's cursor colour (globals.css), the border in the
// accent while focused. src/components/prompt-line.tsx puts the `❯` glyph before it.
import * as React from 'react';
import { Input as InputPrimitive } from '@base-ui/react/input';
import { cn } from 'cn';

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        'h-8 w-full min-w-0 border border-input bg-transparent px-2 py-1 font-mono text-sm transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive',
        className,
      )}
      {...props}
    />
  );
}

export { Input };
