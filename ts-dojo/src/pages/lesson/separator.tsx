// The theory/practice split's handle (§6: "The split defaults to 40/60 and can be dragged").
// A focusable `separator`: drag it with the pointer, or move it 5% at a time with `h`/`l` or
// the arrow keys when it has focus.
import { useRef } from 'react';

export const SPLIT_DEFAULT = 40;
export const SPLIT_MIN = 20;
export const SPLIT_MAX = 80;
const STEP = 5;

const clamp = (value: number): number =>
  Math.round(Math.max(SPLIT_MIN, Math.min(SPLIT_MAX, value)));

export function Separator({
  ratio,
  onChange,
}: {
  /** The theory pane's share, in percent. */
  ratio: number;
  onChange: (ratio: number) => void;
}) {
  const handle = useRef<HTMLDivElement>(null);
  const onKeyDown = (event: React.KeyboardEvent): void => {
    if (event.ctrlKey || event.altKey || event.metaKey) return;
    if (event.key === 'ArrowLeft' || event.key === 'h') {
      onChange(clamp(ratio - STEP));
    } else if (event.key === 'ArrowRight' || event.key === 'l') {
      onChange(clamp(ratio + STEP));
    } else return;
    event.preventDefault();
  };
  const onPointerDown = (event: React.PointerEvent): void => {
    const container = handle.current?.parentElement;
    if (container === null || container === undefined) return;
    event.preventDefault();
    const rect = container.getBoundingClientRect();
    const move = (moved: PointerEvent): void => {
      onChange(clamp(((moved.clientX - rect.left) / rect.width) * 100));
    };
    const up = (): void => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  return (
    /* eslint-disable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex -- a focusable separator is a widget in ARIA (window splitter pattern); jsx-a11y counts the role as static */
    <div
      ref={handle}
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize theory and practice"
      aria-valuenow={ratio}
      aria-valuemin={SPLIT_MIN}
      aria-valuemax={SPLIT_MAX}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      className="hidden w-1.5 shrink-0 cursor-col-resize bg-border outline-none hover:bg-ring focus:bg-ring md:block"
    />
    /* eslint-enable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex */
  );
}
