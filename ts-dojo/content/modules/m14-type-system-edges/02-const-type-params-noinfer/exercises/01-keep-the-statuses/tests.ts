import type { Equal, Expect } from '@dojo/type-utils';
import { defineStatuses, label, statuses, type Status } from './index';

const priorities = defineStatuses(['low', 'normal', 'high']);
const single = defineStatuses(['open']);

type cases = [
  Expect<Equal<typeof statuses, readonly ['draft', 'review', 'published']>>, // statuses keeps its literals
  Expect<Equal<Status, 'draft' | 'review' | 'published'>>, // Status is the union of the three
  Expect<Equal<typeof priorities, readonly ['low', 'normal', 'high']>>, // every caller gets literals
  Expect<Equal<typeof single, readonly ['open']>>, // a one-element list
];

test('every status has its label', () => {
  expect(label('draft')).toBe('Draft');
  expect(label('review')).toBe('In review');
  expect(label('published')).toBe('Published');
});

test('the statuses come back as written', () => {
  expect(statuses).toEqual(['draft', 'review', 'published']);
  expect(priorities).toEqual(['low', 'normal', 'high']);
});
