import type { Equal, Expect } from '@dojo/type-utils';
import { Emitter } from './index';

interface PlayerEvents {
  play: [track: string, at: number];
  pause: [at: number];
  stop: [];
}

const player = new Emitter<PlayerEvents>();

type cases = [
  Expect<
    Equal<
      Parameters<Parameters<typeof player.on<'play'>>[1]>,
      [track: string, at: number]
    >
  >, // a play listener gets the track and the time
  Expect<
    Equal<Parameters<Parameters<typeof player.once<'pause'>>[1]>, [at: number]>
  >, // once types its listener the same way
  Expect<Equal<Parameters<typeof player.emit<'stop'>>, [type: 'stop']>>, // stop takes no arguments
];

// @ts-expect-error
const missingTime = () => player.emit('pause'); // pause needs the time

// @ts-expect-error
const extraArgument = () => player.emit('stop', 0); // stop takes nothing

// @ts-expect-error
const notTuples = () => new Emitter<{ play: string }>(); // every value is a tuple

export { missingTime, extraArgument, notTuples };

test('emit calls the listeners in order, with the arguments', () => {
  const bus = new Emitter<PlayerEvents>();
  const calls: unknown[][] = [];
  bus.on('play', (...args) => calls.push(['first', ...args]));
  bus.on('play', (...args) => calls.push(['second', ...args]));
  bus.on('pause', (...args) => calls.push(['pause', ...args]));
  bus.emit('play', 'Intro', 0);
  bus.emit('pause', 42);
  expect(calls).toEqual([
    ['first', 'Intro', 0],
    ['second', 'Intro', 0],
    ['pause', 42],
  ]);
});

test('emit returns how many listeners it called', () => {
  const bus = new Emitter<PlayerEvents>();
  expect(bus.emit('stop')).toBe(0);
  for (let count = 1; count <= 4; count++) {
    bus.on('stop', () => {});
    expect(bus.emit('stop')).toBe(count);
  }
  expect(bus.emit('pause', 1)).toBe(0);
});

test('on returns a function that removes that listener only', () => {
  const bus = new Emitter<PlayerEvents>();
  const seen: string[] = [];
  const offA = bus.on('stop', () => seen.push('a'));
  bus.on('stop', () => seen.push('b'));
  bus.on('stop', () => seen.push('c'));
  offA();
  expect(bus.emit('stop')).toBe(2);
  offA();
  expect(bus.emit('stop')).toBe(2);
  expect(seen).toEqual(['b', 'c', 'b', 'c']);
});

test('once calls its listener on the next emit only', () => {
  const bus = new Emitter<PlayerEvents>();
  const seen: unknown[][] = [];
  bus.once('pause', (...args) => seen.push(args));
  expect(bus.emit('pause', 1)).toBe(1);
  expect(bus.emit('pause', 2)).toBe(0);
  expect(seen).toEqual([[1]]);
});

test('once can be removed before it fires', () => {
  const bus = new Emitter<PlayerEvents>();
  const seen: string[] = [];
  const off = bus.once('stop', () => seen.push('once'));
  bus.on('stop', () => seen.push('always'));
  off();
  bus.emit('stop');
  bus.emit('stop');
  expect(seen).toEqual(['always', 'always']);
});

test('two once listeners on one event both fire, once each', () => {
  const bus = new Emitter<PlayerEvents>();
  const seen: string[] = [];
  bus.once('play', (track) => seen.push(`a ${track}`));
  bus.once('play', (track) => seen.push(`b ${track}`));
  expect(bus.emit('play', 'Intro', 0)).toBe(2);
  expect(bus.emit('play', 'Outro', 9)).toBe(0);
  expect(seen).toEqual(['a Intro', 'b Intro']);
});

test('emitters do not share listeners', () => {
  const first = new Emitter<PlayerEvents>();
  const second = new Emitter<PlayerEvents>();
  first.on('stop', () => {});
  expect(second.emit('stop')).toBe(0);
});
