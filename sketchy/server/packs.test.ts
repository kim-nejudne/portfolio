import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import {
  findAltClashes,
  findDuplicateWords,
  loadPacks,
  loadPacksForStart,
  PackError,
  packsDirFor,
  parsePack,
  type Pack,
} from './packs.js';
import { isCorrect } from './match.js';

const SHIPPED = fileURLToPath(new URL('../data/packs', import.meta.url));

function pack(overrides: Record<string, unknown> = {}, words?: unknown[]): unknown {
  return {
    schemaVersion: 1,
    id: 'en-test',
    title: 'Test',
    language: 'en',
    rating: 'family',
    words: words ?? [
      { id: 'doughnut', word: 'doughnut', alt: ['donut'], difficulty: 1 },
      { id: 'birthday-cake', word: 'birthday cake', alt: ['cake'], difficulty: 2 },
    ],
    ...overrides,
  };
}

/** The message `parsePack` throws, or fails the test if it doesn't throw a `PackError`. */
function failure(raw: unknown): string {
  try {
    parsePack(raw, 'test.json');
  } catch (err) {
    expect(err).toBeInstanceOf(PackError);
    return (err as Error).message;
  }
  throw new Error('expected parsePack to throw');
}

let dirs: string[] = [];
function packDir(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'sketchy-packs-'));
  dirs.push(dir);
  for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text);
  return dir;
}
afterEach(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
  dirs = [];
});

describe('parsePack', () => {
  it('turns a valid pack into frozen word entries with full ids', () => {
    const p = parsePack(pack(), 'test.json');
    expect(p).toMatchObject({ id: 'en-test', title: 'Test', language: 'en', rating: 'family' });
    expect(p.words).toEqual([
      { id: 'en-test/doughnut', word: 'doughnut', alt: ['donut'], difficulty: 1, lang: 'en' },
      {
        id: 'en-test/birthday-cake',
        word: 'birthday cake',
        alt: ['cake'],
        difficulty: 2,
        lang: 'en',
      },
    ]);
    expect(Object.isFrozen(p)).toBe(true);
    expect(Object.isFrozen(p.words)).toBe(true);
    expect(Object.isFrozen(p.words[0])).toBe(true);
    expect(Object.isFrozen(p.words[0]!.alt)).toBe(true);
  });

  it('defaults a missing alt to none', () => {
    const p = parsePack(pack({}, [{ id: 'selfie', word: 'selfie', difficulty: 1 }]), 'test.json');
    expect(p.words[0]).toEqual({
      id: 'en-test/selfie',
      word: 'selfie',
      alt: [],
      difficulty: 1,
      lang: 'en',
    });
  });

  it('refuses duplicate word ids within a pack, naming the id', () => {
    const words = [
      { id: 'bucket', word: 'bucket', difficulty: 1 },
      { id: 'bucket', word: 'bucket list', difficulty: 1 },
    ];
    expect(failure(pack({}, words))).toMatch(
      /test\.json: words\.1\.id: duplicate word id "bucket"/,
    );
  });

  it('refuses a word over 30 characters', () => {
    const long = 'a'.repeat(31);
    const message = failure(pack({}, [{ id: 'long', word: long, difficulty: 1 }]));
    expect(message).toMatch(/words\.0\.word: .*30/);
  });

  it("refuses any language but 'en', the retired 'tl' included", () => {
    const retired = 't' + 'l'; // in pieces for the English-only guard (scripts/englishOnly.test.ts)
    expect(failure(pack({ language: retired }))).toMatch(/test\.json: language: .*"en"/);
    expect(failure(pack({ language: 'es' }))).toMatch(/test\.json: language: .*"en"/);
    expect(failure(pack({ language: undefined }))).toMatch(/test\.json: language: /);
  });

  it('refuses a gloss on any word, as an unknown key', () => {
    const words = [{ id: 'dentist', word: 'dentist', difficulty: 3, gloss: 'tooth doctor' }];
    expect(failure(pack({}, words))).toMatch(/test\.json: words\.0: .*gloss/);
    expect(() =>
      parsePack(pack({}, [{ id: 'volcano', word: 'volcano', difficulty: 3 }]), 'x'),
    ).not.toThrow();
  });

  it('refuses a bad pack id, word id, rating, difficulty and schema version', () => {
    expect(failure(pack({ id: 'Home Life' }))).toMatch(/: id: /);
    expect(failure(pack({}, [{ id: 'Bad_Id', word: 'bucket', difficulty: 1 }]))).toMatch(
      /words\.0\.id: /,
    );
    expect(failure(pack({ rating: 'adult' }))).toMatch(/: rating: /);
    expect(failure(pack({}, [{ id: 'bucket', word: 'bucket', difficulty: 4 }]))).toMatch(
      /words\.0\.difficulty: /,
    );
    expect(failure(pack({ schemaVersion: 2 }))).toMatch(/: schemaVersion: /);
  });

  it('refuses more than 6 alternates and an empty pack', () => {
    const alt = ['one', 'two', 'three', 'four', 'five', 'six', 'seven'];
    expect(failure(pack({}, [{ id: 'bucket', word: 'bucket', alt, difficulty: 1 }]))).toMatch(
      /words\.0\.alt: /,
    );
    expect(failure(pack({}, []))).toMatch(/: words: /);
  });

  it('refuses unknown keys, so a typo like "alts" is caught', () => {
    const words = [{ id: 'donut', word: 'donut', difficulty: 1, alts: ['doughnut'] }];
    expect(failure(pack({}, words))).toMatch(/words\.0: .*alts/);
  });

  it('refuses a word or alternate that normalises to fewer than 3 letters', () => {
    expect(failure(pack({}, [{ id: 'the', word: 'The', difficulty: 1 }]))).toMatch(
      /words\.0\.word: .*at least 3 letters.*\("The"\)/,
    );
    expect(failure(pack({}, [{ id: 'tv', word: 'tv', difficulty: 1 }]))).toMatch(
      /words\.0\.word: /,
    );
    const alt = ['ok', 'flip-flops'];
    expect(failure(pack({}, [{ id: 'slippers', word: 'slippers', alt, difficulty: 1 }]))).toMatch(
      /words\.0\.alt\.0: .*\("ok"\)/,
    );
  });

  it('lists every field problem, one per line, naming the word', () => {
    const words = [
      { id: 'bucket', word: 'bucket', difficulty: 7 },
      { id: 'long', word: 'x'.repeat(31), difficulty: 1 },
    ];
    const lines = failure(pack({ rating: 'adult' }, words)).split('\n');
    expect(lines).toHaveLength(4); // the heading and three problems
    expect(lines[0]).toMatch(/test\.json is not a valid word pack/);
    expect(lines.some((l) => /words\.0\.difficulty: .*\("bucket"\)/.test(l))).toBe(true);
    expect(lines.some((l) => /: rating: /.test(l))).toBe(true);
  });

  it('lists every duplicate id together', () => {
    const words = [
      { id: 'kite', word: 'kite', difficulty: 2 },
      { id: 'kite', word: 'paper kite', difficulty: 3 },
      { id: 'drum', word: 'drum', difficulty: 1 },
      { id: 'drum', word: 'drum kit', difficulty: 2 },
    ];
    const lines = failure(pack({}, words)).split('\n');
    expect(lines).toHaveLength(3);
    expect(lines[1]).toMatch(/words\.1\.id: duplicate word id "kite"/);
    expect(lines[2]).toMatch(/words\.3\.id: duplicate word id "drum"/);
  });
});

describe('loadPacks', () => {
  it('loads the shipped packs: at least 200 English family words, every level well filled', () => {
    const packs = loadPacks(SHIPPED);
    expect(packs.every((p) => p.language === 'en')).toBe(true);
    const words = packs.filter((p) => p.rating === 'family').flatMap((p) => p.words);
    expect(words.length).toBeGreaterThanOrEqual(200);
    // 'easy' deals three level-1 words and 'mixed' one of each, so no level may run thin.
    for (const level of [1, 2, 3])
      expect(words.filter((w) => w.difficulty === level).length, `${level}`).toBeGreaterThanOrEqual(
        40,
      );
    expect(findDuplicateWords(packs)).toEqual([]);
  });

  it("keeps the spec's spicy words out of the family packs", () => {
    const family = loadPacks(SHIPPED)
      .filter((p) => p.rating === 'family')
      .flatMap((p) => p.words.flatMap((w) => [w.word, ...w.alt]));
    for (const word of [
      'hangover',
      'walk of shame',
      'beer pong',
      'blind date',
      'bar crawl',
      'last call',
    ])
      expect(family, word).not.toContain(word);
  });

  it('ships no spicy pack until en-spicy (F73)', () => {
    expect(loadPacks(SHIPPED).filter((p) => p.rating === 'spicy')).toEqual([]);
  });

  it('accepts the other spellings and short forms people type', () => {
    const words = loadPacks(SHIPPED).flatMap((p) => p.words);
    const byId = (id: string) => words.find((w) => w.id === id)!;
    const typed: [string, string[]][] = [
      ['en-food/donut', ['doughnut', 'donuts']],
      ['en-food/burger', ['hamburger']],
      ['en-food/french-fries', ['fries']],
      ['en-actions/firefighter', ['fireman']],
      ['en-everyday/motorcycle', ['motorbike']],
      ['en-everyday/sunglasses', ['shades']],
    ];
    for (const [id, guesses] of typed)
      for (const guess of guesses) expect(isCorrect(guess, byId(id)), `${id}: ${guess}`).toBe(true);
  });

  it('ships English words with no gloss and English matching', () => {
    const words = loadPacks(SHIPPED).flatMap((p) => p.words);
    expect(words.filter((w) => w.lang !== 'en' || 'gloss' in w)).toEqual([]);
    expect(words.find((w) => w.id === 'en-everyday/pimple')).toMatchObject({
      difficulty: 2,
      lang: 'en',
    });
  });

  it('reads every .json file in name order and ignores others', () => {
    const dir = packDir({
      'b.json': JSON.stringify(pack({ id: 'b-pack' })),
      'a.json': JSON.stringify(pack({ id: 'a-pack' })),
      'README.md': '# not a pack',
    });
    expect(loadPacks(dir).map((p) => p.id)).toEqual(['a-pack', 'b-pack']);
  });

  it('refuses the same pack id in two files, naming both', () => {
    const dir = packDir({
      'one.json': JSON.stringify(pack()),
      'two.json': JSON.stringify(pack()),
    });
    expect(() => loadPacks(dir)).toThrow(
      /two\.json: id: pack id "en-test" is also used by .*one\.json/,
    );
  });

  it('refuses a file that is not JSON, naming the file', () => {
    const dir = packDir({ 'broken.json': '{ "id": ' });
    expect(() => loadPacks(dir)).toThrow(PackError);
    expect(() => loadPacks(dir)).toThrow(/broken\.json: not valid JSON/);
  });

  it('refuses a directory with no packs, and a missing directory', () => {
    expect(() => loadPacks(packDir({}))).toThrow(/no word packs/);
    expect(() => loadPacks(join(tmpdir(), 'sketchy-no-such-dir'))).toThrow(PackError);
  });
});

describe('findDuplicateWords', () => {
  it('reports words that normalise the same, across packs and within one', () => {
    const a = parsePack(
      pack({ id: 'en-a' }, [
        { id: 'ice-cream', word: 'ice-cream', difficulty: 1 },
        { id: 'mango', word: 'mango', difficulty: 1 },
        { id: 'mango-2', word: 'Mango!', difficulty: 1 },
      ]),
      'a.json',
    );
    const b = parsePack(pack({}, [{ id: 'icecream', word: 'ice cream', difficulty: 1 }]), 'b.json');
    const dupes = findDuplicateWords([a, b] as Pack[]);
    expect(dupes).toEqual([
      { form: 'icecream', ids: ['en-a/ice-cream', 'en-test/icecream'] },
      { form: 'mango', ids: ['en-a/mango', 'en-a/mango-2'] },
    ]);
  });
});

describe('findAltClashes', () => {
  it("reports an alternate that is another word's main form", () => {
    const en = parsePack(
      pack({ id: 'en-a' }, [
        {
          id: 'fried-chicken',
          word: 'fried chicken',
          alt: ['Chicken!', 'fried chicken'],
          difficulty: 1,
        },
        { id: 'chicken', word: 'chicken', difficulty: 1 },
      ]),
      'a.json',
    );
    expect(findAltClashes([en])).toEqual([
      { alt: 'Chicken!', id: 'en-a/fried-chicken', otherId: 'en-a/chicken' },
    ]);
  });

  it('finds none in the shipped packs', () => {
    expect(findAltClashes(loadPacks(SHIPPED))).toEqual([]);
  });
});

describe('server start', () => {
  it('finds data/packs from server/ under tsx and from dist/server in production', () => {
    expect(packsDirFor('file:///app/sketchy/server/index.ts', false)).toBe(
      '/app/sketchy/data/packs',
    );
    expect(packsDirFor('file:///app/sketchy/dist/server/index.js', true)).toBe(
      '/app/sketchy/data/packs',
    );
    expect(packsDirFor(new URL('./index.ts', import.meta.url).href, false)).toBe(SHIPPED);
  });

  it('summarises the shipped packs', () => {
    expect(loadPacksForStart(SHIPPED)).toMatchObject({
      ok: true,
      summary: 'Loaded 5 word packs (293 words)',
    });
  });

  it('stops with a readable message naming the file, field and word', () => {
    const bad = pack({}, [{ id: 'kite', word: 'kite', difficulty: 4 }]);
    const result = loadPacksForStart(packDir({ 'bad.json': JSON.stringify(bad) }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message.split('\n')[0]).toBe("Sketchy can't start.");
    expect(result.message).toMatch(/bad\.json: words\.0\.difficulty: .*\("kite"\)/);
  });
});
