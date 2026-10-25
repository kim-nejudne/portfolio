export class Logger {
  readonly lines: string[] = [];

  format(message: string): string {
    return message;
  }

  log(message: string): string {
    const line = this.format(message);
    this.lines.push(line);
    return line;
  }
}

/** Puts the level in front of every line: `[warn] disk is full`. */
export class LevelLogger extends Logger {
  constructor(readonly level: string) {
    super();
  }

  format(message: string): string {
    return `[${this.level}] ${super.format(message)}`;
  }
}

/** Keeps the first 10 characters of every line. */
export class ShortLogger extends Logger {
  override formatLine(message: string): string {
    return message.slice(0, 10);
  }
}
