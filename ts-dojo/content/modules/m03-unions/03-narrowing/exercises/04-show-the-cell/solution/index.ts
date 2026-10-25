/** A spreadsheet cell: null when it was cleared, undefined when it was never filled. */
export type Cell = string | number | boolean | Date | null | undefined;

/**
 * The text for one cell: '' for null and undefined; a string trimmed; a number with `decimals`
 * decimals; a boolean as 'yes' or 'no'; a Date as its day, such as '2026-10-21'.
 */
export function showCell(cell: Cell, decimals = 2): string {
  if (cell == null) {
    return '';
  } else if (typeof cell === 'string') {
    return cell.trim();
  } else if (typeof cell === 'number') {
    return cell.toFixed(decimals);
  } else if (typeof cell === 'boolean') {
    return cell ? 'yes' : 'no';
  } else {
    // only Date is left
    return cell.toISOString().slice(0, 10);
  }
}

/** Every cell of the row shown with `decimals` decimals, joined with ' | '. */
export function showRow(row: readonly Cell[], decimals = 2): string {
  return row.map((cell) => showCell(cell, decimals)).join(' | ');
}
