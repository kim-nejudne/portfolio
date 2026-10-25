// A tuple of N elements, built one element per step (12.4).
type BuildTuple<
  N extends number,
  Acc extends unknown[] = [],
> = Acc['length'] extends N ? Acc : BuildTuple<N, [...Acc, unknown]>;

// A position counted from the start. -D is what is left of Arr once D elements come off its
// end, or 0 when Arr has fewer than D elements.
type ToIndex<
  Arr extends readonly unknown[],
  N extends number,
> = `${N}` extends `-${infer D extends number}`
  ? Arr extends readonly [...infer Rest, ...BuildTuple<D>]
    ? Rest['length']
    : 0
  : N;

// I counts the positions passed so far, and Taking says whether Start has been reached. The
// walk ends at End or when Arr runs out, whichever comes first.
type Walk<
  Arr extends readonly unknown[],
  Start extends number,
  End extends number,
  I extends unknown[] = [],
  Taking extends boolean = false,
  Acc extends unknown[] = [],
> = I['length'] extends End
  ? Acc
  : Arr extends readonly [infer H, ...infer R]
    ? [Taking] extends [true]
      ? Walk<R, Start, End, [...I, unknown], true, [...Acc, H]>
      : I['length'] extends Start
        ? Walk<R, Start, End, [...I, unknown], true, [...Acc, H]>
        : Walk<R, Start, End, [...I, unknown], false, Acc>
    : Acc;

export type Slice<
  Arr extends readonly unknown[],
  Start extends number = 0,
  End extends number = Arr['length'],
> = Walk<Arr, ToIndex<Arr, Start>, ToIndex<Arr, End>>;
