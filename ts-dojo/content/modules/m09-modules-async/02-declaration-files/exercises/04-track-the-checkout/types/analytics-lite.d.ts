// The types of analytics-lite, a tracking script the page loads with a <script> tag. The
// script defines a global tracker at run time; there is no module to import values from.
declare module 'analytics-lite' {
  /** The events the app may send, by name, with the data each one carries. */
  export interface EventMap {
    pageview: { path: string };
  }

  export interface Tracker {
    send<K extends keyof EventMap>(name: K, data: EventMap[K]): void;
  }
}
