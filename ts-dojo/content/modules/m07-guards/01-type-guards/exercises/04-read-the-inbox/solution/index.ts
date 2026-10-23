export type Message =
  | { type: 'text'; from: string; body: string }
  | { type: 'image'; from: string; url: string; width: number }
  | { type: 'leave'; from: string };

/** True when value is one of the three kinds of Message, with the properties that kind needs. */
export function isMessage(value: unknown): value is Message {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('type' in value) ||
    !('from' in value) ||
    typeof value.from !== 'string'
  ) {
    return false;
  }
  switch (value.type) {
    case 'text':
      return 'body' in value && typeof value.body === 'string';
    case 'image':
      return (
        'url' in value &&
        typeof value.url === 'string' &&
        'width' in value &&
        typeof value.width === 'number'
      );
    case 'leave':
      return true;
    default:
      return false;
  }
}

/** The entries of the JSON array that are messages, in order; [] when the data is not an array. */
export function readInbox(json: string): Message[] {
  const data: unknown = JSON.parse(json);
  if (!Array.isArray(data)) {
    return [];
  }
  return data.filter(isMessage);
}
