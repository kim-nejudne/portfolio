// K extends keyof T rejects keys T doesn't have, and lets T[P] look each one up. Because K is
// constrained by keyof T, the mapped type copies each property's readonly and ? as well.
export type MyPick<T, K extends keyof T> = { [P in K]: T[P] };
