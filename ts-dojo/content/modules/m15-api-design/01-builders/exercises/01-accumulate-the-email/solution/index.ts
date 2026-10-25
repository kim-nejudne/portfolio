export type Email = { to: string; subject: string; text?: string };

export class EmailBuilder<T extends object> {
  readonly #email: T;

  constructor(email: T) {
    this.#email = email;
  }

  to(address: string): EmailBuilder<T & { to: string }> {
    return new EmailBuilder({ ...this.#email, to: address });
  }

  subject(subject: string): EmailBuilder<T & { subject: string }> {
    return new EmailBuilder({ ...this.#email, subject });
  }

  text(text: string): EmailBuilder<T & { text: string }> {
    return new EmailBuilder({ ...this.#email, text });
  }

  build(this: EmailBuilder<Email>): Email {
    return { ...this.#email };
  }
}

export const email = (): EmailBuilder<{}> => new EmailBuilder({});

export const welcome = email()
  .to('ada@example.com')
  .subject('Welcome')
  .text('Your account is ready.')
  .build();
