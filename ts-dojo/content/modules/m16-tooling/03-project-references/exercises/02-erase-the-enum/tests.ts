import type { Equal, Expect } from '@dojo/type-utils';
import { Direction, Elevator } from './index';

type cases = [
  Expect<Equal<Direction, 'up' | 'down'>>, // Direction is the union of its values
  Expect<Equal<Elevator['floor'], number>>, // floor is still a public number
];

// @ts-expect-error
const readTop = (elevator: Elevator) => elevator.top; // top stays hidden

// @ts-expect-error
const sideways = (elevator: Elevator) => elevator.move('left'); // only up and down

test('Direction keeps its two members', () => {
  expect(Direction.Up).toBe('up');
  expect(Direction.Down).toBe('down');
});

test('move goes up to the top floor and stops there', () => {
  const elevator = new Elevator(0, 2);
  expect(elevator.move(Direction.Up)).toBe(1);
  expect(elevator.move(Direction.Up)).toBe(2);
  expect(elevator.move(Direction.Up)).toBe(2);
  expect(elevator.floor).toBe(2);
});

test('move goes down to floor 0 and stops there', () => {
  const elevator = new Elevator(1, 5);
  expect(elevator.move(Direction.Down)).toBe(0);
  expect(elevator.move(Direction.Down)).toBe(0);
});

test('a plain string works where the enum did not', () => {
  const elevator = new Elevator(3, 4);
  expect(elevator.move('up')).toBe(4);
  expect(elevator.move('down')).toBe(3);
});

test('floor can still be set from outside', () => {
  const elevator = new Elevator(0, 9);
  elevator.floor = 7;
  expect(elevator.move(Direction.Up)).toBe(8);
});
