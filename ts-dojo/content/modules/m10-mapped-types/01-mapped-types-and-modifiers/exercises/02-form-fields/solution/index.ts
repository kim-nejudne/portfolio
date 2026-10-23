export type Profile = {
  readonly id: number;
  name: string;
  bio?: string;
};

/** The state of one form input: its value, and whether the user has changed it. */
export type Field<V> = { value: V; dirty: boolean };

/** One Field per property of T, with that property's type and modifiers. */
export type Form<T> = { [K in keyof T]: Field<T[K]> };

export function field<V>(value: V): Field<V> {
  return { value, dirty: false };
}

/** A new profile has no bio yet. */
export const newProfile: Form<Profile> = {
  id: field(0),
  name: field(''),
};

/** The name to show: the trimmed name, or 'Anonymous' when that is empty. */
export function displayName(form: Form<Profile>): string {
  return form.name.value.trim() || 'Anonymous';
}

/** The keys of the fields the user has changed, in the form's order. */
export function dirtyKeys<T>(form: Form<T>): (keyof T)[] {
  const keys: (keyof T)[] = [];
  for (const key in form) {
    if (form[key]?.dirty) keys.push(key);
  }
  return keys;
}
