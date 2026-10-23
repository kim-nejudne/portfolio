// The statuses a ticket can be in, in workflow order.
export function defineStatuses<T extends readonly string[]>(statuses: T): T {
  return statuses;
}

export const statuses = defineStatuses(['draft', 'review', 'published']);

export type Status = (typeof statuses)[number];

export function label(status: Status): string {
  switch (status) {
    case 'draft':
      return 'Draft';
    case 'review':
      return 'In review';
    case 'published':
      return 'Published';
  }
}
