import { describe, expect, it } from 'vitest';
import { DEFAULT_INK_SIZE, ERASER_COLOR_INDEX } from '../../../shared/constants.js';
import { cycleSize, DEFAULT_TOOL, inkColor, pickColor, toggleEraser } from './tools.js';

describe('drawing tools', () => {
  it('start as the black pen at M, eraser off', () => {
    expect(DEFAULT_TOOL).toEqual({ color: 0, size: DEFAULT_INK_SIZE, eraser: false });
    expect(inkColor(DEFAULT_TOOL)).toBe(0);
  });
  it('the size button cycles S → M → L → S from M', () => {
    const sizes = [DEFAULT_TOOL];
    for (let i = 0; i < 3; i++) sizes.push(cycleSize(sizes[sizes.length - 1]!));
    expect(sizes.map((s) => s.size)).toEqual([1, 2, 0, 1]);
  });
  it('the eraser paints colour 8 at the chosen size, and keeps the pen colour for later', () => {
    const red = pickColor(DEFAULT_TOOL, 1);
    const erasing = toggleEraser(cycleSize(red));
    expect(inkColor(erasing)).toBe(ERASER_COLOR_INDEX);
    expect(erasing.size).toBe(2);
    expect(inkColor(toggleEraser(erasing))).toBe(1);
  });
  it('tapping a colour leaves the eraser and keeps the size', () => {
    const erasing = toggleEraser(cycleSize(DEFAULT_TOOL));
    const blue = pickColor(erasing, 5);
    expect(blue).toEqual({ color: 5, size: 2, eraser: false });
    expect(inkColor(blue)).toBe(5);
  });
  it('ignores a colour outside the palette', () => {
    expect(pickColor(DEFAULT_TOOL, 8)).toBe(DEFAULT_TOOL);
    expect(pickColor(DEFAULT_TOOL, -1)).toBe(DEFAULT_TOOL);
  });
});
