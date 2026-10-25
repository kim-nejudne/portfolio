import type { Equal, Expect } from '@dojo/type-utils';
import { FileEntry, formatSize, README } from './index';
import { pick, STEP, type Unit } from './units';

type cases = [
  Expect<Equal<ReturnType<typeof pick>, Unit>>, // pick returns a Unit
  Expect<Equal<Unit, 'B' | 'KB' | 'MB'>>, // Unit is unchanged
  Expect<Equal<ReturnType<typeof formatSize>, string>>, // formatSize returns a string
  Expect<Equal<typeof README, FileEntry>>, // README is a FileEntry
  Expect<Equal<typeof STEP, 1024>>, // STEP keeps its literal type
];

// @ts-expect-error
const rename = (entry: FileEntry) => (entry.name = 'other'); // name stays readonly

test('pick chooses the largest unit with at least 1 in it', () => {
  expect(pick(0)).toBe('B');
  expect(pick(STEP - 1)).toBe('B');
  expect(pick(STEP)).toBe('KB');
  expect(pick(STEP * STEP - 1)).toBe('KB');
  expect(pick(STEP * STEP)).toBe('MB');
});

test('formatSize keeps bytes whole and gives one decimal otherwise', () => {
  expect(formatSize(512)).toBe('512 B');
  expect(formatSize(1536)).toBe('1.5 KB');
  expect(formatSize(3 * 1024 * 1024)).toBe('3.0 MB');
});

test('a FileEntry keeps its name and size and describes itself', () => {
  const entry = new FileEntry('photo.jpg', 5 * 1024 * 1024 + 512 * 1024);
  expect(entry.name).toBe('photo.jpg');
  expect(entry.bytes).toBe(5767168);
  expect(entry.describe()).toBe('photo.jpg (5.5 MB)');
});

test('README is a 2 KB file', () => {
  expect(README.describe()).toBe('README.md (2.0 KB)');
});
