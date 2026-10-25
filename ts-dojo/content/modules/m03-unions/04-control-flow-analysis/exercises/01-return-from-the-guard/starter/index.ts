/** The initials of a full name, such as 'AL' for 'Ada Lovelace'; '?' when there is no name. */
export function initials(name: string | undefined): string {
  if (name === undefined) {
    console.warn('initials: no name given');
  }
  return name
    .split(' ')
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}
