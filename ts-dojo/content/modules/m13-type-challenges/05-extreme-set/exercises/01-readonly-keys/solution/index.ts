// The identity check from @dojo/type-utils' Equal (13.1). Unlike assignability, it tells
// { readonly a: 1 } and { a: 1 } apart.
type Same<X, Y> =
  (<G>() => G extends X ? 1 : 2) extends <G>() => G extends Y ? 1 : 2
    ? true
    : false;

// Pick<T, K> keeps the property's modifiers (it maps over K extends keyof T, 10.1). If making
// it readonly changes nothing, it was readonly already. -? keeps an optional key's undefined
// out of the union.
export type GetReadonlyKeys<T> = {
  [K in keyof T]-?: Same<Pick<T, K>, Readonly<Pick<T, K>>> extends true
    ? K
    : never;
}[keyof T];
