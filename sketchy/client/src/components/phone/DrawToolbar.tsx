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
 * The 8 colour swatches: 40 px circles in 44 px buttons. The pen's colour is ringed, none while
 * the eraser is on. A thin light border keeps the black swatch visible on the dark page.
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
              className={`block size-10 rounded-full ${
                on
                  ? 'border-[3px] border-white outline-2 outline-[#FF6B35]'
                  : 'border-2 border-white/35 group-enabled:group-hover:border-white/80'
              }`}
            />
          </button>
        );
      })}
    </div>
  );
}

/** One button that cycles S → M → L, shown as a dot of that size: the pen's colour, white while erasing. */
export function SizeButton({ tool, onTool, disabled, t, className = '' }: SwatchProps) {
  const dot = SIZE_DOT_PX[tool.size] ?? SIZE_DOT_PX[1];
  return (
    <button
      type="button"
      aria-label={t('brushSize', { size: t(SIZE_NAMES[tool.size] ?? 'sizeMedium') })}
      disabled={disabled}
      onClick={() => onTool(cycleSize(tool))}
      className={`flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-xl bg-white/15 px-2 font-bold text-white disabled:opacity-40 ${className}`}
    >
      <span className="grid size-6 place-items-center" aria-hidden>
        <span
          style={{
            width: dot,
            height: dot,
            background: tool.eraser ? CANVAS_COLOR : DRAW_COLORS[tool.color],
          }}
          className="block rounded-full border border-white/70"
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

/**
 * The drawer's two 48 px toolbar rows under the pad (Drawer layout): the 8 colours, then the size
 * button, Eraser, Undo and Clear. Undo and Clear are greyed out when they would do nothing.
 */
export function DrawToolbar({ tool, onTool, pad, onUndo, onClear, disabled, t }: ToolbarProps) {
  const button =
    'min-h-11 min-w-0 flex-1 rounded-xl px-1 font-bold whitespace-nowrap disabled:opacity-40';
  return (
    <>
      <div
        style={{ height: DRAWER_TOOL_ROW_PX }}
        className="flex w-full shrink-0 items-center justify-center"
      >
        <ColourSwatches
          tool={tool}
          onTool={onTool}
          disabled={disabled}
          t={t}
          className="flex w-full max-w-md items-center justify-evenly"
        />
      </div>
      <div
        style={{ height: DRAWER_TOOL_ROW_PX }}
        className="flex w-full max-w-md shrink-0 items-center gap-2 px-1"
      >
        <SizeButton tool={tool} onTool={onTool} disabled={disabled} t={t} className="flex-1" />
        <button
          type="button"
          aria-pressed={tool.eraser}
          disabled={disabled}
          onClick={() => onTool(toggleEraser(tool))}
          className={`${button} ${tool.eraser ? 'bg-[#FF6B35] text-[#1D1B22]' : 'bg-white/15 text-white'}`}
        >
          {t('eraser')}
        </button>
        <button
          type="button"
          disabled={disabled || !pad.canUndo}
          onClick={onUndo}
          className={`${button} bg-white/15 text-white`}
        >
          {t('undo')}
        </button>
        <button
          type="button"
          disabled={disabled || !pad.canClear}
          onClick={onClear}
          className={`${button} bg-white/15 text-white`}
        >
          {t('clear')}
        </button>
      </div>
    </>
  );
}
