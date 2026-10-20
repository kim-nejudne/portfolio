// The import preview names what each §7 category would gain: new and updated rows, the
// exercises that would become passed, the attempts added and those already there, and the
// settings keys that change.
import { describe, expect, it } from 'vitest';
import type { ImportPlan } from '@/store/import';
import { previewLines } from './preview';

const PLAN: ImportPlan = {
  file: {
    schemaVersion: 1,
    contentVersion: 'h',
    exportedAt: '',
    lessons: [],
    exercises: [],
    attempts: [],
    buffers: [],
    settings: {},
  },
  lessons: { added: ['a'], updated: [], unchanged: 2 },
  exercises: {
    added: [],
    updated: ['x', 'y'],
    unchanged: 0,
    newlyPassed: ['x'],
  },
  attempts: { appended: 3, skipped: 1 },
  buffers: { added: [], updated: [], unchanged: 0 },
  settings: { changed: ['theme', 'vimrc'] },
  contentVersion: { file: 'h', app: 'h', matches: true },
};

describe('previewLines', () => {
  it('has one line per category, in the §7 order', () => {
    expect(previewLines(PLAN)).toEqual([
      ['lessons', '1 new, 0 updated, 2 unchanged'],
      ['exercises', '0 new, 2 updated, 0 unchanged; 1 newly passed'],
      ['attempts', '3 added, 1 already here'],
      ['buffers', '0 new, 0 updated, 0 unchanged'],
      ['settings', 'theme, vimrc changed'],
    ]);
  });

  it('leaves out the parts that are zero where that reads better', () => {
    const quiet: ImportPlan = {
      ...PLAN,
      exercises: { ...PLAN.exercises, newlyPassed: [] },
      attempts: { appended: 0, skipped: 0 },
      settings: { changed: [] },
    };
    const lines = Object.fromEntries(previewLines(quiet));
    expect(lines['exercises']).toBe('0 new, 2 updated, 0 unchanged');
    expect(lines['attempts']).toBe('0 added');
    expect(lines['settings']).toBe('no change');
  });
});
