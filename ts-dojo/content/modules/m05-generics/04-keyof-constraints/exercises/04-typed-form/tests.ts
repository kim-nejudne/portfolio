import type { Equal, Expect } from '@dojo/type-utils';
import { Form } from './index';

type Signup = { name: string; age: number; newsletter: boolean };

const blank: Signup = { name: '', age: 18, newsletter: false };

const typed = new Form(blank);
const name = typed.get('name');
const age = typed.get('age');
const newsletter = typed.get('newsletter');

type cases = [
  Expect<Equal<typeof typed, Form<Signup>>>, // the shape is inferred from the initial values
  Expect<Equal<typeof name, string>>, // get('name') is a string
  Expect<Equal<typeof age, number>>, // get('age') is a number
  Expect<Equal<typeof newsletter, boolean>>, // get('newsletter') is a boolean
];

// @ts-expect-error
typed.get('email'); // get takes only the names of the fields

// @ts-expect-error
typed.set('age', '36'); // set takes a value of the field's type

// @ts-expect-error
typed.set('email', 'ada@example.com'); // set takes only the names of the fields

// @ts-expect-error
typed.update('name', (value) => value.length); // update's callback returns the field's type

// @ts-expect-error
typed.reset('email'); // reset takes only the names of the fields

// @ts-expect-error
typed.isDirty('email'); // isDirty takes only the names of the fields

// @ts-expect-error
new Form('Ada'); // only objects can be forms

test('get returns the initial value of every field', () => {
  const form = new Form(blank);
  expect(form.get('name')).toBe('');
  expect(form.get('age')).toBe(18);
  expect(form.get('newsletter')).toBe(false);
});

test('set changes only the field it names', () => {
  const form = new Form(blank);
  form.set('name', 'Ada');
  expect(form.get('name')).toBe('Ada');
  expect(form.get('age')).toBe(18);
  for (let n = 20; n < 30; n++) {
    form.set('age', n);
    expect(form.get('age')).toBe(n);
  }
  form.set('newsletter', true);
  expect(form.get('newsletter')).toBe(true);
  expect(form.get('name')).toBe('Ada');
});

test('update passes the current value and keeps what fn returns', () => {
  const form = new Form(blank);
  form.update('age', (age) => age + 1);
  form.update('age', (age) => age * 2);
  expect(form.get('age')).toBe(38);
  form.update('name', (name) => `${name}Grace`.toUpperCase());
  expect(form.get('name')).toBe('GRACE');
  form.update('newsletter', (on) => !on);
  expect(form.get('newsletter')).toBe(true);
});

test('reset restores the initial value of one field', () => {
  const form = new Form({ title: 'Draft', words: 100 });
  form.set('title', 'Final');
  form.set('words', 250);
  form.reset('title');
  expect(form.get('title')).toBe('Draft');
  expect(form.get('words')).toBe(250);
  form.reset('words');
  expect(form.get('words')).toBe(100);
});

test('isDirty compares a field with its initial value', () => {
  const form = new Form(blank);
  expect(form.isDirty('age')).toBe(false);
  form.set('age', 40);
  expect(form.isDirty('age')).toBe(true);
  expect(form.isDirty('name')).toBe(false);
  form.set('age', 18);
  expect(form.isDirty('age')).toBe(false);
  form.set('name', 'Ada');
  form.reset('name');
  expect(form.isDirty('name')).toBe(false);
});

test('the form keeps its own copy of the initial values', () => {
  const initial = { city: 'Oslo', zip: 150 };
  const form = new Form(initial);
  form.set('city', 'Bergen');
  expect(initial).toEqual({ city: 'Oslo', zip: 150 });
  initial.zip = 999;
  expect(form.get('zip')).toBe(150);
  form.reset('city');
  expect(form.get('city')).toBe('Oslo');
  expect(form.isDirty('zip')).toBe(false);
});

test('two forms do not share their values', () => {
  const first = new Form(blank);
  const second = new Form(blank);
  first.set('name', 'Ada');
  expect(second.get('name')).toBe('');
  expect(second.isDirty('name')).toBe(false);
});
