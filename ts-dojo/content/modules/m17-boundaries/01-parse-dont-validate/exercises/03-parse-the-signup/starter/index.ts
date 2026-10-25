export type Email = string & { readonly __brand: 'Email' };

export interface Signup {
  email: Email;
  age: number;
  newsletter: boolean;
}

export type Issue = { path: string[]; message: string };
export type Result<T> = { ok: true; value: T } | { ok: false; error: Issue };

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+$/;

/** A trimmed, lower-cased email address. */
export function parseEmail(input: unknown): Result<Email> {
  throw new Error(`not implemented for ${typeof input}`);
}

/** A sign-up form with exactly the fields of Signup; `newsletter` defaults to false. */
export function parseSignup(input: unknown): Result<Signup> {
  throw new Error(`not implemented for ${typeof input}`);
}
