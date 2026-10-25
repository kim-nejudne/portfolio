// The fields the server sets on every stored record.
export type Entity = { id: string; createdAt: string };

// CreateInput<T>: the fields of T a client sends to create one, so T without id and createdAt.
// Only types with both of those fields are accepted.
export type CreateInput<T> = unknown;

// UpdateInput<T>: any subset of the fields a client may change, the same fields as CreateInput.
// Only types with id and createdAt are accepted.
export type UpdateInput<T> = unknown;

// Summary<T, K>: a read-only view of T with its id and the fields named in K, nothing else.
// K may only name fields of T.
export type Summary<T extends Entity, K> = unknown;
