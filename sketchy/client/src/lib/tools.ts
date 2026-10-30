// The drawer's tools (Canvas and drawing tools, Tools): one of the 8 colours, a size (S/M/L) and
// the eraser, which paints the canvas colour (colour index 8) at the chosen size. The pen colour is
// kept while erasing, so tapping Eraser again goes back to it; tapping a colour leaves the eraser.

import {
  DEFAULT_INK_SIZE,
  DRAW_COLORS,
  ERASER_COLOR_INDEX,
  INK_SIZES,
} from '../../../shared/constants.js';

export interface DrawTool {
  /** 0–7, the pen's palette colour. */
  color: number;
  /** 0, 1, 2 = S, M, L. */
  size: number;
  eraser: boolean;
}

export const DEFAULT_TOOL: DrawTool = { color: 0, size: DEFAULT_INK_SIZE, eraser: false };

/** The `color` a new stroke carries: the pen's, or 8 for the eraser. */
export function inkColor(tool: DrawTool): number {
  return tool.eraser ? ERASER_COLOR_INDEX : tool.color;
}

export function pickColor(tool: DrawTool, color: number): DrawTool {
  if (!Number.isInteger(color) || color < 0 || color >= DRAW_COLORS.length) return tool;
  return { ...tool, color, eraser: false };
}

/** S → M → L → S. */
export function cycleSize(tool: DrawTool): DrawTool {
  return { ...tool, size: (tool.size + 1) % INK_SIZES.length };
}

export function toggleEraser(tool: DrawTool): DrawTool {
  return { ...tool, eraser: !tool.eraser };
}
