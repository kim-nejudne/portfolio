export type Reading = { sensor: string; unit: 'C' | 'F'; value: number };

/** True when value is a Reading: a string sensor, a unit of 'C' or 'F', a number value. */
export function isReading(value: unknown): value is Reading {
  return (
    typeof value === 'object' &&
    value !== null &&
    'sensor' in value &&
    'unit' in value &&
    'value' in value &&
    typeof value.sensor === 'string' &&
    (value.unit === 'C' || value.unit === 'F') &&
    typeof value.value === 'number'
  );
}

/** The temperature in degrees Celsius, or undefined when the data is not a reading. */
export function toCelsius(json: string): number | undefined {
  const data: unknown = JSON.parse(json);
  if (!isReading(data)) {
    return undefined;
  }
  return data.unit === 'C' ? data.value : ((data.value - 32) * 5) / 9;
}
