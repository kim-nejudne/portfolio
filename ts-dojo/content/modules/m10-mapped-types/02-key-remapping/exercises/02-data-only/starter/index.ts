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
export type DataOnly<T> = {
  [K in keyof T]: T[K] extends Function ? never : T[K];
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
