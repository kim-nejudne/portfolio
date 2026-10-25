export type ButtonOptions = { label: string; color?: string };

export function button(options: ButtonOptions): string {
  return `[${options.label}] in ${options.color ?? 'gray'}`;
}

export const save = button({ label: 'Save', colour: 'green' });

export const deleteOptions = { label: 'Delete', colour: 'red' };
export const remove = button(deleteOptions);
