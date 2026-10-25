// Every member of a union of events has a string `type`.
export type Tagged = { type: string };

// EventOf<E, T>: the members of E whose type is T. T may only name types that E has.
export type EventOf<E extends Tagged, T extends E['type']> = Extract<
  E,
  { type: T }
>;

// OtherEvents<E, T>: the members of E whose type is not T. T may only name types that E has.
export type OtherEvents<E extends Tagged, T extends E['type']> = Exclude<
  E,
  { type: T }
>;

// Payload<E, T>: the properties of the event whose type is T, without `type` itself.
// T may only name types that E has.
export type Payload<E extends Tagged, T extends E['type']> = Omit<
  EventOf<E, T>,
  'type'
>;
