/** The values of a form's fields, starting from the initial values. */
export class Form<T extends object> {
  private readonly initial: T;
  private values: T;

  constructor(initial: T) {
    this.initial = { ...initial };
    this.values = { ...initial };
  }

  /** The current value of the field. */
  get<K extends keyof T>(key: K): T[K] {
    return this.values[key];
  }

  /** Sets the field to the value. */
  set<K extends keyof T>(key: K, value: T[K]): void {
    this.values[key] = value;
  }

  /** Sets the field to what fn returns for its current value. */
  update<K extends keyof T>(key: K, fn: (value: T[K]) => T[K]): void {
    this.values[key] = fn(this.values[key]);
  }

  /** Sets the field back to its initial value. */
  reset(key: keyof T): void {
    this.values[key] = this.initial[key];
  }

  /** Whether the field's value is not === its initial value. */
  isDirty(key: keyof T): boolean {
    return this.values[key] !== this.initial[key];
  }
}
