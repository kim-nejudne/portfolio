import { Stopwatch } from './index';

test('a new stopwatch has its label, no laps and a total of 0', () => {
  const watch = new Stopwatch('run');
  expect(watch.label).toBe('run');
  expect(watch.laps).toEqual([]);
  expect(watch.total).toBe(0);
});

test('lap records each lap and returns the total so far', () => {
  const watch = new Stopwatch('run');
  expect(watch.lap(30)).toBe(30);
  expect(watch.lap(45)).toBe(75);
  expect(watch.laps).toEqual([30, 45]);
  expect(watch.total).toBe(75);
});

test('each stopwatch keeps its own laps', () => {
  const first = new Stopwatch('first');
  const second = new Stopwatch('second');
  first.lap(10);
  expect(second.laps).toEqual([]);
  expect(second.total).toBe(0);
});
