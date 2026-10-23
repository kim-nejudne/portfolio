import type { Equal, Expect } from '@dojo/type-utils';
import { Registry } from './index';

abstract class Shape {
  abstract area(): number;
}

class Circle extends Shape {
  radius: number;
  constructor(radius: number) {
    super();
    this.radius = radius;
  }
  area(): number {
    return Math.PI * this.radius ** 2;
  }
}

class Square extends Shape {
  side: number;
  constructor(side: number) {
    super();
    this.side = side;
  }
  area(): number {
    return this.side ** 2;
  }
}

class Clock {
  now = 0;
}

const clock = new Clock();

class AppRegistry extends Registry {
  describe(): string {
    return 'app';
  }
}

const createShape = (registry: Registry) => registry.create(Shape);
const createCircle = (registry: Registry) => registry.create(Circle);
const createDate = (registry: Registry) => registry.create(Date);
const chain = (registry: AppRegistry) =>
  registry
    .register(Clock, () => new Clock())
    .register(Shape, () => new Square(1));

type cases = [
  Expect<Equal<ReturnType<typeof createShape>, Shape>>, // an abstract class gives its instance type
  Expect<Equal<ReturnType<typeof createCircle>, Circle>>, // a class with constructor parameters
  Expect<Equal<ReturnType<typeof createDate>, Date>>, // a built-in class
  Expect<Equal<ReturnType<typeof chain>, AppRegistry>>, // chaining keeps the subclass
];

// @ts-expect-error
const wrongInstance = (r: Registry) => r.register(Circle, () => new Square(1)); // make must return the class's instances

// @ts-expect-error
const notAClass = (r: Registry) => r.create('Circle'); // create takes a class

// @ts-expect-error
const notConstructable = (r: Registry) => r.create(Math); // Math is not a class

// @ts-expect-error
const needsArgs = (r: Registry) => r.register(Clock, (n: number) => clock); // make takes no arguments

// @ts-expect-error
const arrowFn = (r: Registry) => r.create(() => clock); // an arrow function is not a class

test('register returns the registry itself', () => {
  const registry = new Registry();
  expect(registry.register(Clock, () => new Clock())).toBe(registry);
  const app = new AppRegistry();
  expect(app.register(Clock, () => new Clock())).toBe(app);
});

test('create returns what the factory makes', () => {
  const registry = new Registry();
  const clock = new Clock();
  const unit = new Circle(1);
  registry.register(Clock, () => clock).register(Circle, () => unit);
  expect(registry.create(Clock)).toBe(clock);
  expect(registry.create(Circle)).toBe(unit);
});

test('create calls the factory every time', () => {
  const registry = new Registry();
  const made: Square[] = [];
  registry.register(Square, () => {
    const square = new Square(made.length + 1);
    made.push(square);
    return square;
  });
  for (let n = 1; n <= 5; n++) {
    expect(registry.create(Square)).toBe(made[n - 1]);
    expect(made).toHaveLength(n);
  }
});

test('an abstract class can be registered with a subclass factory', () => {
  const registry = new Registry();
  const square = new Square(3);
  registry.register(Shape, () => square);
  expect(registry.create(Shape)).toBe(square);
  expect(registry.create(Shape)).toBeInstanceOf(Square);
});

test('each class has its own factory', () => {
  const shape = new Square(2);
  const circle = new Circle(2);
  const square = new Square(5);
  const date = new Date(0);
  const registry = new Registry()
    .register(Shape, () => shape)
    .register(Circle, () => circle)
    .register(Square, () => square)
    .register(Date, () => date);
  expect(registry.create(Shape)).toBe(shape);
  expect(registry.create(Circle)).toBe(circle);
  expect(registry.create(Square)).toBe(square);
  expect(registry.create(Date)).toBe(date);
});

test('registering a class again replaces its factory', () => {
  const small = new Circle(1);
  const large = new Circle(9);
  const registry = new Registry().register(Circle, () => small);
  registry.register(Circle, () => large);
  expect(registry.create(Circle)).toBe(large);
});

test('create throws when nothing is registered for the class', () => {
  const registry = new Registry().register(Circle, () => new Circle(1));
  expect(() => registry.create(Square)).toThrow();
  expect(() => registry.create(Shape)).toThrow();
  expect(() => new Registry().create(Clock)).toThrow();
});

test('two registries are separate', () => {
  const a = new Registry().register(Clock, () => new Clock());
  const b = new Registry();
  expect(a.create(Clock)).toBeInstanceOf(Clock);
  expect(() => b.create(Clock)).toThrow();
});

export { wrongInstance, notAClass, notConstructable, needsArgs, arrowFn };
