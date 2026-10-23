export type SignUp = {
  email: string;
  password: string;
  age: number;
  inviteCode?: string;
};

/** What the form holds while the user types: any field may still be missing. */
export type Draft = Partial<SignUp>;
/** One message per field that fails; a field that passes has no entry. */
export type FormErrors = Partial<Record<keyof SignUp, string>>;

export type SubmitResult =
  { ok: true; value: SignUp } | { ok: false; errors: FormErrors };

/** The message for every field of the draft that fails its rule. */
export function validate(draft: Draft): FormErrors {
  const errors: FormErrors = {};
  if (draft.email === undefined || !draft.email.includes('@')) {
    errors.email = 'Enter an email address.';
  }
  if (draft.password === undefined || draft.password.length < 8) {
    errors.password = 'Use at least 8 characters.';
  }
  if (
    draft.age === undefined ||
    !Number.isInteger(draft.age) ||
    draft.age < 13
  ) {
    errors.age = 'You must be 13 or older.';
  }
  if (draft.inviteCode !== undefined && draft.inviteCode.length !== 6) {
    errors.inviteCode = 'Invite codes have 6 characters.';
  }
  return errors;
}

/** The finished SignUp when the draft has no errors, or the errors when it has some. */
export function submit(draft: Draft): SubmitResult {
  const errors = validate(draft);
  const { email, password, age, inviteCode } = draft;
  if (
    Object.keys(errors).length > 0 ||
    email === undefined ||
    password === undefined ||
    age === undefined
  ) {
    return { ok: false, errors };
  }
  const value: SignUp = { email, password, age };
  if (inviteCode !== undefined) {
    value.inviteCode = inviteCode;
  }
  return { ok: true, value };
}
