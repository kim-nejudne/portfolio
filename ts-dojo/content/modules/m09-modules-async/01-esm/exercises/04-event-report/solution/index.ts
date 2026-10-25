// The public entry: callers import the event types and the report functions from here.
export type { AppEvent, EventType } from './events';
export { describeEvent, countByType, summary } from './report';
