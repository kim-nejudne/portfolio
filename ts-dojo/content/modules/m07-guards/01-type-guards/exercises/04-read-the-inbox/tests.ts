import type { Equal, Expect } from '@dojo/type-utils';
import { isMessage, readInbox, type Message } from './index';

type cases = [
  Expect<Equal<typeof isMessage, (value: unknown) => value is Message>>, // isMessage is a guard on unknown
  Expect<Equal<ReturnType<typeof readInbox>, Message[]>>, // readInbox returns messages
];

const text = { type: 'text', from: 'ada', body: 'hi' };
const image = { type: 'image', from: 'grace', url: 'cat.png', width: 640 };
const leave = { type: 'leave', from: 'alan' };

test('isMessage accepts each kind', () => {
  expect(isMessage(text)).toBe(true);
  expect(isMessage(image)).toBe(true);
  expect(isMessage(leave)).toBe(true);
});

test('isMessage accepts extra properties', () => {
  expect(isMessage({ ...leave, body: 'bye' })).toBe(true);
  expect(isMessage({ ...text, sentAt: 1700000000 })).toBe(true);
});

test('isMessage rejects values that are not objects', () => {
  for (const value of [null, undefined, 0, 'text', true, [text]]) {
    expect(isMessage(value)).toBe(false);
  }
});

test('isMessage rejects a missing or wrong from', () => {
  expect(isMessage({ type: 'leave' })).toBe(false);
  expect(isMessage({ type: 'leave', from: 7 })).toBe(false);
  expect(isMessage({ type: 'text', from: null, body: 'hi' })).toBe(false);
});

test('isMessage rejects a type that is not one of the three', () => {
  expect(isMessage({ from: 'ada', body: 'hi' })).toBe(false);
  expect(isMessage({ type: 'video', from: 'ada', url: 'a.mp4' })).toBe(false);
  expect(isMessage({ type: 'Text', from: 'ada', body: 'hi' })).toBe(false);
  expect(isMessage({ type: 1, from: 'ada' })).toBe(false);
});

test('isMessage checks the properties of each kind', () => {
  expect(isMessage({ type: 'text', from: 'ada' })).toBe(false);
  expect(isMessage({ type: 'text', from: 'ada', body: 42 })).toBe(false);
  expect(isMessage({ type: 'text', from: 'ada', url: 'a.png', width: 1 })).toBe(
    false,
  );
  expect(isMessage({ type: 'image', from: 'ada', url: 'a.png' })).toBe(false);
  expect(isMessage({ type: 'image', from: 'ada', width: 640 })).toBe(false);
  expect(
    isMessage({ type: 'image', from: 'ada', url: 'a.png', width: '640' }),
  ).toBe(false);
  expect(isMessage({ type: 'image', from: 'ada', body: 'hi' })).toBe(false);
});

test('readInbox keeps the messages in order and drops the rest', () => {
  const entries = [text, { type: 'text', from: 'x' }, image, null, 3, leave];
  expect(readInbox(JSON.stringify(entries))).toEqual([text, image, leave]);
});

test('readInbox of many entries keeps exactly the messages', () => {
  const entries: unknown[] = [];
  const expected: unknown[] = [];
  for (let i = 0; i < 12; i++) {
    const message = {
      type: 'image',
      from: `user${i}`,
      url: `${i}.png`,
      width: i,
    };
    entries.push(message, { ...message, width: `${i}` });
    expected.push(message);
  }
  expect(readInbox(JSON.stringify(entries))).toEqual(expected);
});

test('readInbox of data that is not an array is empty', () => {
  expect(readInbox(JSON.stringify(text))).toEqual([]);
  expect(readInbox('null')).toEqual([]);
  expect(readInbox('"inbox"')).toEqual([]);
  expect(readInbox('[]')).toEqual([]);
});
