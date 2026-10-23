// A temperature in degrees Celsius.
export class Celsius {
  // Only this class can declare #celsius, so nothing else fits the type Celsius, and only
  // the constructor puts the field on an object.
  #celsius = true;

  constructor(readonly degrees: number) {}

  // True only for an object that this class's constructor made.
  static is(value: unknown): value is Celsius {
    return typeof value === 'object' && value !== null && #celsius in value;
  }
}

// A temperature in degrees Fahrenheit.
export class Fahrenheit {
  // Its own # field: without one, a Celsius would still fit where a Fahrenheit is expected.
  #fahrenheit = true;

  constructor(readonly degrees: number) {}
}

export function isFreezing(reading: Celsius): boolean {
  return reading.degrees <= 0;
}

// Returns a Celsius as it is, and converts a Fahrenheit.
export function toCelsius(reading: Celsius | Fahrenheit): Celsius {
  // The classes no longer fit each other, so the guard leaves a Fahrenheit in the other branch.
  if (Celsius.is(reading)) return reading;
  return new Celsius(((reading.degrees - 32) * 5) / 9);
}
