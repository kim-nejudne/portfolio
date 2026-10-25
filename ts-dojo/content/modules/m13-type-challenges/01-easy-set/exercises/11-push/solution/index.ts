// Spread T, then one more element. For an array type the result is [...number[], string]: still
// a tuple type, with a rest element, which is neither string[] nor [string, number].
export type Push<T extends readonly unknown[], U> = [...T, U];
