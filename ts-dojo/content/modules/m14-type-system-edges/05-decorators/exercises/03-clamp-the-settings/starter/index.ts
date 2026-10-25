/**
 * A decorator factory for `accessor` fields that hold a number: every value the accessor
 * stores, its initial value and each assignment, is kept between `min` and `max`.
 */
export function clamp(min: number, max: number) {
  return function (
    target: unknown,
    context: ClassAccessorDecoratorContext,
  ): void {
    // Not implemented yet: the accessor stores whatever it is given.
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
