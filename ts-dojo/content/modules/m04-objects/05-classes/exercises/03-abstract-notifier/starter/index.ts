/** Every notifier keeps what it sent. A subclass decides how a message is formatted. */
export class Notifier {
  sent: string[] = [];

  format(message: string): string {
    throw new Error(`a subclass must format ${message}`);
  }

  send(message: string): string {
    const text = this.format(message);
    this.sent.push(text);
    return text;
  }
}

export class EmailNotifier extends Notifier {
  readonly address: string;

  constructor(address: string) {
    super();
    this.address = address;
  }

  format(message: string): string {
    return `to ${this.address}: ${message}`;
  }
}

export class SmsNotifier extends Notifier {
  readonly phone: string;

  constructor(phone: string) {
    super();
    this.phone = phone;
  }

  /** `sms <phone>: ` and the first 20 characters of the message. */
  format(message: string): string {
    throw new Error(`not implemented for ${message}`);
  }
}
