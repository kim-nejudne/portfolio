export function trim(text: string | readonly string[]): string | string[];
export function trim(text: string): string;
export function trim(texts: readonly string[]): string[];
export function trim(text: string | readonly string[]): string | string[] {
  return typeof text === 'string' ? text.trim() : text.map((t) => t.trim());
}

export const title = trim('  Overloads  ').toUpperCase();
export const tags = trim([' ts ', ' overloads ']).join(',');
