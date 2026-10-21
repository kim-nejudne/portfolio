import { showCell, showRow, type Cell } from './index';

const day = new Date('2026-10-21T12:00:00Z');

test('null and undefined show as empty', () => {
  expect(showCell(null)).toBe('');
  expect(showCell(undefined)).toBe('');
});

test('a string is trimmed', () => {
  expect(showCell('  Ada ')).toBe('Ada');
  expect(showCell('')).toBe('');
});

test('a number gets two decimals by default', () => {
  expect(showCell(3.14159)).toBe('3.14');
  expect(showCell(12)).toBe('12.00');
});

test('a number gets the decimals asked for', () => {
  expect(showCell(3.14159, 3)).toBe('3.142');
  expect(showCell(3.14159, 0)).toBe('3');
});

test('zero is a number, not an empty cell', () => {
  expect(showCell(0)).toBe('0.00');
  expect(showCell(0, 1)).toBe('0.0');
});

test('a boolean is yes or no', () => {
  expect(showCell(true)).toBe('yes');
  expect(showCell(false)).toBe('no');
});

test('a Date shows its day', () => {
  expect(showCell(day)).toBe('2026-10-21');
});

test('showRow shows and joins every cell', () => {
  const row: readonly Cell[] = ['Ada', 0, false, null, day, undefined];
  expect(showRow(row)).toBe('Ada | 0.00 | no |  | 2026-10-21 | ');
});

test('showRow passes decimals on', () => {
  expect(showRow([1.44, 'x', 2.71], 1)).toBe('1.4 | x | 2.7');
});

test('showRow of no cells is empty', () => {
  expect(showRow([])).toBe('');
});

test('numbers and strings over a range of values', () => {
  for (let n = -20; n <= 20; n++) {
    for (let decimals = 0; decimals <= 4; decimals++) {
      expect(showCell(n / 8, decimals)).toBe((n / 8).toFixed(decimals));
    }
    expect(showCell(` cell ${n}  `)).toBe(`cell ${n}`);
  }
});

test('dates across the year', () => {
  const two = (value: number) => String(value).padStart(2, '0');
  for (let month = 0; month < 12; month++) {
    for (const date of [1, 9, 10, 28]) {
      const cell = new Date(Date.UTC(2027, month, date, 12));
      expect(showCell(cell)).toBe(`2027-${two(month + 1)}-${two(date)}`);
    }
  }
});
