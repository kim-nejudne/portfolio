export type Message =
  | { type: 'text'; from: string; body: string }
  | { type: 'image'; from: string; url: string; width: number }
  | { type: 'leave'; from: string };

/** True when value is one of the three kinds of Message, with the properties that kind needs. */
export function isMessage(value: unknown): value is Message {
  throw new Error(`not implemented for ${typeof value}`);
}

/** The entries of the JSON array that are messages, in order; [] when the data is not an array. */
export function readInbox(json: string): Message[] {
  throw new Error(`not implemented for ${json}`);
}
