import type { Equal, Expect } from '@dojo/type-utils';
import { flip, type Switch } from './index';

type cases = [
  Expect<Equal<Switch, 'on' | 'off'>>, // Switch is exactly 'on' | 'off'
  Expect<Equal<ReturnType<typeof flip>, 'on' | 'off'>>, // flip returns a Switch
];

// @ts-expect-error
const dimmed: Switch = 'dimmed'; // 'dimmed' is not a position

test('flip turns on into off', () => {
  expect(flip('on')).toBe('off');
});

test('flip turns off into on', () => {
  expect(flip('off')).toBe('on');
});

test('flipping twice gives the position back', () => {
  expect(flip(flip('off'))).toBe('off');
});

export { dimmed };
