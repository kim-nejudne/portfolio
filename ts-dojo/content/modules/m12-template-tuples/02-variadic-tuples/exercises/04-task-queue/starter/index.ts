/** Runs async tasks one at a time, in the order they were enqueued. */
export class TaskQueue {
  /** The number of tasks enqueued that haven't settled yet, the running one included. */
  get size(): number {
    throw new Error('not implemented: size');
  }

  /** Queues a call of task with args; the promise settles with the task's result. */
  enqueue(
    task: (...args: never[]) => Promise<unknown>,
    ...args: unknown[]
  ): Promise<unknown> {
    throw new Error(`not implemented: enqueue ${task.name} ${args.length}`);
  }
}
