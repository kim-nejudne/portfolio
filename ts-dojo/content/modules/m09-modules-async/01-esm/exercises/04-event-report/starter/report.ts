import { AppEvent, EventType, eventTypes } from './events';

/** One line per event: 'Ada logged in', 'Ada logged out', 'Ada spent €12.50'. */
export function describeEvent(event: AppEvent): string {
  throw new Error(`not implemented for ${event.type}`);
}

/** How many events of each type, with 0 for a type that never occurs. */
export function countByType(
  events: readonly AppEvent[],
): Record<EventType, number> {
  throw new Error(`not implemented for ${events.length} events`);
}

/** The counts in the order of eventTypes: 'login 1, logout 0, purchase 2'. Already done. */
export function summary(events: readonly AppEvent[]): string {
  const counts = countByType(events);
  return eventTypes.map((type) => `${type} ${counts[type]}`).join(', ');
}
