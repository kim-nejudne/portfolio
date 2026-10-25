import { eventTypes, type AppEvent, type EventType } from './events';

/** One line per event: 'Ada logged in', 'Ada logged out', 'Ada spent €12.50'. */
export function describeEvent(event: AppEvent): string {
  switch (event.type) {
    case 'login':
      return `${event.user} logged in`;
    case 'logout':
      return `${event.user} logged out`;
    case 'purchase':
      return `${event.user} spent €${(event.cents / 100).toFixed(2)}`;
    default: {
      const unreachable: never = event;
      throw new Error(`unhandled event: ${JSON.stringify(unreachable)}`);
    }
  }
}

/** How many events of each type, with 0 for a type that never occurs. */
export function countByType(
  events: readonly AppEvent[],
): Record<EventType, number> {
  const counts: Record<EventType, number> = {
    login: 0,
    logout: 0,
    purchase: 0,
  };
  for (const event of events) {
    counts[event.type] += 1;
  }
  return counts;
}

/** The counts in the order of eventTypes: 'login 1, logout 0, purchase 2'. Already done. */
export function summary(events: readonly AppEvent[]): string {
  const counts = countByType(events);
  return eventTypes.map((type) => `${type} ${counts[type]}`).join(', ');
}
