// Labels for a saved set on the set list and the Host a game picker.

/** "1 question", "10 questions". */
export function questionCount(count: number): string {
  return `${count} ${count === 1 ? 'question' : 'questions'}`;
}

/** A set's last-edited time in the browser's locale, for example "28 Oct 2026, 14:05". */
export function formatEdited(updatedAt: number): string {
  return new Date(updatedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}
