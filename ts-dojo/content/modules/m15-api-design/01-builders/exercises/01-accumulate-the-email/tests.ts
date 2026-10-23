import type { Equal, Expect } from '@dojo/type-utils';
import { email, welcome, type Email } from './index';

const reminder = email().subject('Reminder').to('grace@example.com').build();
const draft = email().to('alan@example.com');

type cases = [
  Expect<Equal<typeof welcome, Email>>, // build returns an Email
  Expect<Equal<typeof reminder, Email>>, // the steps can come in any order
];

// @ts-expect-error
const noSubject = () => draft.build(); // a subject is required

// @ts-expect-error
const noAddress = () => email().subject('Hi').text('Hello').build(); // so is the address

// @ts-expect-error
const empty = () => email().build(); // nothing set yet

export { noSubject, noAddress, empty };

test('welcome has every part', () => {
  expect(welcome).toEqual({
    to: 'ada@example.com',
    subject: 'Welcome',
    text: 'Your account is ready.',
  });
});

test('the text is optional', () => {
  expect(reminder).toEqual({ to: 'grace@example.com', subject: 'Reminder' });
});

test('a partial builder can be finished in several ways', () => {
  const first = draft.subject('One').build();
  const second = draft.subject('Two').text('More').build();
  expect(first).toEqual({ to: 'alan@example.com', subject: 'One' });
  expect(second).toEqual({
    to: 'alan@example.com',
    subject: 'Two',
    text: 'More',
  });
});
