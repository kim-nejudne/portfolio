// The category editor's pieces (F81): the alternates field, the word filter, the bulk summary, and
// the markup of the list, a word row, the word list (with its filter from 20 words) and a bulk
// result. The flows run against the server in server/http.adminCategories.test.ts and the F81
// playtest.
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { AdminCategory, AdminWord } from '../../../../shared/types.js';
import { ADMIN_COPY, AdminBody, AdminFrame } from './Admin.js';
import {
  BulkResult,
  bulkSummary,
  CATEGORY_COPY,
  CategoryList,
  ClashQuestion,
  ImportError,
  ImportIssues,
  TransferCard,
  filterWords,
  parseAlts,
  WordList,
  WordRow,
} from './Categories.js';

const noop = () => undefined;

const words = (n: number): AdminWord[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `w${i}`,
    word: `word ${i}`,
    alt: [],
    difficulty: 2 as const,
  }));

const category = (n: number): AdminCategory => ({
  id: 'en-food',
  title: 'Food',
  emoji: '🍔',
  defaultOn: true,
  hidden: false,
  words: words(n),
});

const list = (c: AdminCategory, filter = '') =>
  renderToStaticMarkup(
    <WordList
      category={c}
      filter={filter}
      setFilter={noop}
      editing={null}
      setEditing={noop}
      onSaved={noop}
      onDelete={noop}
      deleting={null}
      error={null}
    />,
  );

describe('parseAlts', () => {
  it('splits on commas, trims and drops empties', () => {
    expect(parseAlts(' donut, doughnut ,, ')).toEqual(['donut', 'doughnut']);
    expect(parseAlts('')).toEqual([]);
  });
});

describe('filterWords', () => {
  const ws: AdminWord[] = [
    { id: 'doughnut', word: 'doughnut', alt: ['donut'], difficulty: 1 },
    { id: 'creme-brulee', word: 'crème brûlée', alt: [], difficulty: 3 },
    { id: 'pizza', word: 'Pizza', alt: [], difficulty: 1 },
  ];
  it('matches the word or an alternate, any case, accents ignored', () => {
    expect(filterWords(ws, 'DON').map((w) => w.id)).toEqual(['doughnut']);
    expect(filterWords(ws, 'brulee').map((w) => w.id)).toEqual(['creme-brulee']);
    expect(filterWords(ws, 'pizz').map((w) => w.id)).toEqual(['pizza']);
    expect(filterWords(ws, '  ')).toHaveLength(3);
    expect(filterWords(ws, 'zebra')).toEqual([]);
  });
});

describe('bulkSummary', () => {
  it('counts added words, duplicates and bad lines', () => {
    const c = category(0);
    expect(bulkSummary({ category: c, added: 1, duplicates: 0, errors: [] })).toBe('Added 1 word.');
    expect(
      bulkSummary({
        category: c,
        added: 3,
        duplicates: 2,
        errors: [{ line: 4, text: 'x | soon', reason: 'Level must be easy, medium or hard' }],
      }),
    ).toBe('Added 3 words. Skipped 2 duplicates. 1 line not added:');
  });
});

describe('CategoryList', () => {
  it('shows each category’s emoji, title, word count and badges, as buttons', () => {
    const html = renderToStaticMarkup(
      <CategoryList
        categories={[
          { id: 'a', title: 'Animals', emoji: '🐾', defaultOn: true, hidden: false, wordCount: 52 },
          { id: 's', title: 'Spicy', emoji: '🌶️', defaultOn: false, hidden: true, wordCount: 1 },
        ]}
        onOpen={noop}
      />,
    );
    expect(html.match(/<button type="button"/g)).toHaveLength(2);
    expect(html).toContain('🐾');
    expect(html).toContain('Animals');
    expect(html).toContain('<span class="font-num font-black">52</span> words');
    expect(html).toContain('<span class="font-num font-black">1</span> word<');
    expect(html.match(/Default on/g)).toHaveLength(1);
    expect(html.match(/>Hidden</g)).toHaveLength(1);
    expect(html.indexOf('Default on')).toBeLessThan(html.indexOf('Spicy'));
    expect(html.indexOf('>Hidden<')).toBeGreaterThan(html.indexOf('Spicy'));
  });

  it('says so when there are none', () => {
    expect(renderToStaticMarkup(<CategoryList categories={[]} onOpen={noop} />)).toContain(
      CATEGORY_COPY.empty,
    );
  });
});

describe('WordRow', () => {
  it('shows the word, its level and alternates, with labelled Edit and Delete', () => {
    const html = renderToStaticMarkup(
      <WordRow
        word={{ id: 'doughnut', word: 'doughnut', alt: ['donut', 'donuts'], difficulty: 1 }}
        onEdit={noop}
        onDelete={noop}
      />,
    );
    expect(html).toContain('doughnut');
    expect(html).toContain('>Easy<');
    expect(html).toContain('also: donut, donuts');
    expect(html).toContain('aria-label="Edit doughnut"');
    expect(html).toContain('aria-label="Delete doughnut"');
    // Touch targets: the shared link button is 44 px tall, and these are 44 px wide.
    expect(html.match(/min-h-11/g)!.length).toBeGreaterThanOrEqual(2);
    expect(html.match(/min-w-11/g)).toHaveLength(2);
  });
});

describe('WordList', () => {
  it('shows no filter below 20 words, and one from 20', () => {
    expect(list(category(19))).not.toContain('Filter words');
    const html = list(category(20));
    expect(html).toContain('Filter words');
    expect(html).toContain('type="search"');
    expect(html).toContain('<span class="font-num font-black">20</span>');
  });

  it('lists only the matching words while filtered', () => {
    const html = list(category(25), 'word 2');
    // word 2, word 20–24
    expect(html.match(/aria-label="Edit /g)).toHaveLength(6);
    expect(list(category(25), 'zebra')).toContain(CATEGORY_COPY.noMatch);
  });

  it('says so when the category has no words', () => {
    expect(list(category(0))).toContain(CATEGORY_COPY.noWords);
  });
});

describe('BulkResult', () => {
  it('lists each line not added with its number, text and reason', () => {
    const html = renderToStaticMarkup(
      <BulkResult
        result={{
          category: category(0),
          added: 2,
          duplicates: 1,
          errors: [{ line: 4, text: 'comet | soon', reason: 'Level must be easy, medium or hard' }],
        }}
      />,
    );
    expect(html).toContain('role="status"');
    expect(html).toContain('Added 2 words. Skipped 1 duplicate. 1 line not added:');
    expect(html).toContain('<span class="font-num font-black">4</span>');
    expect(html).toContain('comet | soon');
    expect(html).toContain('Level must be easy, medium or hard');
  });
});

describe('export and import (F82)', () => {
  it('offers Export all and a .json file picker with its 256 KB limit', () => {
    const html = renderToStaticMarkup(<TransferCard onImported={noop} />);
    expect(html).toContain(CATEGORY_COPY.transferHeading);
    expect(html).toContain(`>${CATEGORY_COPY.exportAll}</button>`);
    expect(html).toMatch(/<input[^>]*type="file"[^>]*accept=".json,application\/json"/);
    expect(html).toContain(CATEGORY_COPY.importLabel);
    expect(html).toContain('up to 256 KB');
    // The picker is labelled, and its hint is read with it.
    const id = /<input id="([^"]+)"[^>]*type="file"/.exec(html)?.[1];
    expect(html).toContain(`for="${id}"`);
    expect(html).toContain(`aria-describedby="${id}-hint admin-import-error"`);
  });

  it('asks what to do about a taken id: a copy, replace, or cancel', () => {
    const html = renderToStaticMarkup(
      <ClashQuestion
        clash={{ id: 'en-food', title: 'Food and Drinks' }}
        busy={false}
        onChoose={noop}
        onCancel={noop}
      />,
    );
    expect(html).toContain('role="group"');
    expect(html).toContain('“en-food”');
    expect(html).toContain('Food and Drinks');
    for (const label of [CATEGORY_COPY.importCopy, CATEGORY_COPY.replace, CATEGORY_COPY.cancel]) {
      expect(html).toContain(`>${label}</button>`);
    }
  });

  it('holds both choices and Cancel while one runs: a sent choice can’t be called back', () => {
    const html = renderToStaticMarkup(
      <ClashQuestion clash={{ id: 'a', title: 'A' }} busy onChoose={noop} onCancel={noop} />,
    );
    expect(html.match(/aria-disabled="true"/g)).toHaveLength(3);
  });

  it('reads the refusal and the file’s problems in one alert', () => {
    const html = renderToStaticMarkup(
      <ImportError
        id="admin-import-error"
        error={{ text: 'This file is not a valid category.', issues: ['language: Invalid input'] }}
      />,
    );
    expect(html).toMatch(/^<div id="admin-import-error" role="alert"/);
    expect(html).toContain('This file is not a valid category.');
    expect(html).toContain('<li>language: Invalid input</li>');
    expect(renderToStaticMarkup(<ImportError id="x" error={null} />)).toBe(
      '<div id="x" role="alert" class="grid gap-2"></div>',
    );
  });

  it('lists each of the file’s problems, and nothing when there are none', () => {
    const html = renderToStaticMarkup(
      <ImportIssues issues={['language: Invalid input', 'words.2.word: too short ("ab")']} />,
    );
    expect(html.match(/<li/g)).toHaveLength(2);
    expect(html).toContain('words.2.word: too short (&quot;ab&quot;)');
    expect(renderToStaticMarkup(<ImportIssues issues={undefined} />)).toBe('');
  });
});

describe('the signed-in shell', () => {
  it('holds the category editor under the Sign out bar', () => {
    const html = renderToStaticMarkup(
      <AdminFrame view="shell">
        <AdminBody view="shell" refresh={noop} setForgot={noop} />
      </AdminFrame>,
    );
    expect(html).toContain(ADMIN_COPY.signOut);
    expect(html).toContain(`>${CATEGORY_COPY.heading}</h2>`);
    expect(html).toContain(CATEGORY_COPY.newHeading);
    // Loading until the list arrives (effects don't run in a static render).
    expect(html).toContain(CATEGORY_COPY.loading);
  });
});
