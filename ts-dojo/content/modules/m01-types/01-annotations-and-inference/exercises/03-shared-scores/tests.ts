import { average, best, record } from './index';

// The list lives in the module, so the tests build on each other in order.
test('best and average of three scores', () => {
  record(7);
  record(10);
  record(4);
  expect(best()).toBe(10);
  expect(average()).toBe(7);
});

test('a fourth score lowers the average', () => {
  record(3);
  expect(best()).toBe(10);
  expect(average()).toBe(6);
});

test('best and average follow every score recorded', () => {
  const all = [7, 10, 4, 3];
  for (let score = 0; score <= 50; score += 5) {
    record(score);
    all.push(score);
    const sum = all.reduce((total, each) => total + each, 0);
    expect(best()).toBe(Math.max(...all));
    expect(average()).toBeCloseTo(sum / all.length);
  }
});
