export class Stopwatch {
  label: string;
  laps: number[];
  total: number;

  constructor(label: string) {
    this.label = label;
  }

  /** Records one lap and returns the total so far. */
  lap(seconds: number): number {
    this.laps.push(seconds);
    this.total += seconds;
    return this.total;
  }
}
