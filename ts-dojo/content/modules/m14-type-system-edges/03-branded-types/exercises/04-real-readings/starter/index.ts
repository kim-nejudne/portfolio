// A temperature in degrees Celsius.
export class Celsius {
  constructor(readonly degrees: number) {}

  // True only for an object that this class's constructor made.
  static is(value: unknown): value is Celsius {
    throw new Error('not implemented');
  }
}

// A temperature in degrees Fahrenheit.
export class Fahrenheit {
  constructor(readonly degrees: number) {}
}

export function isFreezing(reading: Celsius): boolean {
  return reading.degrees <= 0;
}

// Returns a Celsius as it is, and converts a Fahrenheit.
export function toCelsius(reading: Celsius | Fahrenheit): Celsius {
  throw new Error('not implemented');
}
