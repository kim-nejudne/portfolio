type Digit = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9';
type NonZero = Exclude<Digit, '0'>;

// One part of an IPv4 address: 0 to 255, written without leading zeros.
export type Byte =
  | Digit
  | `${NonZero}${Digit}`
  | `1${Digit}${Digit}`
  | `2${'0' | '1' | '2' | '3' | '4'}${Digit}`
  | `25${'0' | '1' | '2' | '3' | '4' | '5'}`;

// Check the address the caller wrote: four parts, each one a Byte.
export type IPv4<S extends string> =
  S extends `${infer A}.${infer B}.${infer C}.${infer D}`
    ? [A, B, C, D] extends [Byte, Byte, Byte, Byte]
      ? S
      : never
    : never;

function parts(text: string): [number, number, number, number] {
  const [a, b, c, d] = text.split('.').map(Number);
  return [a, b, c, d];
}

export function octets<S extends string>(
  address: IPv4<S>,
): [number, number, number, number] {
  return parts(address);
}
