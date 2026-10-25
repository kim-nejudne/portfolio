// Ids arrive as strings: users look like 'u-42', orders like 'o-7'.
export type UserId = string;
export type OrderId = string;

// Returns raw as a UserId when it is 'u-' followed by digits, and throws otherwise.
export function toUserId(raw: string): UserId {
  throw new Error('not implemented');
}

// Returns raw as an OrderId when it is 'o-' followed by digits, and throws otherwise.
export function toOrderId(raw: string): OrderId {
  throw new Error('not implemented');
}

export function shipOrder(user: UserId, order: OrderId): string {
  return `${order} ships to ${user}`;
}
