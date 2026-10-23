import { clamp, Speaker } from './index';

class Lamp {
  @clamp(0, 1) accessor brightness = 3;
  @clamp(2700, 6500) accessor kelvin = 1000;
  @clamp(-5, 5) accessor tilt = 2;
}

test('the initial value is kept in range', () => {
  const lamp = new Lamp();
  expect(lamp.brightness).toBe(1);
  expect(lamp.kelvin).toBe(2700);
  expect(lamp.tilt).toBe(2);
  expect(new Speaker().volume).toBe(50);
});

test('every assignment is kept in range', () => {
  const speaker = new Speaker();
  speaker.volume = 140;
  expect(speaker.volume).toBe(100);
  speaker.volume = -3;
  expect(speaker.volume).toBe(0);
  speaker.volume = 42.5;
  expect(speaker.volume).toBe(42.5);
  speaker.balance = -12;
  expect(speaker.balance).toBe(-10);
  speaker.balance = 7;
  expect(speaker.balance).toBe(7);
});

test('each instance keeps its own values', () => {
  const kitchen = new Lamp();
  const hall = new Lamp();
  kitchen.kelvin = 9000;
  hall.kelvin = 3000;
  kitchen.tilt = -9;
  expect(kitchen.kelvin).toBe(6500);
  expect(hall.kelvin).toBe(3000);
  expect(kitchen.tilt).toBe(-5);
  expect(hall.tilt).toBe(2);
});

test('NaN is rejected with the accessor name', () => {
  const speaker = new Speaker();
  expect(() => {
    speaker.volume = Number.NaN;
  }).toThrow('volume is not a number');
  expect(() => {
    speaker.balance = Number.NaN;
  }).toThrow('balance is not a number');
  expect(speaker.volume).toBe(50);
});

test('a NaN initial value is rejected too', () => {
  class Broken {
    @clamp(0, 1) accessor ratio = Number.NaN;
  }
  expect(() => new Broken()).toThrow('ratio is not a number');
});

test('clamp rejects a range whose min is above its max', () => {
  let error: unknown;
  try {
    clamp(5, 1);
  } catch (caught) {
    error = caught;
  }
  expect(error).toBeInstanceOf(RangeError);
  expect(() => clamp(1, 1)).not.toThrow();
});

declare const textTarget: ClassAccessorDecoratorTarget<object, string>;
declare const textContext: ClassAccessorDecoratorContext<object, string>;

// @ts-expect-error
const rejectsText = () => clamp(0, 1)(textTarget, textContext); // only number accessors
