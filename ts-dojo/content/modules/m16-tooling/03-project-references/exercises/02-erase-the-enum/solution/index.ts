export const Direction = { Up: 'up', Down: 'down' } as const;
export type Direction = (typeof Direction)[keyof typeof Direction];

export class Elevator {
  floor: number;
  readonly #top: number;

  constructor(floor: number, top: number) {
    this.floor = floor;
    this.#top = top;
  }

  /** Moves one floor, staying between 0 and the top floor, and returns the new floor. */
  move(direction: Direction): number {
    if (direction === Direction.Up) {
      this.floor = Math.min(this.floor + 1, this.#top);
    } else {
      this.floor = Math.max(this.floor - 1, 0);
    }
    return this.floor;
  }
}
