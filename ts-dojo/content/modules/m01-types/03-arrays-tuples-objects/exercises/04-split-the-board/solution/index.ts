// A task on the board. A task that hasn't been marked yet has no done property at all.
export type Task = {
  readonly id: string;
  title: string;
  done?: boolean;
};

// The board the app opens with. It never changes, so it is fixed with as const.
export const BOARD = [
  { id: 't1', title: 'Write the lesson', done: true },
  { id: 't2', title: 'Review it' },
  { id: 't3', title: 'Ship it', done: false },
] as const;

// The titles of the open tasks, then the titles of the done ones, in board order.
export function splitTasks(
  tasks: readonly Task[],
): [open: string[], done: string[]] {
  const open: string[] = [];
  const done: string[] = [];
  for (const task of tasks) {
    if (task.done) {
      done.push(task.title);
    } else {
      open.push(task.title);
    }
  }
  return [open, done];
}

// Both columns on one line.
export function formatColumns(
  columns: [open: string[], done: string[]],
): string {
  const [open, done] = columns;
  return `Open: ${open.join(', ')} | Done: ${done.join(', ')}`;
}

export function boardText(): string {
  return formatColumns(splitTasks(BOARD));
}
