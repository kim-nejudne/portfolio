// readonly unknown[] accepts as const tuples and mutable ones alike; a tuple's length is a literal.
export type Length<T extends readonly unknown[]> = T['length'];
