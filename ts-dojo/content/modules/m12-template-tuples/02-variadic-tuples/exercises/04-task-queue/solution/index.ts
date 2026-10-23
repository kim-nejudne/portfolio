/** Runs async tasks one at a time, in the order they were enqueued. */
export class TaskQueue {
  // The last task enqueued, with its rejection caught, so the next one can always chain onto it.
  private last: Promise<unknown> = Promise.resolve();
  private pending = 0;

  /** The number of tasks enqueued that haven't settled yet, the running one included. */
  get size(): number {
    return this.pending;
  }

  /** Queues a call of task with args; the promise settles with the task's result. */
  enqueue<A extends unknown[], R>(
    task: (...args: A) => Promise<R>,
    ...args: A
  ): Promise<R> {
    this.pending++;
    const result = this.last
      .then(() => task(...args))
      .finally(() => {
        this.pending--;
      });
    this.last = result.catch(() => undefined);
    return result;
  }
}
