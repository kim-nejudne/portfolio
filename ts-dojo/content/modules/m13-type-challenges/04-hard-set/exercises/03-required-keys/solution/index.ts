// Each key maps to itself when it is required ({} doesn't fit the object of that one
// property) and to never when it is optional; indexing with keyof T collects the union. The
// -? matters: an optional property's value would otherwise bring undefined into the union.
export type RequiredKeys<T> = {
  [K in keyof T]-?: {} extends Pick<T, K> ? never : K;
}[keyof T];
