/** Any class whose instances are a T, abstract or not, whatever its constructor takes. */
type Class<T> = abstract new (...args: never[]) => T;

export class Registry {
  #factories = new Map<Class<unknown>, () => unknown>();

  register<T>(type: Class<T>, make: () => T): this {
    this.#factories.set(type, make);
    return this;
  }

  create<T>(type: Class<T>): T {
    const make = this.#factories.get(type);
    if (make === undefined) {
      throw new Error(`nothing is registered for ${type.name}`);
    }
    const instance = make();
    if (!(instance instanceof type)) {
      throw new Error(`the factory for ${type.name} made something else`);
    }
    return instance;
  }
}
