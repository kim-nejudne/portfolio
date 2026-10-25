import type { Equal, Expect } from '@dojo/type-utils';
import { Doc, TrackedDoc, Versioned } from './index';

class Invoice {
  constructor(
    readonly id: string,
    readonly total: number,
  ) {}
}

class NumericId {
  id = 1;
}

class Named {
  name = 'x';
}

const VersionedInvoice = Versioned(Invoice);

type Tracked = InstanceType<typeof TrackedDoc>;
type Invoiced = InstanceType<typeof VersionedInvoice>;
type TrackedArgs = ConstructorParameters<typeof TrackedDoc>;
type InvoiceArgs = ConstructorParameters<typeof VersionedInvoice>;

const chain = (doc: Tracked) => doc.bump().tag('draft').bump();
const invoiceChain = (invoice: Invoiced) => invoice.bump().bump();

type cases = [
  Expect<Equal<TrackedArgs, [id: string, title: string]>>, // takes Doc's arguments
  Expect<Equal<InvoiceArgs, [id: string, total: number]>>, // and Invoice's
  Expect<Equal<ReturnType<typeof chain>, Tracked>>, // bump keeps the full type
  Expect<Equal<ReturnType<typeof invoiceChain>, Invoiced>>, // on any class
  Expect<Equal<Tracked['version'], number>>, // version is a number
  Expect<Equal<Tracked['label'], string>>, // label is a string
  Expect<Equal<Tracked['tags'], string[]>>, // the tags are there
  Expect<Equal<Tracked['title'], string>>, // and so is the title
];

// @ts-expect-error
const numericId = Versioned(NumericId); // the id must be a string

// @ts-expect-error
const noId = Versioned(Named); // there must be an id

// @ts-expect-error
const setVersion = (doc: Tracked) => (doc.version = 5); // version is read-only

// @ts-expect-error
const setLabel = (doc: Tracked) => (doc.label = 'x'); // label is read-only

// @ts-expect-error
const wrongArgs = () => new TrackedDoc(1, 'Readme'); // an id is a string

test('a new document is at version 1', () => {
  const doc = new TrackedDoc('readme', 'Read me');
  expect(doc.version).toBe(1);
  expect(doc.label).toBe('readme@v1');
  expect(doc.title).toBe('Read me');
  expect(doc.tags).toEqual([]);
});

test('bump adds one and returns the same object', () => {
  const doc = new TrackedDoc('notes', 'Notes');
  for (let n = 2; n <= 6; n++) {
    expect(doc.bump()).toBe(doc);
    expect(doc.version).toBe(n);
    expect(doc.label).toBe(`notes@v${n}`);
  }
});

test('the label follows the id', () => {
  for (const id of ['a', 'spec-2', 'x y', '']) {
    const doc = new TrackedDoc(id, 'title');
    doc.bump();
    expect(doc.label).toBe(`${id}@v2`);
  }
});

test('bump and tag chain', () => {
  const doc = new TrackedDoc('plan', 'Plan');
  doc.bump().tag('draft').bump().tag('shared').tag('draft');
  expect(doc.version).toBe(3);
  expect(doc.tags).toEqual(['draft', 'shared']);
  expect(doc.label).toBe('plan@v3');
});

test('every instance has its own version', () => {
  const a = new TrackedDoc('a', 'A');
  const b = new TrackedDoc('b', 'B');
  a.bump().bump();
  expect(a.version).toBe(3);
  expect(b.version).toBe(1);
  expect(new TrackedDoc('c', 'C').version).toBe(1);
});

test('Versioned works on any class with an id', () => {
  const invoice = new VersionedInvoice('inv-7', 120);
  expect(invoice.total).toBe(120);
  expect(invoice.label).toBe('inv-7@v1');
  invoice.bump();
  expect(invoice.label).toBe('inv-7@v2');
  expect(invoice).toBeInstanceOf(Invoice);
});

test('a tracked document is a Doc', () => {
  expect(new TrackedDoc('d', 'D')).toBeInstanceOf(Doc);
});

export { numericId, noId, setVersion, setLabel, wrongArgs };
