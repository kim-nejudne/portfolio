export type Task = {
  readonly id: number;
  title: string;
  done: boolean;
  due?: Date;
  onDone?: (task: Task) => void;
  complete(): void;
  rename(title: string): void;
};

/** The properties of T that hold data, with their modifiers: every property but the functions. */
// The conditional moved into the as clause: a key mapped to never is dropped, while a
// value of type never kept the key and made it impossible to fill. An optional callback's
// type includes undefined, which isn't a Function, so NonNullable takes it out before the test.
export type DataOnly<T> = {
  [K in keyof T as NonNullable<T[K]> extends Function ? never : K]: T[K];
};

export function createTask(
  id: number,
  title: string,
  options: { due?: Date; onDone?: (task: Task) => void } = {},
): Task {
  const task: Task = {
    id,
    title,
    done: false,
    complete() {
      task.done = true;
      task.onDone?.(task);
    },
    rename(next) {
      task.title = next;
    },
  };
  if (options.due) task.due = options.due;
  if (options.onDone) task.onDone = options.onDone;
  return task;
}

/** What gets saved: the task's data, without its functions. */
export function toSaved(task: Task): DataOnly<Task> {
  const saved: DataOnly<Task> = {
    id: task.id,
    title: task.title,
    done: task.done,
  };
  if (task.due) saved.due = task.due;
  return saved;
}
