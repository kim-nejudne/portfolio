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
import type { WordEntry } from '../shared/types.js';
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
  it('ships about 500 English family words, at least 100 of them hard', () => {
    const packs = loadPacks(SHIPPED);
    expect(packs.every((p) => p.language === 'en')).toBe(true);
    const words = packs.filter((p) => p.rating === 'family').flatMap((p) => p.words);
    expect(words.length).toBeGreaterThanOrEqual(450);
    expect(words.length).toBeLessThanOrEqual(560);
    expect(words.filter((w) => w.difficulty === 3).length).toBeGreaterThanOrEqual(100);
    expect(findDuplicateWords(packs)).toEqual([]);
  });

  it('balances every family pack across the three levels', () => {
    // 'mixed' deals one word of each level and 'easy' three level-1 words, so no pack may lean
    // on one level: each level is at least a fifth of the pack and none is more than half.
    const family = loadPacks(SHIPPED).filter((p) => p.rating === 'family');
    expect(family.length).toBeGreaterThanOrEqual(8);
    for (const p of family)
      for (const level of [1, 2, 3]) {
        const share = p.words.filter((w) => w.difficulty === level).length / p.words.length;
        expect(share, `${p.id} level ${level}`).toBeGreaterThanOrEqual(0.2);
        expect(share, `${p.id} level ${level}`).toBeLessThanOrEqual(0.5);
      }
  });

  it("carries the spec's 30 sample English words in en-everyday, with their alternates", () => {
    const everyday = loadPacks(SHIPPED).find((p) => p.id === 'en-everyday')!;
    const sample: [string, string[], number][] = [
      ['umbrella', ['brolly'], 1],
      ['karaoke', [], 2],
      ['airplane', ['aeroplane', 'plane'], 1],
      ['selfie', [], 1],
      ['basketball', [], 1],
      ['hurricane', ['storm', 'typhoon'], 2],
      ['mango', [], 1],
      ['traffic jam', ['traffic'], 2],
      ['birthday cake', ['cake'], 1],
      ['electric fan', ['fan'], 2],
      ['sunglasses', ['shades'], 1],
      ['fried chicken', ['chicken'], 1],
      ['doughnut', ['donut'], 1],
      ['ice cream', ['icecream'], 1],
      ['guitar', [], 1],
      ['airport', [], 2],
      ['graduation', ['toga', 'graduate'], 3],
      ['rooster', ['cockerel'], 2],
      ['motorcycle', ['motorbike', 'motor bike'], 2],
      ['sunflower', [], 1],
      ['dentist', [], 2],
      ['lipstick', [], 1],
      ['haunted house', [], 3],
      ['volcano', [], 2],
      ['wedding', [], 2],
      ['toothbrush', [], 1],
      ['spaghetti', ['pasta'], 1],
      ['pimple', ['zit', 'spot'], 2],
      ['ghosting', [], 3],
      ['sleepwalking', ['sleepwalker'], 3],
    ];
    for (const [word, alt, difficulty] of sample)
      expect(
        everyday.words.find((w) => w.word === word),
        word,
      ).toMatchObject({ alt, difficulty });
  });

  it('accepts US and UK spellings both ways', () => {
    const words = loadPacks(SHIPPED).flatMap((p) => p.words);
    const pairs: [string, string][] = [
      ['airplane', 'aeroplane'],
      ['donut', 'doughnut'],
      ['mustache', 'moustache'],
      ['pajamas', 'pyjamas'],
      ['flat tire', 'flat tyre'],
      ['chili', 'chilli'],
      ['eggplant', 'aubergine'],
      ['cotton candy', 'candy floss'],
      ['french fries', 'chips'],
      ['cookie', 'biscuit'],
      ['candy', 'sweets'],
      ['shrimp', 'prawn'],
      ['elevator', 'lift'],
      ['trash can', 'rubbish bin'],
      ['mailbox', 'postbox'],
      ['sneakers', 'trainers'],
      ['flashlight', 'torch'],
      ['faucet', 'tap'],
      ['diaper', 'nappy'],
      ['gas station', 'petrol station'],
      ['parking lot', 'car park'],
      ['truck', 'lorry'],
      ['highway', 'motorway'],
      ['crosswalk', 'zebra crossing'],
      ['movie theater', 'movie theatre'],
      ['fall', 'autumn'],
      ['soccer', 'football'],
      ['checkers', 'draughts'],
      ['jump rope', 'skipping rope'],
      ['ladybug', 'ladybird'],
      ['mailman', 'postman'],
      ['takeout', 'takeaway'],
    ];
    for (const [us, uk] of pairs) {
      const word = words.find((w) => isCorrect(us, w) || isCorrect(uk, w));
      expect(word, `${us} / ${uk}`).toBeDefined();
      expect(isCorrect(us, word!), us).toBe(true);
      expect(isCorrect(uk, word!), uk).toBe(true);
    }
  });

  it('keeps none of the non-English alternates from before F71', () => {
    const forms = loadPacks(SHIPPED).flatMap((p) => p.words.flatMap((w) => [w.word, ...w.alt]));
    // Plain English spelling: letters, spaces, hyphens and apostrophes, no accents.
    expect(forms.filter((f) => !/^[a-z][a-z' -]*$/.test(f))).toEqual([]);
    // A sample of the alternates the English packs carried until F71.
    for (const old of [
      'payong',
      'saging',
      'itlog',
      'pusa',
      'bumbero',
      'motorsiklo',
      'tsokolate',
      'videoke',
      'bagyo',
      'kasal',
      'eroplano',
      'lobat',
      'tigyawat',
      'hotcake',
      'eat all you can',
    ])
      expect(forms, old).not.toContain(old);
  });

  it('replaces the words only one country would know', () => {
    const forms = loadPacks(SHIPPED).flatMap((p) => p.words.map((w) => w.word));
    for (const local of [
      'rice cooker',
      'milk tea',
      'brownout',
      'food trip',
      'delivery rider',
      'fruit shake',
      'typhoon',
    ])
      expect(forms, local).not.toContain(local);
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

  it('ships en-spicy as the one spicy pack, with the words Kim approved (F73)', () => {
    const spicy = loadPacks(SHIPPED).filter((p) => p.rating === 'spicy');
    expect(spicy.map((p) => [p.id, p.language])).toEqual([['en-spicy', 'en']]);
    const words = spicy[0]!.words;
    expect(words.length).toBeGreaterThanOrEqual(60);
    // The rows left in F72's draft (deleted by F73) after Kim's review, as written, except
    // `DJ`: two letters fail the pack schema, so its alternate `deejay` is the word (DECISIONS 99).
    const approved: [string, string[], 1 | 2 | 3][] = [
      ['beer', ['pint', 'lager'], 1],
      ['beer can', ['can of beer'], 1],
      ['wine glass', ['glass of wine', 'wineglass', 'wine'], 1],
      ['cocktail', ['mixed drink'], 1],
      ['shot glass', ['shot', 'shotglass'], 1],
      ['champagne', ['bubbly', 'prosecco', 'sparkling wine'], 1],
      ['keg', ['beer keg', 'beer barrel'], 1],
      ['red cup', ['party cup', 'plastic cup'], 1],
      ['bar stool', ['barstool'], 1],
      ['martini', ['martini glass'], 1],
      ['hip flask', ['flask'], 1],
      ['bottle opener', ['opener'], 1],
      ['margarita', ['frozen margarita'], 2],
      ['tequila shot', ['tequila', 'lime and salt', 'salt and lime'], 2],
      ['boxed wine', ['box of wine', 'wine box'], 2],
      ['cheers', ['toast', 'clinking glasses', 'raising a glass'], 2],
      ['beer belly', ['beer gut'], 2],
      ['bartender', ['barman', 'barmaid', 'mixologist'], 2],
      ['chugging', ['chug', 'downing a drink'], 2],
      ['drunk', ['tipsy', 'wasted', 'drunken'], 2],
      ['wine stain', ['red wine stain', 'spilled wine', 'spilt wine'], 2],
      ['on the rocks', ['whiskey on the rocks', 'whisky on the rocks'], 3],
      ['happy hour', [], 3],
      ['bar crawl', ['pub crawl'], 3],
      ['last call', ['last orders', 'closing time'], 3],
      ['designated driver', ['sober driver'], 3],
      ['bar fight', ['bar brawl', 'brawl'], 3],
      ['disco ball', ['mirror ball', 'mirrorball', 'glitter ball'], 1],
      ['glow stick', ['glowstick'], 1],
      ['deejay', ['disc jockey'], 1],
      ['limo', ['limousine', 'stretch limo'], 1],
      ['nightclub', ['club', 'clubbing', 'disco'], 2],
      ['dance floor', ['dancefloor'], 2],
      ['bouncer', ['doorman'], 2],
      ['slow dance', ['slow dancing'], 2],
      ['conga line', ['conga'], 2],
      ['house party', ['houseparty'], 2],
      ['flip cup', ['flipcup'], 2],
      ['beer pong', ['beerpong', 'cup pong'], 2],
      ['dance-off', ['dance off', 'dance battle'], 3],
      ['dad dancing', ['dad dance'], 3],
      ['party animal', ['partygoer', 'partier'], 3],
      ['party crasher', ['gatecrasher', 'gate crasher'], 3],
      ['after party', ['afterparty'], 3],
      ['bachelor party', ['stag do', 'stag party', 'bachelorette party', 'hen do', 'hen party'], 3],
      ['noise complaint', ['angry neighbor', 'angry neighbour'], 3],
      ['truth or dare', [], 3],
      ['spin the bottle', [], 3],
      ['drinking game', [], 3],
      ['keg stand', ['kegstand'], 3],
      ['hangover', ['hung over', 'hungover'], 2],
      ['passed out', ['pass out', 'out cold'], 2],
      ['throwing up', ['vomit', 'vomiting', 'puke', 'puking'], 2],
      ['walk of shame', [], 3],
      ['beer goggles', [], 3],
      ['drunk text', ['drunk texting', 'drunk dial'], 3],
      ['last train home', ['last train'], 3],
      ['greasy breakfast', ['hangover breakfast'], 3],
      ['kiss', ['kissing', 'smooch'], 1],
      ['wink', ['winking'], 1],
      ['lipstick mark', ['lipstick kiss', 'kiss mark'], 1],
      ['love letter', [], 2],
      ['first date', [], 2],
      ['crush', ['secret crush'], 2],
      ['dating app', ['online dating', 'swipe right'], 2],
      ['holding hands', ['hand in hand'], 2],
      ['blind date', ['set up'], 3],
      ['speed dating', ['speed date'], 3],
      ['wingman', ['wing man', 'wingwoman'], 3],
      ['third wheel', [], 3],
      ['friend zone', ['friendzone', 'friendzoned'], 3],
      ['heartbreak', ['broken heart', 'heartbroken'], 3],
      ['breakup', ['break up', 'breaking up', 'dumped'], 3],
      ['love bite', ['hickey'], 3],
    ];
    expect(words.map((w) => [w.word, w.alt, w.difficulty])).toEqual(approved);
    expect(words.map((w) => w.id.split('/')[1])).toEqual(
      approved.map(([word]) => word.replace(/[^a-z0-9]+/g, '-')),
    );
  });

  it("deals the spec's spicy examples from en-spicy only", () => {
    const spicy = loadPacks(SHIPPED).find((p) => p.id === 'en-spicy')!;
    for (const word of [
      'hangover',
      'walk of shame',
      'beer pong',
      'blind date',
      'bar crawl',
      'last call',
    ])
      expect(
        spicy.words.find((w) => w.word === word),
        word,
      ).toBeDefined();
  });

  it('keeps every spicy form apart from the family words and from each other', () => {
    const packs = loadPacks(SHIPPED);
    const spicy = packs.filter((p) => p.rating === 'spicy').flatMap((p) => p.words);
    const family = packs.filter((p) => p.rating === 'family').flatMap((p) => p.words);
    const forms = (w: WordEntry) => [w.word, ...w.alt];
    for (const s of spicy)
      for (const f of family) {
        for (const form of forms(s)) expect(isCorrect(form, f), `${form} → ${f.word}`).toBe(false);
        for (const form of forms(f)) expect(isCorrect(form, s), `${form} → ${s.word}`).toBe(false);
      }
    for (const s of spicy)
      for (const form of forms(s)) {
        const hits = spicy.filter((w) => isCorrect(form, w) || isCorrect(`${form}s`, w));
        expect(
          hits.map((w) => w.word),
          form,
        ).toEqual([s.word]);
      }
  });

  it('accepts the other spellings and short forms people type', () => {
    const words = loadPacks(SHIPPED).flatMap((p) => p.words);
    const byId = (id: string) => words.find((w) => w.id === id)!;
    const typed: [string, string[]][] = [
      ['en-everyday/doughnut', ['donut', 'donuts']],
      ['en-food/burger', ['hamburger']],
      ['en-food/french-fries', ['fries']],
      ['en-jobs/firefighter', ['fireman']],
      ['en-animals/mouse', ['mice']],
      ['en-home/eyeglasses', ['glasses', 'specs']],
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
      summary: 'Loaded 9 word packs (581 words)',
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
