import type { Equal, Expect } from '@dojo/type-utils';
import { Repository, UserRepository, type Entity, type User } from './index';

interface Book extends Entity {
  title: string;
}

const dune: Book = { id: 'b1', title: 'Dune' };
const emma: Book = { id: 'b2', title: 'Emma' };
const books = Repository.of(dune, emma);
const users = new UserRepository();
const chained = users.save({ id: 'u0', email: 'zed@example.com' });
const found = chained.findByEmail('zed@example.com'); // save keeps the subclass

type cases = [
  Expect<Equal<typeof books, Repository<Book>>>, // of infers the item type
  Expect<Equal<ReturnType<typeof books.find>, Book | undefined>>, // find returns T
  Expect<Equal<ReturnType<typeof books.all>, Book[]>>, // all returns T[]
  Expect<Equal<typeof chained, UserRepository>>, // save returns this
  Expect<Equal<typeof found, User | undefined>>, // findByEmail returns a User
  Expect<Equal<ReturnType<UserRepository['find']>, User | undefined>>, // UserRepository fixes T
  Expect<Equal<Parameters<UserRepository['save']>[0], User>>, // save takes a User
  Expect<Equal<UserRepository['size'], number>>, // size is a number
];

// @ts-expect-error
const strings = new Repository<string>(); // items need a string id

// @ts-expect-error
const numbers = () => Repository.of(1, 2); // of needs items with an id

// @ts-expect-error
const noEmail = () => users.save({ id: 'u9' }); // a user needs an email

// @ts-expect-error
const resize = () => (users.size = 0); // size is read-only

export { strings, numbers, noEmail, resize };

test('save and find', () => {
  const repository = new Repository<Book>();
  expect(repository.find('b1')).toBeUndefined();
  repository.save(dune);
  expect(repository.find('b1')).toBe(dune);
  expect(repository.find('b2')).toBeUndefined();
});

test('save returns the repository itself', () => {
  const repository = new Repository<Book>();
  expect(repository.save(dune)).toBe(repository);
  const people = new UserRepository();
  expect(people.save({ id: 'u1', email: 'a@example.com' })).toBe(people);
});

test('saving the same id replaces the item and keeps its place', () => {
  const repository = new Repository<Book>().save(dune).save(emma);
  const dune2: Book = { id: 'b1', title: 'Dune Messiah' };
  repository.save(dune2);
  expect(repository.find('b1')).toBe(dune2);
  expect(repository.all()).toEqual([dune2, emma]);
  expect(repository.size).toBe(2);
});

test('size and all follow every save', () => {
  const repository = new Repository<Book>();
  const saved: Book[] = [];
  for (let n = 1; n <= 12; n++) {
    const book = { id: `x${n}`, title: `Book ${n}` };
    repository.save(book);
    saved.push(book);
    expect(repository.size).toBe(n);
  }
  expect(repository.all()).toEqual(saved);
});

test('of returns a new repository holding the items in order', () => {
  expect(books).toBeInstanceOf(Repository);
  expect(books.all()).toEqual([dune, emma]);
  expect(books.size).toBe(2);
  expect(Repository.of().size).toBe(0);
  expect(Repository.of(dune)).not.toBe(Repository.of(dune));
});

test('repositories are separate', () => {
  const a = new Repository<Book>().save(dune);
  const b = new Repository<Book>();
  expect(b.size).toBe(0);
  expect(b.find('b1')).toBeUndefined();
  expect(a.size).toBe(1);
});

test('findByEmail ignores case', () => {
  const people = new UserRepository();
  const ada = { id: 'u1', email: 'Ada@Example.com' };
  const bob = { id: 'u2', email: 'bob@example.com' };
  people.save(ada).save(bob);
  expect(people.findByEmail('ada@example.com')).toBe(ada);
  expect(people.findByEmail('ADA@EXAMPLE.COM')).toBe(ada);
  expect(people.findByEmail('Bob@example.com')).toBe(bob);
  expect(people.findByEmail('eve@example.com')).toBeUndefined();
});

test('another user with the same email is refused', () => {
  const people = new UserRepository();
  people.save({ id: 'u1', email: 'ada@example.com' });
  expect(() => people.save({ id: 'u2', email: 'ada@example.com' })).toThrow();
  expect(() => people.save({ id: 'u3', email: 'ADA@example.COM' })).toThrow();
  expect(people.size).toBe(1);
  expect(people.find('u2')).toBeUndefined();
  expect(people.find('u3')).toBeUndefined();
});

test('the same user may be saved again, with the same or a new email', () => {
  const people = new UserRepository();
  people.save({ id: 'u1', email: 'ada@example.com' });
  people.save({ id: 'u1', email: 'ADA@example.com' });
  expect(people.size).toBe(1);
  people.save({ id: 'u1', email: 'ada@lovelace.org' });
  expect(people.findByEmail('ada@example.com')).toBeUndefined();
  expect(people.find('u1')?.email).toBe('ada@lovelace.org');
  people.save({ id: 'u2', email: 'ada@example.com' });
  expect(people.size).toBe(2);
});

test('many users with different emails', () => {
  const people = new UserRepository();
  for (let n = 0; n < 20; n++) {
    people.save({ id: `u${n}`, email: `user${n}@example.com` });
  }
  expect(people.size).toBe(20);
  for (let n = 0; n < 20; n++) {
    expect(people.findByEmail(`USER${n}@example.com`)?.id).toBe(`u${n}`);
  }
});

test('a user repository is a repository', () => {
  expect(new UserRepository()).toBeInstanceOf(Repository);
});
