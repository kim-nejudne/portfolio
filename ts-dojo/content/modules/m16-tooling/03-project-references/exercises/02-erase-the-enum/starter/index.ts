export enum Direction {
  Up = 'up',
  Down = 'down',
}

export class Elevator {
  constructor(
    public floor: number,
    private readonly top: number,
  ) {}

  /** Moves one floor, staying between 0 and the top floor, and returns the new floor. */
  move(direction: Direction): number {
    if (direction === Direction.Up) {
      this.floor = Math.min(this.floor + 1, this.top);
    } else {
      this.floor = Math.max(this.floor - 1, 0);
    }
    return this.floor;
  }
}
