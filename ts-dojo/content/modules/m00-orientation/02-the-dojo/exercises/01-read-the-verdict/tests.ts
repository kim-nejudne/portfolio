import { shout } from './index';

test('shouts hey', () => {
  expect(shout('hey')).toBe('HEY!');
});

test('shouts a whole sentence', () => {
  expect(shout('stand up')).toBe('STAND UP!');
});

test('shouts a name', () => {
  expect(shout('Ada')).toBe('ADA!');
});

test('shouts any word', () => {
  for (const word of ['a', 'b c', 'Kim', 'x'.repeat(9), 'ready, steady']) {
    expect(shout(word)).toBe(word.toUpperCase() + '!');
  }
});
