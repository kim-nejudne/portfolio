/** The values of a form's fields, starting from the initial values. */
export class Form {
  private readonly initial: object;

  constructor(initial: object) {
    this.initial = initial;
  }

  /** The current value of the field. */
  get(key: string): unknown {
    throw new Error(`get is not implemented for ${key}`);
  }

  /** Sets the field to the value. */
  set(key: string, value: unknown): void {
    throw new Error(`set is not implemented for ${key} and ${String(value)}`);
  }

  /** Sets the field to what fn returns for its current value. */
  update(key: string, fn: (value: unknown) => unknown): void {
    throw new Error(`update is not implemented for ${key} and ${fn.name}`);
  }

  /** Sets the field back to its initial value. */
  reset(key: string): void {
    throw new Error(`reset is not implemented for ${key}`);
  }

  /** Whether the field's value is not === its initial value. */
  isDirty(key: string): boolean {
    throw new Error(`isDirty is not implemented for ${key}`);
  }
}
