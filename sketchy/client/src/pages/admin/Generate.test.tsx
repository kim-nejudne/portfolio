// Word generation's pieces (F83): the job rows (running, ready, failed), the panel's markup
// before its status loads, a draft row, the ticked words a save sends, how a refusal finds its
// row, and the save summary. The flows run against the server in
// server/http.adminGenerate.test.ts and the F83 playtest.
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type {
  AdminGenerationJob,
  AdminGenerationSpend,
  GenerationHistoryEntry,
} from '../../../../shared/types.js';
import {
  draftSummary,
  DraftWordRow,
  GENERATE_COPY,
  GeneratePanel,
  jobAnnouncement,
  JobRow,
  refusedRow,
  SpendHistory,
  SpendTiles,
  tickedWords,
  toRows,
} from './Generate.js';

const noop = () => undefined;

const job = (over: Partial<AdminGenerationJob> = {}): AdminGenerationJob => ({
  id: 'j1',
  kind: 'new',
  title: 'Kitchen',
  categoryId: null,
  count: 40,
  status: 'ready',
  stage: null,
  error: null,
  startedAt: 1,
  draft: {
    emoji: '🍳',
    words: [
      { word: 'kettle', alt: [], difficulty: 1 },
      { word: 'frying pan', alt: ['skillet', 'fry pan'], difficulty: 2 },
    ],
  },
  ...over,
});

const spend = (over: Partial<AdminGenerationSpend> = {}): AdminGenerationSpend => ({
  capUsd: 5,
  monthUsd: 0,
  allTimeUsd: 0,
  last: null,
  history: [],
  total: 0,
  refused: null,
  ...over,
});

describe('JobRow', () => {
  it('a running job shows its stage', () => {
    const html = renderToStaticMarkup(
      <JobRow
        job={job({ status: 'running', stage: 'checking', draft: null })}
        onReview={noop}
        onDiscard={noop}
        busy={false}
      />,
    );
    expect(html).toContain('Generating for “Kitchen”');
    expect(html).toContain('Checking words…');
  });

  it('the panel’s one live region says how the newest job is doing', () => {
    expect(jobAnnouncement(job({ status: 'running', stage: 'writing', draft: null }))).toBe(
      'Generating for “Kitchen”: Writing words…',
    );
    expect(jobAnnouncement(job())).toBe('Kitchen: 2 of 40 words ready');
    expect(jobAnnouncement(job({ status: 'failed', draft: null, error: 'Claude declined.' }))).toBe(
      'Kitchen: generation failed. Claude declined.',
    );
    const html = renderToStaticMarkup(
      <GeneratePanel
        categoryId={null}
        onReview={noop}
        initial={{
          mode: 'claude',
          off: null,
          jobs: [job({ status: 'running', stage: 'writing', draft: null })],
          spend: spend(),
        }}
      />,
    );
    expect(html).toContain(
      '<p role="status" class="sr-only">Generating for “Kitchen”: Writing words…</p>',
    );
    // Held while it runs, and the button says why.
    expect(html).toMatch(
      /<p id="([^"]+)"[^>]*>A generation is running\. One at a time: wait for it to finish\.<\/p>/,
    );
    const busyId = /<p id="([^"]+)"[^>]*>A generation is running/.exec(html)![1];
    expect(html).toMatch(
      new RegExp(`<button type="submit"[^>]*aria-disabled="true" aria-describedby="${busyId}">`),
    );
  });

  it('a ready draft shows how many words were kept, with Review and Discard named for it', () => {
    const html = renderToStaticMarkup(
      <JobRow job={job()} onReview={noop} onDiscard={noop} busy={false} />,
    );
    expect(html).toContain('Kitchen: 2 of 40 words ready');
    expect(html).toContain('aria-label="Review the draft for Kitchen"');
    expect(html).toContain('aria-label="Discard the draft for Kitchen"');
    // Never the drafted words themselves on the list.
    expect(html).not.toContain('kettle');
  });

  it('a failed job shows the message and a Dismiss', () => {
    const html = renderToStaticMarkup(
      <JobRow
        job={job({ status: 'failed', draft: null, error: 'Claude declined.' })}
        onReview={noop}
        onDiscard={noop}
        busy={false}
      />,
    );
    expect(html).toContain('Kitchen: generation failed. Claude declined.');
    expect(html).toContain('aria-label="Dismiss the failed generation for Kitchen"');
  });
});

describe('GeneratePanel', () => {
  it('asks for a title and a number of words (40 by default) on the list', () => {
    const html = renderToStaticMarkup(<GeneratePanel categoryId={null} onReview={noop} />);
    expect(html).toContain('Generate a category');
    expect(html).toContain('name="generate-title"');
    expect(html).toContain('name="generate-count"');
    expect(html).toContain('type="number"');
    expect(html).toContain('min="10"');
    expect(html).toContain('max="100"');
    expect(html).toContain('value="40"');
    // Held until the status says generation is on.
    expect(html).toMatch(
      /<button type="submit"[^>]*aria-disabled="true">Generate 40 words<\/button>/,
    );
  });

  it('when generation is off, the held button says why', () => {
    const off = 'Generation is off: the server has no SKETCHY_ANTHROPIC_API_KEY.';
    const html = renderToStaticMarkup(
      <GeneratePanel
        categoryId={null}
        onReview={noop}
        initial={{ mode: 'off', off, jobs: [], spend: spend() }}
      />,
    );
    const describedBy = /<p id="([^"]+)"[^>]*>Generation is off/.exec(html)?.[1];
    expect(describedBy).toBeDefined();
    expect(html).toMatch(
      new RegExp(
        `<button type="submit"[^>]*aria-disabled="true" aria-describedby="${describedBy}">Generate</button>`,
      ),
    );
  });

  it('lists this panel’s drafts, and says when the fake generator runs', () => {
    const html = renderToStaticMarkup(
      <GeneratePanel
        categoryId="en-food"
        onReview={noop}
        initial={{
          mode: 'fake',
          off: null,
          jobs: [
            job({ id: 'a', kind: 'more', categoryId: 'en-food', title: 'Food' }),
            job({ id: 'b', title: 'Kitchen' }),
          ],
          spend: spend(),
        }}
      />,
    );
    expect(html).toContain(GENERATE_COPY.fake);
    expect(html).toContain('Food: 2 of 40 words ready');
    // Another category's draft is listed on the list page, not here.
    expect(html).not.toContain('Kitchen');
  });

  it('asks only for the number on a category’s page (Generate more)', () => {
    const html = renderToStaticMarkup(<GeneratePanel categoryId="en-food" onReview={noop} />);
    expect(html).toContain(GENERATE_COPY.moreHeading);
    expect(html).not.toContain('name="generate-title"');
  });
});

describe('reviewing a draft', () => {
  it('starts with every word ticked, alternates as a comma list', () => {
    expect(toRows(job().draft!.words)).toEqual([
      { key: 0, ticked: true, word: 'kettle', level: 1, alts: '' },
      { key: 1, ticked: true, word: 'frying pan', level: 2, alts: 'skillet, fry pan' },
    ]);
  });

  it('saves only the ticked words, as edited', () => {
    const rows = toRows(job().draft!.words);
    rows[0] = { ...rows[0]!, ticked: false };
    rows[1] = { ...rows[1]!, word: ' pan ', level: 3, alts: 'skillet, , wok' };
    expect(tickedWords(rows)).toEqual([{ word: 'pan', difficulty: 3, alt: ['skillet', 'wok'] }]);
  });

  it('finds the row a refusal names, counting ticked rows only', () => {
    const rows = toRows([...job().draft!.words, { word: 'ab', alt: [], difficulty: 1 }]);
    rows[0] = { ...rows[0]!, ticked: false };
    expect(refusedRow(rows, 'words.1.word')).toEqual({ key: 2, part: 'word' });
    expect(refusedRow(rows, 'words.0.alt')).toEqual({ key: 1, part: 'alt' });
    expect(refusedRow(rows, 'title')).toBeNull();
    expect(refusedRow(rows, 'words.5.word')).toBeNull();
  });

  it('a row has a 44 px Keep checkbox and labelled word, level and alternates fields', () => {
    const [row] = toRows(job().draft!.words.slice(1));
    const html = renderToStaticMarkup(
      <DraftWordRow row={row!} index={1} invalid="alt" errorId="e" onChange={noop} />,
    );
    expect(html).toContain('<label class="flex size-11 items-center justify-center">');
    // Ticked: no strike-through. The checkbox is centred in its 44 px label.
    expect(html).not.toContain('line-through');
    expect(html).not.toMatch(/type="checkbox" class="mt-1/);
    expect(html).toContain('aria-label="Keep frying pan"');
    expect(html).toContain('aria-label="Word 2"');
    expect(html).toContain('aria-label="Level of frying pan"');
    expect(html).toMatch(
      /aria-label="Alternates of frying pan, comma separated"[^>]*aria-invalid="true" aria-describedby="e"/,
    );
    expect(html).toContain('value="skillet, fry pan"');
  });

  it('sums up what a save added', () => {
    const category = {
      id: 'k',
      title: 'K',
      emoji: '🍳',
      defaultOn: false,
      hidden: true,
      words: [],
    };
    expect(draftSummary({ category, added: 1, duplicates: 0 })).toBe('Added 1 word.');
    expect(draftSummary({ category, added: 30, duplicates: 2 })).toBe(
      'Added 30 words. Skipped 2 duplicates.',
    );
  });

  it('an unticked row strikes its word through in red pen, at full contrast', () => {
    const [row] = toRows(job().draft!.words);
    const html = renderToStaticMarkup(
      <DraftWordRow
        row={{ ...row!, ticked: false }}
        index={0}
        invalid={null}
        errorId="e"
        onChange={noop}
      />,
    );
    expect(html).toContain('line-through decoration-red decoration-2');
    expect(html).not.toContain('opacity-');
  });
});

describe('spend (F84)', () => {
  const entry = (over: Partial<GenerationHistoryEntry> = {}): GenerationHistoryEntry => ({
    id: 'h1',
    kind: 'new',
    title: 'Kitchen',
    count: 40,
    kept: 36,
    costUsd: 0.0421,
    startedAt: Date.UTC(2026, 10, 3, 9),
    endedAt: Date.UTC(2026, 10, 3, 9, 1),
    outcome: 'ready',
    ...over,
  });

  it('the tiles show this month against the cap, all time, and the last generation', () => {
    const last = entry({ title: 'Zoo animals', costUsd: 0.0123 });
    const html = renderToStaticMarkup(
      <SpendTiles spend={spend({ monthUsd: 1.5, allTimeUsd: 12.25, total: 7, last })} />,
    );
    expect(html).toContain('aria-label="Generation spend"');
    expect(html).toMatch(/This month<\/dt><dd[^>]*>\$1\.50<\/dd><dd[^>]*>of the \$5\.00 cap/);
    expect(html).toMatch(/All time<\/dt><dd[^>]*>\$12\.25<\/dd><dd[^>]*>7 generations/);
    expect(html).toMatch(/Last generation<\/dt><dd[^>]*>\$0\.0123<\/dd><dd[^>]*>Zoo animals/);
  });

  it('before any generation the tiles say none yet, and there is no history list', () => {
    const html = renderToStaticMarkup(<SpendTiles spend={spend()} />);
    expect(html).toMatch(/This month<\/dt><dd[^>]*>\$0\.0000</);
    expect(html).toContain('None yet');
    expect(renderToStaticMarkup(<SpendHistory spend={spend()} />)).toBe('');
  });

  it('the history lists each generation newest first, with words kept, cost, and failures', () => {
    const history = [
      entry({ id: 'b', title: 'Food', kind: 'more', costUsd: 0.002, outcome: 'failed', kept: 0 }),
      entry({ id: 'a' }),
    ];
    const html = renderToStaticMarkup(
      <SpendHistory spend={spend({ history, total: 60, allTimeUsd: 1 })} />,
    );
    expect(html).toContain('History (60)');
    expect(html).toContain('The newest 2 of 60.');
    expect(html.indexOf('Food')).toBeLessThan(html.indexOf('Kitchen'));
    expect(html).toContain('more words');
    expect(html).toContain('<span class="text-red">failed</span>');
    expect(html).toContain('36 of 40 kept');
    expect(html).toContain('$0.0421');
  });

  it('the list panel shows the tiles; a category page does not', () => {
    const initial = { mode: 'claude' as const, off: null, jobs: [], spend: spend() };
    expect(
      renderToStaticMarkup(<GeneratePanel categoryId={null} onReview={noop} initial={initial} />),
    ).toContain('This month');
    expect(
      renderToStaticMarkup(
        <GeneratePanel categoryId="en-food" onReview={noop} initial={initial} />,
      ),
    ).not.toContain('This month');
  });

  it('past the monthly cap, Generate is held and says why, on the list and on a category page', () => {
    const refused =
      'This month’s generation spend is $5.02, and the cap is $5.00 (SKETCHY_GENERATION_CAP_USD). Generation opens again on 1 December (UTC).';
    for (const categoryId of [null, 'en-food']) {
      const html = renderToStaticMarkup(
        <GeneratePanel
          categoryId={categoryId}
          onReview={noop}
          initial={{
            mode: 'claude',
            off: null,
            jobs: [],
            spend: spend({ monthUsd: 5.02, refused }),
          }}
        />,
      );
      const id = /<p id="([^"]+)"[^>]*>This month’s generation spend/.exec(html)?.[1];
      expect(id).toBeDefined();
      expect(html).toContain('opens again on 1 December (UTC)');
      expect(html).toMatch(
        new RegExp(`<button type="submit"[^>]*aria-disabled="true" aria-describedby="${id}">`),
      );
    }
  });
});
