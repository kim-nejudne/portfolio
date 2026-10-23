/** A video clip that plays from `start` to its end. Times are in seconds. */
export class Clip {
  #start = 0;

  constructor(
    readonly title: string,
    private readonly length: number,
  ) {}

  /** Where playback starts: from 0 to the clip's length. */
  get start(): number {
    return this.#start;
  }

  /** Seconds, or `m:ss` text such as `1:30`; clamped to the clip. */
  set start(value: number | string) {
    let seconds = value;
    if (typeof seconds === 'string') {
      const [minutes, rest] = seconds.split(':');
      seconds = Number(minutes) * 60 + Number(rest);
    }
    this.#start = Math.min(Math.max(seconds, 0), this.length);
  }

  /** Seconds from start to the end of the clip. */
  get remaining(): number {
    return this.length - this.#start;
  }
}
