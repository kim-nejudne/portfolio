/**
 * A decorator factory for `accessor` fields that hold a number: every value the accessor
 * stores, its initial value and each assignment, is kept between `min` and `max`.
 */
export function clamp(min: number, max: number) {
  // The factory runs where `@clamp(…)` is written, before any class uses the decorator.
  if (min > max) {
    throw new RangeError(`clamp: min ${min} is greater than max ${max}`);
  }
  return function <This>(
    target: ClassAccessorDecoratorTarget<This, number>,
    context: ClassAccessorDecoratorContext<This, number>,
  ): ClassAccessorDecoratorResult<This, number> {
    const name = String(context.name);
    const fit = (value: number): number => {
      if (Number.isNaN(value)) {
        throw new RangeError(`${name} is not a number`);
      }
      return Math.min(max, Math.max(min, value));
    };
    return {
      // `init` changes the initial value, `set` every later assignment; `get` stays as it is.
      init: fit,
      set(value) {
        target.set.call(this, fit(value));
      },
    };
  };
}

export class Speaker {
  @clamp(0, 100) accessor volume = 50;
  @clamp(-10, 10) accessor balance = 0;
}

const speaker = new Speaker();
speaker.volume = 140;
speaker.balance = -12;
console.log(speaker.volume, speaker.balance);
