export type Reading = { sensor: string; unit: 'C' | 'F'; value: number };

/** True when value is a Reading: a string sensor, a unit of 'C' or 'F', a number value. */
export function isReading(value: unknown): value is Reading {
  throw new Error(`not implemented for ${typeof value}`);
}

/** The temperature in degrees Celsius, or undefined when the data is not a reading. */
export function toCelsius(json: string): number | undefined {
  throw new Error(`not implemented for ${json}`);
}
