export type SignUp = {
  email: string;
  password: string;
  age: number;
  inviteCode?: string;
};

/** One rule per field of T: it takes the field's value and returns a message, or null when it passes. */
export type Rules<T> = { [K in T]: (value: T[K]) => string | null };

export const signUpRules: Rules<SignUp> = {
  email: (email) => (email.includes('@') ? null : 'Enter an email address.'),
  password: (password) =>
    password.length >= 8 ? null : 'Use at least 8 characters.',
  age: (age) =>
    Number.isInteger(age) && age >= 13 ? null : 'You must be 13 or older.',
};

/** The message of every field whose rule fails; a field that passes has no entry. */
export function validate<T>(
  rules: Rules<T>,
  values: T,
): Partial<Record<keyof T, string>> {
  const errors: Partial<Record<keyof T, string>> = {};
  for (const key in rules) {
    const message = rules[key](values[key]);
    if (message !== null) {
      errors[key] = message;
    }
  }
  return errors;
}
