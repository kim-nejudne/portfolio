import { describe, expect, it } from 'vitest';
import type { Question } from '../../../shared/types.js';
import { job } from '../test/adminServer.js';
import {
  addJobs,
  cardJob,
  follow,
  ordinal,
  progressLine,
  queuedCount,
  started,
  withArrived,
  type FollowedJobs,
} from './levelJobs.js';

const q = (id: string, text = id): Question => ({ id, text, answer: 'A', points: 100 });
const OLD = q('q2', 'Old');
const NEW = q('q2', 'New');
const replace = (over: Parameters<typeof job>[0] = {}) =>
  job({ id: 'r1', kind: 'replace', setId: 's', questionId: 'q2', state: 'queued', ...over });
const none: FollowedJobs = new Map();

describe('follow', () => {
  it('follows a queued or running job it has not seen, and ignores one that already ended', () => {
    const { followed, ended } = follow(none, [
      replace({ queuePosition: 2 }),
      replace({ id: 'old', state: 'done', replaced: { old: OLD, new: NEW } }),
    ]);
    expect([...followed.keys()]).toEqual(['r1']);
    expect(ended).toEqual([]);
  });

  it('reports a followed job that ends, once', () => {
    const first = follow(none, [replace({ state: 'writing' })]).followed;
    const done = replace({ state: 'done', replaced: { old: OLD, new: NEW } });
    const second = follow(first, [done]);
    expect(second.ended).toEqual([done]);
    // A late answer from before the end changes nothing, and the end is not reported again.
    const late = follow(second.followed, [replace({ state: 'writing' }), done]);
    expect(late.ended).toEqual([]);
    expect(late.followed.get('r1')?.job?.state).toBe('done');
  });

  it('treats a job started on the page as followed, even if it ends before a poll sees it run', () => {
    const mine = started(none, 'r1', 'q2');
    const done = replace({ state: 'done', replaced: { old: OLD, new: NEW } });
    expect(follow(mine, [done]).ended).toEqual([done]);
  });

  it('says whether anything changed, so the page can read the day count again', () => {
    const first = follow(none, [replace({ queuePosition: 2 })]);
    expect(first.changed).toBe(true);
    expect(follow(first.followed, [replace({ queuePosition: 2 })]).changed).toBe(false);
    expect(follow(first.followed, [replace({ queuePosition: 1 })]).changed).toBe(true);
  });
});

describe('withArrived', () => {
  it('swaps a replacement in place and appends an addition once', () => {
    const list = [q('q1'), OLD, q('q3')];
    const swapped = withArrived(list, replace({ state: 'done', replaced: { old: OLD, new: NEW } }));
    expect(swapped.map((x) => x.text)).toEqual(['q1', 'New', 'q3']);
    const add = replace({ questionId: null, state: 'done', replaced: { old: null, new: q('q9') } });
    const added = withArrived(list, add);
    expect(added.map((x) => x.id)).toEqual(['q1', 'q2', 'q3', 'q9']);
    expect(withArrived(added, add)).toHaveLength(4);
  });

  it('leaves the list alone for a failed or cancelled job', () => {
    expect(withArrived([OLD], replace({ state: 'failed', error: 'x' }))).toEqual([OLD]);
  });
});

describe('cardJob', () => {
  it('shows the latest replacement of the question: queued, running, replaced, failed', () => {
    let f = started(none, 'r1', 'q2');
    expect(cardJob(f, 'q2')).toEqual({ kind: 'queued', jobId: 'r1', position: null });
    f = follow(f, [replace({ queuePosition: 2 })]).followed;
    expect(cardJob(f, 'q2')).toEqual({ kind: 'queued', jobId: 'r1', position: 2 });
    f = follow(f, [replace({ state: 'checking' })]).followed;
    expect(cardJob(f, 'q2')).toEqual({ kind: 'running', jobId: 'r1' });
    f = follow(f, [replace({ state: 'done', replaced: { old: OLD, new: NEW } })]).followed;
    expect(cardJob(f, 'q2')).toEqual({ kind: 'replaced', jobId: 'r1', old: OLD });
    f = follow(started(f, 'r2', 'q2'), [
      replace({ id: 'r2', state: 'failed', error: 'No luck' }),
    ]).followed;
    expect(cardJob(f, 'q2')).toEqual({ kind: 'failed', jobId: 'r2', error: 'No luck' });
    expect(cardJob(f, 'q1')).toBeNull();
  });

  it('shows nothing after a cancel or an Undo', () => {
    const cancelled = follow(started(none, 'r1', 'q2'), [replace({ state: 'cancelled' })]);
    expect(cardJob(cancelled.followed, 'q2')).toBeNull();
    const done = follow(started(none, 'r1', 'q2'), [
      replace({ state: 'done', replaced: { old: OLD, new: NEW } }),
    ]).followed;
    const undone = new Map(done).set('r1', { ...done.get('r1')!, undone: true });
    expect(cardJob(undone, 'q2')).toBeNull();
  });

  it('marks a question an addition brought as added', () => {
    const add = replace({ questionId: null, state: 'done', replaced: { old: null, new: q('q9') } });
    const f = follow(started(none, 'r1', null), [add]).followed;
    expect(cardJob(f, 'q9')).toEqual({ kind: 'added' });
    expect(addJobs(f)).toEqual([]);
  });
});

describe('addJobs and queuedCount', () => {
  it('lists the additions still running, queued or failed, and counts the queue', () => {
    let f = started(none, 'a1', null);
    f = follow(f, [
      replace({ id: 'a1', questionId: null, state: 'writing' }),
      replace({ id: 'a2', questionId: null, queuePosition: 1 }),
      replace({ id: 'r1', queuePosition: 2 }),
    ]).followed;
    f = started(f, 'a3', null);
    expect(addJobs(f).map((j) => j.kind)).toEqual(['running', 'queued', 'queued']);
    expect(queuedCount(f)).toBe(3);
  });
});

describe('ordinal', () => {
  it.each([
    [1, '1st'],
    [2, '2nd'],
    [3, '3rd'],
    [4, '4th'],
    [11, '11th'],
    [12, '12th'],
    [13, '13th'],
    [21, '21st'],
    [22, '22nd'],
    [111, '111th'],
  ])('%i is %s', (n, text) => expect(ordinal(n)).toBe(text));
});

describe('progressLine', () => {
  const add = (over: Parameters<typeof job>[0] = {}) =>
    job({ id: 'a1', kind: 'replace', setId: 's', questionId: null, state: 'writing', ...over });

  it('is empty when nothing is in hand', () => {
    expect(progressLine(none, 0)).toBe('');
  });

  it('counts queued, running and just-started replacements and additions, and edits', () => {
    let followed = follow(none, [
      replace(),
      replace({ id: 'r2', questionId: 'q3', state: 'writing' }),
      add(),
    ]).followed;
    followed = started(followed, 'r3', 'q1');
    expect(progressLine(followed, 1)).toBe('3 replacing · 1 adding · 1 edited');
  });

  it('leaves out jobs that ended', () => {
    const { followed } = follow(follow(none, [replace(), add()]).followed, [
      replace({ state: 'done', replaced: { old: OLD, new: NEW } }),
      add({ state: 'failed', error: 'No' }),
    ]);
    expect(progressLine(followed, 0)).toBe('');
    expect(progressLine(followed, 2)).toBe('2 edited');
  });
});
