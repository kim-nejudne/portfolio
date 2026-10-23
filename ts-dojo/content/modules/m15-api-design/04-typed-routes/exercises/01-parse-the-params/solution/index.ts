// Every segment of the pattern, as a union.
type Segments<P extends string> = P extends `${infer Head}/${infer Rest}`
  ? Head | Segments<Rest>
  : P;

// The name of a parameter segment; never for any other segment.
type ParamName<S> = S extends `:${infer Name}` ? Name : never;

// The parameters of a route pattern: a string property for each segment that starts with `:`.
export type Params<P extends string> = {
  [K in ParamName<Segments<P>>]: string;
};
