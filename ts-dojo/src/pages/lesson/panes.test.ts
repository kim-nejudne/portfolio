// §4 Focus and panes, §6 Global keys: exactly one of theory, editor and output has focus;
// `Ctrl-h/j/k/l` move between them by position (theory on the left, the editor above the output
// on the right); a pane hidden by `:layout` is never a target; a `predict` exercise has no
// output pane.
import { describe, expect, it } from 'vitest';
import { paneInDirection, visiblePanes } from './panes';

describe('paneInDirection', () => {
  it('moves by position in the split layout', () => {
    const at = (
      from: 'theory' | 'editor' | 'output',
      dir: 'left' | 'right' | 'up' | 'down',
    ) => paneInDirection(from, dir, 'split', true);
    expect(at('theory', 'right')).toBe('editor');
    expect(at('theory', 'left')).toBeNull();
    expect(at('theory', 'down')).toBeNull();
    expect(at('editor', 'left')).toBe('theory');
    expect(at('editor', 'down')).toBe('output');
    expect(at('editor', 'up')).toBeNull();
    expect(at('editor', 'right')).toBeNull();
    expect(at('output', 'up')).toBe('editor');
    expect(at('output', 'left')).toBe('theory');
    expect(at('output', 'down')).toBeNull();
  });

  it('skips panes that :layout hides and an output a predict exercise does not have', () => {
    expect(paneInDirection('editor', 'left', 'practice', true)).toBeNull();
    expect(paneInDirection('editor', 'down', 'practice', true)).toBe('output');
    expect(paneInDirection('theory', 'right', 'theory', true)).toBeNull();
    expect(paneInDirection('editor', 'down', 'split', false)).toBeNull();
    expect(visiblePanes('split', true)).toEqual(['theory', 'editor', 'output']);
    expect(visiblePanes('theory', true)).toEqual(['theory']);
    expect(visiblePanes('practice', false)).toEqual(['editor']);
  });
});
