export type ButtonOptions = { label: string; color?: string };

export function button(options: ButtonOptions): string {
  return `[${options.label}] in ${options.color ?? 'gray'}`;
}

export const save = button({ label: 'Save', color: 'green' });

export const deleteOptions: ButtonOptions = { label: 'Delete', color: 'red' };
export const remove = button(deleteOptions);
