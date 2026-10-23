// Ids arrive as strings: users look like 'u-42', orders like 'o-7'.
// Each brand is a property no plain string has, and it exists only in the type.
export type UserId = string & { readonly __brand: 'UserId' };
export type OrderId = string & { readonly __brand: 'OrderId' };

// The guards are the only places that make the brands: a true result narrows raw.
function isUserId(raw: string): raw is UserId {
  return /^u-\d+$/.test(raw);
}

function isOrderId(raw: string): raw is OrderId {
  return /^o-\d+$/.test(raw);
}

// Returns raw as a UserId when it is 'u-' followed by digits, and throws otherwise.
export function toUserId(raw: string): UserId {
  if (!isUserId(raw)) throw new TypeError(`not a user id: ${raw}`);
  return raw;
}

// Returns raw as an OrderId when it is 'o-' followed by digits, and throws otherwise.
export function toOrderId(raw: string): OrderId {
  if (!isOrderId(raw)) throw new TypeError(`not an order id: ${raw}`);
  return raw;
}

export function shipOrder(user: UserId, order: OrderId): string {
  return `${order} ships to ${user}`;
}
