export type Email = string & { readonly __brand: 'Email' };

export interface Signup {
  email: Email;
  age: number;
  newsletter: boolean;
}

export type Issue = { path: string[]; message: string };
export type Result<T> = { ok: true; value: T } | { ok: false; error: Issue };

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+$/;

function isEmail(text: string): text is Email {
  return EMAIL_PATTERN.test(text);
}

/** A trimmed, lower-cased email address. */
export function parseEmail(input: unknown): Result<Email> {
  if (typeof input === 'string') {
    const email = input.trim().toLowerCase();
    if (isEmail(email)) {
      return { ok: true, value: email };
    }
  }
  return {
    ok: false,
    error: { path: [], message: 'expected an email address' },
  };
}

/** A sign-up form with exactly the fields of Signup; `newsletter` defaults to false. */
export function parseSignup(input: unknown): Result<Signup> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { ok: false, error: { path: [], message: 'expected an object' } };
  }

  const email = parseEmail('email' in input ? input.email : undefined);
  if (!email.ok) {
    return {
      ok: false,
      error: { path: ['email'], message: email.error.message },
    };
  }

  const age = 'age' in input ? input.age : undefined;
  if (
    typeof age !== 'number' ||
    !Number.isInteger(age) ||
    age < 13 ||
    age > 120
  ) {
    return {
      ok: false,
      error: {
        path: ['age'],
        message: 'expected a whole number from 13 to 120',
      },
    };
  }

  const newsletter = 'newsletter' in input ? input.newsletter : false;
  if (typeof newsletter !== 'boolean') {
    return {
      ok: false,
      error: { path: ['newsletter'], message: 'expected true or false' },
    };
  }

  return { ok: true, value: { email: email.value, age, newsletter } };
}
