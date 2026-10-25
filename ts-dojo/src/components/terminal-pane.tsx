// A terminal window or tmux pane (the terminal restyle, 25 October 2026): a 1px border and a
// title bar, with the three window dots when asked. The styles are `.term-pane`, `.term-title`
// and `.term-dots` in globals.css, shared with the dialogs and the roadmap cards, which draw
// the same bar inside their own elements.
import type React from 'react';
import type { ReactNode } from 'react';
import { cn } from 'cn';

export function TerminalTitle({
  children,
  dots = false,
  className,
}: {
  children?: ReactNode;
  dots?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('term-title', className)}>
      {dots && (
        <span className="term-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
      )}
      {children !== undefined && <span className="truncate">{children}</span>}
    </div>
  );
}

export function TerminalPane({
  title,
  dots = false,
  className,
  bodyClassName,
  children,
  ...rest
}: {
  title: ReactNode;
  dots?: boolean;
  className?: string;
  bodyClassName?: string;
  children?: ReactNode;
} & Omit<React.ComponentProps<'section'>, 'title' | 'className' | 'children'>) {
  return (
    <section className={cn('term-pane flex flex-col', className)} {...rest}>
      <TerminalTitle dots={dots}>{title}</TerminalTitle>
      <div className={cn('flex flex-col gap-2 p-3', bodyClassName)}>
        {children}
      </div>
    </section>
  );
}
