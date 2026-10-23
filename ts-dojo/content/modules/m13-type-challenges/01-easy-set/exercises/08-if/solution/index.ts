// boolean is true | false, and C is a bare type parameter, so If<boolean, T, F> distributes
// to T | F.
export type If<C extends boolean, T, F> = C extends true ? T : F;
