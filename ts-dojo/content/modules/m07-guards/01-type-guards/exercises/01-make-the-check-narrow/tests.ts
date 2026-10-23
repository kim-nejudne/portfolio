import type { Equal, Expect } from '@dojo/type-utils';
import { credit, isSong, type Episode, type Song } from './index';

type cases = [
  Expect<Equal<typeof isSong, (item: Song | Episode) => item is Song>>, // isSong is a type guard for Song
];

const song: Song = { title: 'Blue in Green', artist: 'Miles Davis' };
const episode: Episode = { title: 'Pilot', show: 'Night Shift', number: 1 };

test('isSong is true for a song', () => {
  expect(isSong(song)).toBe(true);
});

test('isSong is false for an episode', () => {
  expect(isSong(episode)).toBe(false);
});

test('credit of a song names the artist', () => {
  expect(credit(song)).toBe('Blue in Green by Miles Davis');
  expect(credit({ title: 'Jolene', artist: 'Dolly Parton' })).toBe(
    'Jolene by Dolly Parton',
  );
});

test('credit of an episode names the show and number', () => {
  expect(credit(episode)).toBe('Night Shift #1: Pilot');
  for (let number = 2; number <= 6; number++) {
    expect(credit({ title: `Part ${number}`, show: 'Atlas', number })).toBe(
      `Atlas #${number}: Part ${number}`,
    );
  }
});
