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
    id: 'tl-test',
    title: 'Test',
    language: 'tl',
    rating: 'family',
    words: words ?? [
      { id: 'tsinelas', word: 'tsinelas', alt: ['chinelas', 'slippers'], difficulty: 1 },
      {
        id: 'bahay-kubo',
        word: 'bahay kubo',
        alt: ['kubo', 'nipa hut'],
        difficulty: 2,
        gloss: 'small bamboo house on stilts',
      },
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
    expect(p).toMatchObject({ id: 'tl-test', title: 'Test', language: 'tl', rating: 'family' });
    expect(p.words).toEqual([
      {
        id: 'tl-test/tsinelas',
        word: 'tsinelas',
        alt: ['chinelas', 'slippers'],
        difficulty: 1,
        lang: 'tl',
      },
      {
        id: 'tl-test/bahay-kubo',
        word: 'bahay kubo',
        alt: ['kubo', 'nipa hut'],
        difficulty: 2,
        lang: 'tl',
        gloss: 'small bamboo house on stilts',
      },
    ]);
    expect(Object.isFrozen(p)).toBe(true);
    expect(Object.isFrozen(p.words)).toBe(true);
    expect(Object.isFrozen(p.words[0])).toBe(true);
    expect(Object.isFrozen(p.words[0]!.alt)).toBe(true);
  });

  it('defaults a missing alt to none and accepts a gloss on any word', () => {
    const p = parsePack(
      pack({ language: 'en', id: 'en-test' }, [
        { id: 'selfie', word: 'selfie', difficulty: 1 },
        { id: 'dentist', word: 'dentist', difficulty: 3, gloss: 'tooth doctor' },
      ]),
      'test.json',
    );
    expect(p.words[0]).toEqual({
      id: 'en-test/selfie',
      word: 'selfie',
      alt: [],
      difficulty: 1,
      lang: 'en',
    });
    expect(p.words[1]!.gloss).toBe('tooth doctor');
  });

  it('refuses duplicate word ids within a pack, naming the id', () => {
    const words = [
      { id: 'tabo', word: 'tabo', difficulty: 1 },
      { id: 'tabo', word: 'tabo ulit', difficulty: 1 },
    ];
    expect(failure(pack({}, words))).toMatch(/test\.json: words\.1\.id: duplicate word id "tabo"/);
  });

  it('refuses a word over 30 characters', () => {
    const long = 'a'.repeat(31);
    const message = failure(pack({}, [{ id: 'long', word: long, difficulty: 1 }]));
    expect(message).toMatch(/words\.0\.word: .*30/);
  });

  it('refuses an unknown language', () => {
    expect(failure(pack({ language: 'es' }))).toMatch(/test\.json: language: .*"en".*"tl"/);
  });

  it('refuses a tl word of difficulty 2 or 3 without a gloss, naming the word', () => {
    const words = [{ id: 'balut', word: 'balut', difficulty: 2 }];
    expect(failure(pack({}, words))).toMatch(
      /test\.json: words\.0\.gloss: required for 'tl' words of difficulty 2–3 \("balut"\)/,
    );
    const hard = [{ id: 'sungka', word: 'sungka', difficulty: 3 }];
    expect(failure(pack({}, hard))).toMatch(/words\.0\.gloss: required .*\("sungka"\)/);
  });

  it('does not need a gloss on easy tl words or on en words', () => {
    const easy = [{ id: 'tabo', word: 'tabo', difficulty: 1 }];
    expect(() => parsePack(pack({}, easy), 'x')).not.toThrow();
    expect(() =>
      parsePack(pack({ language: 'en' }, [{ id: 'volcano', word: 'volcano', difficulty: 3 }]), 'x'),
    ).not.toThrow();
  });

  it('refuses a bad pack id, word id, rating, difficulty and schema version', () => {
    expect(failure(pack({ id: 'Pinoy Life' }))).toMatch(/: id: /);
    expect(failure(pack({}, [{ id: 'Bad_Id', word: 'tabo', difficulty: 1 }]))).toMatch(
      /words\.0\.id: /,
    );
    expect(failure(pack({ rating: 'adult' }))).toMatch(/: rating: /);
    expect(failure(pack({}, [{ id: 'tabo', word: 'tabo', difficulty: 4 }]))).toMatch(
      /words\.0\.difficulty: /,
    );
    expect(failure(pack({ schemaVersion: 2 }))).toMatch(/: schemaVersion: /);
  });

  it('refuses more than 6 alternates, a gloss over 40 characters and an empty pack', () => {
    const alt = ['one', 'two', 'three', 'four', 'five', 'six', 'seven'];
    expect(failure(pack({}, [{ id: 'tabo', word: 'tabo', alt, difficulty: 1 }]))).toMatch(
      /words\.0\.alt: /,
    );
    const gloss = 'g'.repeat(41);
    expect(failure(pack({}, [{ id: 'balut', word: 'balut', difficulty: 2, gloss }]))).toMatch(
      /words\.0\.gloss: /,
    );
    expect(failure(pack({}, []))).toMatch(/: words: /);
  });

  it('refuses unknown keys, so a typo like "glos" is caught', () => {
    const words = [{ id: 'balut', word: 'balut', difficulty: 2, glos: 'duck egg' }];
    expect(failure(pack({}, words))).toMatch(/words\.0: .*glos/);
  });

  it('refuses a word or alternate that normalises to fewer than 3 letters', () => {
    expect(failure(pack({}, [{ id: 'the', word: 'The', difficulty: 1 }]))).toMatch(
      /words\.0\.word: .*at least 3 letters.*\("The"\)/,
    );
    expect(failure(pack({}, [{ id: 'tv', word: 'tv', difficulty: 1 }]))).toMatch(
      /words\.0\.word: /,
    );
    const alt = ['ok', 'chinelas'];
    expect(failure(pack({}, [{ id: 'tsinelas', word: 'tsinelas', alt, difficulty: 1 }]))).toMatch(
      /words\.0\.alt\.0: .*\("ok"\)/,
    );
  });

  it('lists every field problem, one per line, naming the word', () => {
    const words = [
      { id: 'tabo', word: 'tabo', difficulty: 7 },
      { id: 'long', word: 'x'.repeat(31), difficulty: 1 },
    ];
    const lines = failure(pack({ rating: 'adult' }, words)).split('\n');
    expect(lines).toHaveLength(4); // the heading and three problems
    expect(lines[0]).toMatch(/test\.json is not a valid word pack/);
    expect(lines.some((l) => /words\.0\.difficulty: .*\("tabo"\)/.test(l))).toBe(true);
    expect(lines.some((l) => /: rating: /.test(l))).toBe(true);
  });

  it('lists every gloss and id problem together', () => {
    const words = [
      { id: 'balut', word: 'balut', difficulty: 2 },
      { id: 'balut', word: 'taho', difficulty: 3 },
    ];
    const lines = failure(pack({}, words)).split('\n');
    expect(lines).toHaveLength(4);
  });
});

describe('loadPacks', () => {
  it('loads the shipped packs: at least 200 en and 200 tl family words, every level well filled', () => {
    const packs = loadPacks(SHIPPED);
    const family = packs.filter((p) => p.rating === 'family');
    for (const lang of ['en', 'tl'] as const) {
      const words = family.filter((p) => p.language === lang).flatMap((p) => p.words);
      expect(words.length, lang).toBeGreaterThanOrEqual(200);
      // 'easy' deals three level-1 words and 'mixed' one of each, so no level may run thin.
      for (const level of [1, 2, 3])
        expect(
          words.filter((w) => w.difficulty === level).length,
          `${lang} ${level}`,
        ).toBeGreaterThanOrEqual(40);
    }
    expect(findDuplicateWords(packs)).toEqual([]);
  });

  it('keeps the spicy list out of the family packs', () => {
    // F47's "Pang-inuman" pack holds these; a family copy would be a duplicate word.
    const family = loadPacks(SHIPPED)
      .filter((p) => p.rating === 'family')
      .flatMap((p) => p.words.flatMap((w) => [w.word, ...w.alt]));
    for (const word of [
      'tagay',
      'jowa',
      'hangover',
      'walk of shame',
      'pulutan',
      'inuman',
      'sabit',
      'lasing',
    ])
      expect(family, word).not.toContain(word);
  });

  it('accepts the common spellings people type (ts/ch, j/dy, e/i, o/u) and the other language', () => {
    const words = loadPacks(SHIPPED).flatMap((p) => p.words);
    const byId = (id: string) => words.find((w) => w.id === id)!;
    const typed: [string, string[]][] = [
      ['tl-pinoy-life/tsinelas', ['chinelas', 'slippers']],
      ['tl-pinoy-life/jeepney', ['dyip', 'jeep']],
      ['tl-pinoy-life/lechon', ['litson']],
      ['tl-pagkain/longganisa', ['longanisa', 'longaniza']],
      ['tl-pagkain/chicharon', ['tsitsaron', 'chicharron', 'pork rinds']],
      ['tl-pagkain/champorado', ['tsamporado']],
      ['tl-pagkain/tocino', ['tosino']],
      ['tl-pagkain/kutsinta', ['cuchinta']],
      ['tl-labas/kalesa', ['calesa']],
      ['tl-labas/probinsya', ['probinsiya', 'province']],
      ['tl-gawain/duwende', ['dwende']],
      ['tl-bahay/kaldero', ['caldero']],
      ['en-food/chocolate', ['tsokolate']],
      ['en-outdoors/butterfly', ['paru-paro', 'paruparo']],
      ['en-home/necklace', ['kuwintas', 'kwintas']],
    ];
    for (const [id, guesses] of typed)
      for (const guess of guesses) expect(isCorrect(guess, byId(id)), `${id}: ${guess}`).toBe(true);
  });

  it('ships the spec sample words as written, glosses and alternates included', () => {
    const words = loadPacks(SHIPPED).flatMap((p) => p.words);
    const byId = (id: string) => words.find((w) => w.id === id);
    expect(byId('tl-pinoy-life/bahay-kubo')).toEqual({
      id: 'tl-pinoy-life/bahay-kubo',
      word: 'bahay kubo',
      alt: ['kubo', 'nipa hut'],
      difficulty: 2,
      lang: 'tl',
      gloss: 'small bamboo house on stilts',
    });
    expect(byId('tl-pinoy-life/salakot')?.gloss).toBe("wide woven farmer's hat");
    expect(byId('en-everyday/motorcycle')?.alt).toEqual(['motor', 'motorbike', 'motorsiklo']);
    expect(byId('en-everyday/pimple')).toMatchObject({ difficulty: 2, lang: 'en' });
    // Every tl word of difficulty 2–3 carries its gloss (the schema's rule, checked on real data).
    const tlHard = words.filter((w) => w.lang === 'tl' && w.difficulty >= 2);
    expect(tlHard.length).toBeGreaterThan(100);
    expect(tlHard.filter((w) => !w.gloss)).toEqual([]);
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
      /two\.json: id: pack id "tl-test" is also used by .*one\.json/,
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
      pack({ id: 'en-a', language: 'en' }, [
        { id: 'halo-halo', word: 'halo-halo', difficulty: 1 },
        { id: 'mango', word: 'mango', difficulty: 1 },
        { id: 'mango-2', word: 'Mango!', difficulty: 1 },
      ]),
      'a.json',
    );
    const b = parsePack(pack({}, [{ id: 'halo', word: 'halo halo', difficulty: 1 }]), 'b.json');
    const dupes = findDuplicateWords([a, b] as Pack[]);
    expect(dupes).toEqual([
      { form: 'halohalo', ids: ['en-a/halo-halo', 'tl-test/halo'] },
      { form: 'mango', ids: ['en-a/mango', 'en-a/mango-2'] },
    ]);
  });
});

describe('findAltClashes', () => {
  it("reports an alternate that is another word's main form", () => {
    const en = parsePack(
      pack({ id: 'en-a', language: 'en' }, [
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
      summary: 'Loaded 10 word packs (517 words)',
    });
  });

  it('stops with a readable message naming the file, field and word', () => {
    const bad = pack({}, [{ id: 'balut', word: 'balut', difficulty: 2 }]);
    const result = loadPacksForStart(packDir({ 'tl.json': JSON.stringify(bad) }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message.split('\n')[0]).toBe("Sketchy can't start.");
    expect(result.message).toMatch(/tl\.json: words\.0\.gloss: required .*\("balut"\)/);
  });
});
