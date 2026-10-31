import { CANVAS_COLOR, DRAW_COLORS } from '../../../../shared/constants.js';
import type { PadState } from '../../ink/padTools.js';
import type { Translate } from '../../lib/copy.js';
import { DRAWER_TOOL_ROW_PX } from '../../lib/phone.js';
import { cycleSize, pickColor, toggleEraser, type DrawTool } from '../../lib/tools.js';

const COLOUR_NAMES = [
  'colourBlack',
  'colourRed',
  'colourOrange',
  'colourYellow',
  'colourGreen',
  'colourBlue',
  'colourPurple',
  'colourBrown',
] as const;
const SIZE_NAMES = ['sizeSmall', 'sizeMedium', 'sizeLarge'] as const;
const SIZE_LETTERS = ['S', 'M', 'L'] as const;
/** The size button's dot, in CSS px, for S/M/L (4/10/24 grid units, compressed to stay visible). */
const SIZE_DOT_PX = [6, 12, 22] as const;

interface SwatchProps {
  tool: DrawTool;
  onTool: (tool: DrawTool) => void;
  disabled?: boolean;
  t: Translate;
  className?: string;
}

/**
 * The 8 colour swatches (Sketchbook): wobbly 40 px crayons in a 2.5 px `ink` ring, in 44 px
 * buttons. The pen's colour gets a `pen` outline, none while the eraser is on. Shared by the
 * drawer's toolbar and the lobby doodle pad.
 */
export function ColourSwatches({ tool, onTool, disabled, t, className = '' }: SwatchProps) {
  return (
    <div role="group" aria-label={t('colours')} className={className}>
      {DRAW_COLORS.map((colour, i) => {
        const on = !tool.eraser && tool.color === i;
        return (
          <button
            key={colour}
            type="button"
            aria-label={t(COLOUR_NAMES[i]!)}
            aria-pressed={on}
            disabled={disabled}
            onClick={() => onTool(pickColor(tool, i))}
            // Hover brightens the ring instead of the button wash, which the swatch would hide.
            className="group grid size-11 shrink-0 place-items-center rounded-full hover:bg-none disabled:opacity-40"
          >
            <span
              aria-hidden
              style={{ background: colour }}
              className={`wobbly block size-10 border-[2.5px] border-ink ${
                on ? 'outline-[3px] outline-offset-[1px] outline-pen' : ''
              }`}
            />
          </button>
        );
      })}
    </div>
  );
}

/**
 * One hand-bordered button that cycles S → M → L, shown as a dot of that size (the pen's colour,
 * the canvas's while erasing) and the letter in Nunito.
 */
export function SizeButton({ tool, onTool, disabled, t, className = '' }: SwatchProps) {
  const dot = SIZE_DOT_PX[tool.size] ?? SIZE_DOT_PX[1];
  return (
    <button
      type="button"
      aria-label={t('brushSize', { size: t(SIZE_NAMES[tool.size] ?? 'sizeMedium') })}
      disabled={disabled}
      onClick={() => onTool(cycleSize(tool))}
      className={`sketch-border flex min-h-11 min-w-11 items-center justify-center gap-1.5 bg-paper px-2 font-num font-black text-ink hover:bg-none disabled:opacity-40 ${className}`.trim()}
    >
      <span className="grid size-6 place-items-center" aria-hidden>
        <span
          style={{
            width: dot,
            height: dot,
            background: tool.eraser ? CANVAS_COLOR : DRAW_COLORS[tool.color],
          }}
          className="block rounded-full border border-ink"
        />
      </span>
      <span aria-hidden>{SIZE_LETTERS[tool.size]}</span>
    </button>
  );
}

interface ToolbarProps {
  tool: DrawTool;
  onTool: (tool: DrawTool) => void;
  pad: PadState;
  onUndo: () => void;
  onClear: () => void;
  /** Paused: nothing to change until it lifts. */
  disabled: boolean;
  t: Translate;
}

/** The toolbar's line icons, drawn in `pen` (the mockup's eraser, undo and clear). */
const ICONS = {
  eraser: 'M4 16 L12 8 L18 14 L12 20 L7 20 Z M9 11 L15 17 M12 20 L20 20',
  undo: 'M9 7 L4 11 L9 15 M4 11 L14 11 Q20 11 20 16 Q20 20 15 20',
  clear: 'M5 5 L19 19 M19 5 L5 19',
} as const;

function PenIcon({ name }: { name: keyof typeof ICONS }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-5 shrink-0 text-pen"
    >
      <path d={ICONS[name]} />
    </svg>
  );
}

/**
 * The drawer's two 48 px toolbar rows under the pad (Drawer layout, Sketchbook Drawer): the 8
 * crayons, then the hand-bordered Size, Eraser, Undo and Clear, each with a `pen` icon. The eraser
 * is on the highlighter while it's on. Undo and Clear are greyed out when they would do nothing.
 */
export function DrawToolbar({ tool, onTool, pad, onUndo, onClear, disabled, t }: ToolbarProps) {
  // Four equal shares of the row: the labels scale with the width so Taglish "Pambura" still fits
  // its share at 360 px (as long as the Size button stays this small).
  const button =
    'sketch-border flex h-11 min-w-0 flex-1 items-center justify-center gap-0.5 overflow-hidden px-0.5 text-[clamp(0.875rem,4.4vw,1.0625rem)] leading-none whitespace-nowrap text-ink hover:bg-none disabled:opacity-40';
  return (
    <>
      <div
        style={{ height: DRAWER_TOOL_ROW_PX }}
        className="flex w-full shrink-0 items-center justify-center px-1"
      >
        <ColourSwatches
          tool={tool}
          onTool={onTool}
          disabled={disabled}
          t={t}
          className="flex w-full max-w-md items-center justify-between"
        />
      </div>
      <div
        style={{ height: DRAWER_TOOL_ROW_PX }}
        className="mx-auto flex w-full max-w-md shrink-0 items-center gap-1.5 px-1"
      >
        <SizeButton
          tool={tool}
          onTool={onTool}
          disabled={disabled}
          t={t}
          className="h-11 min-w-0 flex-1"
        />
        <button
          type="button"
          aria-pressed={tool.eraser}
          disabled={disabled}
          onClick={() => onTool(toggleEraser(tool))}
          className={`${button} ${tool.eraser ? 'bg-hl' : 'bg-paper'}`}
        >
          <PenIcon name="eraser" />
          {t('eraser')}
        </button>
        <button
          type="button"
          disabled={disabled || !pad.canUndo}
          onClick={onUndo}
          className={`${button} bg-paper`}
        >
          <PenIcon name="undo" />
          {t('undo')}
        </button>
        <button
          type="button"
          disabled={disabled || !pad.canClear}
          onClick={onClear}
          className={`${button} bg-paper`}
        >
          <PenIcon name="clear" />
          {t('clear')}
        </button>
      </div>
    </>
  );
}
