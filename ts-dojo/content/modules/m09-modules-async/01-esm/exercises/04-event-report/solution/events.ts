// The events the app records. This file is right as it is: leave it alone.
export type AppEvent =
  | { type: 'login'; user: string }
  | { type: 'logout'; user: string }
  | { type: 'purchase'; user: string; cents: number };

export type EventType = AppEvent['type'];

/** Every event type once, in a fixed order. */
export const eventTypes: readonly EventType[] = ['login', 'logout', 'purchase'];
