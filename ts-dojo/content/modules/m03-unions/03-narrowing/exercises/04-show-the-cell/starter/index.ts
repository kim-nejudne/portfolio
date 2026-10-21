/** A spreadsheet cell: null when it was cleared, undefined when it was never filled. */
export type Cell = string | number | boolean | Date | null | undefined;

/**
 * The text for one cell: '' for null and undefined; a string trimmed; a number with `decimals`
 * decimals; a boolean as 'yes' or 'no'; a Date as its day, such as '2026-10-21'.
 */
export function showCell(cell: Cell, decimals = 2): string {
  throw new Error('not implemented');
}

/** Every cell of the row shown with `decimals` decimals, joined with ' | '. */
export function showRow(row: readonly Cell[], decimals = 2): string {
  throw new Error('not implemented');
}
