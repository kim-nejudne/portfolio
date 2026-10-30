// `npm run packs:check`: validates every pack in data/packs/ with the schema and rules the server
// uses at start (server/packs.ts), then reports words that appear twice, across packs or within one
// (an error), and alternates that equal another word (a warning).
import { fileURLToPath } from 'node:url';
import {
  findAltClashes,
  findDuplicateWords,
  loadPacks,
  PackError,
  type Pack,
} from '../server/packs.js';

const dir = process.argv[2] ?? fileURLToPath(new URL('../data/packs', import.meta.url));

let packs: Pack[];
try {
  packs = loadPacks(dir);
} catch (err) {
  if (!(err instanceof PackError)) throw err;
  console.error(err.message);
  process.exit(1);
}

for (const pack of packs) {
  const levels = [1, 2, 3].map((d) => pack.words.filter((w) => w.difficulty === d).length);
  console.log(
    `✓ ${pack.id} (${pack.language}, ${pack.rating}): ${pack.words.length} words, ` +
      `easy ${levels[0]} · medium ${levels[1]} · hard ${levels[2]}`,
  );
}

// A warning only: the clash skews the deck but matching still works.
for (const { alt, id, otherId } of findAltClashes(packs)) {
  console.warn(`⚠ ${id}: alternate "${alt}" is also the word ${otherId}`);
}

const dupes = findDuplicateWords(packs);
if (dupes.length > 0) {
  console.error(`\n${dupes.length} duplicate word(s):`);
  for (const { form, ids } of dupes) console.error(`  "${form}": ${ids.join(', ')}`);
  process.exit(1);
}
console.log(`\nAll ${packs.length} packs are valid, with no duplicate words.`);
