export type SignUp = {
  email: string;
  password: string;
  age: number;
  inviteCode?: string;
};

// Written by hand, these accept fields that SignUp doesn't have. Derive both from SignUp.
/** What the form holds while the user types: any field may still be missing. */
export type Draft = Record<string, unknown>;
/** One message per field that fails; a field that passes has no entry. */
export type FormErrors = Record<string, string>;

export type SubmitResult =
  { ok: true; value: SignUp } | { ok: false; errors: FormErrors };

/** The message for every field of the draft that fails its rule. */
export function validate(draft: Draft): FormErrors {
  throw new Error(`not implemented for ${Object.keys(draft).length} fields`);
}

/** The finished SignUp when the draft has no errors, or the errors when it has some. */
export function submit(draft: Draft): SubmitResult {
  throw new Error(`not implemented for ${Object.keys(draft).length} fields`);
}
