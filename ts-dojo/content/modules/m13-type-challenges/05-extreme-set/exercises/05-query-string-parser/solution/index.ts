// The pieces between the &s, in order. The empty string has none.
type SplitPieces<S extends string, Acc extends string[] = []> = S extends ''
  ? Acc
  : S extends `${infer Piece}&${infer Rest}`
    ? SplitPieces<Rest, [...Acc, Piece]>
    : [...Acc, S];

// A piece as [key, value]. infer K stops at the first =, so the value keeps any later ones.
type ParsePiece<P extends string> = P extends `${infer K}=${infer V}`
  ? [K, V]
  : [P, true];

// What a key holds once V is added to what it held, Old: unchanged when V is already there,
// a pair when a bare value meets a different one, one element longer when it is a tuple.
type AddValue<Old, V> = Old extends unknown[]
  ? V extends Old[number]
    ? Old
    : [...Old, V]
  : V extends Old
    ? Old
    : [Old, V];

// Obj with V added under K, rebuilt as one object type rather than Obj & { [P in K]: V }.
type With<Obj, K extends string, V> = {
  [P in keyof Obj | K]: P extends keyof Obj
    ? P extends K
      ? AddValue<Obj[P], V>
      : Obj[P]
    : V;
};

// Fold the pieces into an object, one at a time, with the object as the accumulator.
type Build<Pieces extends string[], Obj = {}> = Pieces extends [
  infer P extends string,
  ...infer Rest extends string[],
]
  ? ParsePiece<P> extends [infer K extends string, infer V]
    ? Build<Rest, With<Obj, K, V>>
    : never
  : Obj;

export type ParseQueryString<S extends string> = Build<SplitPieces<S>>;
