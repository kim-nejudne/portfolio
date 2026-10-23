import type { Equal, Expect } from '@dojo/type-utils';
import { Clip } from './index';

const clip = new Clip('intro', 90);
const fromText = () => (clip.start = '1:30'); // start accepts text

type cases = [
  Expect<Equal<Clip['start'], number>>, // start always reads as a number
  Expect<Equal<Clip['remaining'], number>>, // remaining is a number
  Expect<Equal<Clip['title'], string>>, // title is a string
  Expect<Equal<ConstructorParameters<typeof Clip>, [string, number]>>, // new Clip(title, length)
];

// @ts-expect-error
const setRemaining = () => (clip.remaining = 10); // remaining is read-only

// @ts-expect-error
const rename = () => (clip.title = 'outro'); // title is read-only

// @ts-expect-error
const readLength = () => clip.length; // length is private

// @ts-expect-error
const fromBoolean = () => (clip.start = true); // start takes a number or text

test('a new clip starts at 0 with all of it remaining', () => {
  const intro = new Clip('intro', 90);
  expect(intro.title).toBe('intro');
  expect(intro.start).toBe(0);
  expect(intro.remaining).toBe(90);
});

test('start takes a number of seconds', () => {
  const song = new Clip('song', 200);
  for (let seconds = 0; seconds <= 200; seconds += 13) {
    song.start = seconds;
    expect(song.start).toBe(seconds);
    expect(song.remaining).toBe(200 - seconds);
  }
});

test('start is clamped to the clip', () => {
  const short = new Clip('short', 30);
  short.start = -5;
  expect(short.start).toBe(0);
  expect(short.remaining).toBe(30);
  short.start = 31;
  expect(short.start).toBe(30);
  expect(short.remaining).toBe(0);
  short.start = 1000;
  expect(short.start).toBe(30);
});

test('start takes m:ss text', () => {
  const film = new Clip('film', 300);
  film.start = '1:30';
  expect(film.start).toBe(90);
  expect(film.remaining).toBe(210);
  film.start = '0:05';
  expect(film.start).toBe(5);
  for (let minutes = 0; minutes <= 4; minutes++) {
    for (let seconds = 0; seconds < 60; seconds += 7) {
      film.start = `${minutes}:${String(seconds).padStart(2, '0')}`;
      expect(film.start).toBe(minutes * 60 + seconds);
    }
  }
});

test('text is clamped too', () => {
  const intro = new Clip('intro', 90);
  intro.start = '9:59';
  expect(intro.start).toBe(90);
  expect(intro.remaining).toBe(0);
});

test('each clip keeps its own start', () => {
  const a = new Clip('a', 60);
  const b = new Clip('b', 120);
  a.start = 40;
  expect(b.start).toBe(0);
  b.start = '1:10';
  expect(a.start).toBe(40);
  expect(b.remaining).toBe(50);
});

export { fromText, setRemaining, rename, readLength, fromBoolean };
