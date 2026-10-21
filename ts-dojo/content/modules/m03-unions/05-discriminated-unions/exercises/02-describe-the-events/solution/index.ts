export type UIEvent =
  | { type: 'click'; x: number; y: number }
  | { type: 'keydown'; key: string }
  | { type: 'scroll'; deltaY: number };
