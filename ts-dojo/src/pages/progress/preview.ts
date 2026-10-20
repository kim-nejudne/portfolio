// The import preview's lines (§7 "shows what it would change (lessons, exercises, attempts,
// buffers, settings)"): one per category from `planImport`. Pure.
import type { ImportPlan, RowChanges } from '@/store/import';

function changes(rows: RowChanges): string {
  const parts = [
    `${String(rows.added.length)} new`,
    `${String(rows.updated.length)} updated`,
    `${String(rows.unchanged)} unchanged`,
  ];
  return parts.join(', ');
}

/** `[category, what changes]` in the §7 order. */
export function previewLines(plan: ImportPlan): [string, string][] {
  const passed = plan.exercises.newlyPassed.length;
  return [
    ['lessons', changes(plan.lessons)],
    [
      'exercises',
      `${changes(plan.exercises)}${passed > 0 ? `; ${String(passed)} newly passed` : ''}`,
    ],
    [
      'attempts',
      `${String(plan.attempts.appended)} added${plan.attempts.skipped > 0 ? `, ${String(plan.attempts.skipped)} already here` : ''}`,
    ],
    ['buffers', changes(plan.buffers)],
    [
      'settings',
      plan.settings.changed.length === 0
        ? 'no change'
        : `${plan.settings.changed.join(', ')} changed`,
    ],
  ];
}
