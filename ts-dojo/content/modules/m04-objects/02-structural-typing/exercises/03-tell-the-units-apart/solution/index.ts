// The same shape, so each is accepted where the other is expected.
// Give each a unit: 'C' for Celsius, 'F' for Fahrenheit.
export type Celsius = { unit: 'C'; value: number };
export type Fahrenheit = { unit: 'F'; value: number };

// Reading: a Celsius or a Fahrenheit reading.
export type Reading = Celsius | Fahrenheit;
