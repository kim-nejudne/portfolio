// §4 Running: console arguments are serialized in the worker, depth 3, cycle-safe, with Error,
// Map, Set, Date, class names and functions readable. §12 F4: a string, a nested object, a
// Map, a class instance and an Error render readably.
import { describe, expect, it } from 'vitest';
import { formatArgs, serialize } from './serialize';

class Point {
  x: number;
  y: number;
  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }
}

describe('serialize', () => {
  it('prints primitives the way the console does', () => {
    expect(serialize(1)).toBe('1');
    expect(serialize(-0)).toBe('-0');
    expect(serialize(NaN)).toBe('NaN');
    expect(serialize(10n)).toBe('10n');
    expect(serialize(true)).toBe('true');
    expect(serialize(null)).toBe('null');
    expect(serialize(undefined)).toBe('undefined');
    expect(serialize(Symbol('tag'))).toBe('Symbol(tag)');
  });

  it('quotes a nested string and leaves a top-level string raw', () => {
    expect(serialize('hi')).toBe("'hi'");
    expect(formatArgs(['hi', 'there'])).toEqual(['hi', 'there']);
    expect(formatArgs([['hi']])).toEqual(["[ 'hi' ]"]);
  });

  it('prints objects and arrays to depth 3, then [Object] and [Array]', () => {
    expect(serialize({ a: 1, b: 'x' })).toBe("{ a: 1, b: 'x' }");
    expect(serialize([1, [2, [3, [4]]]])).toBe('[ 1, [ 2, [ 3, [Array] ] ] ]');
    expect(serialize({ a: { b: { c: { d: 1 } } } })).toBe(
      '{ a: { b: { c: [Object] } } }',
    );
    expect(serialize({})).toBe('{}');
    expect(serialize([])).toBe('[]');
  });

  it('marks a cycle instead of recursing', () => {
    const o: { self?: unknown; list: unknown[] } = { list: [] };
    o.self = o;
    o.list.push(o);
    expect(serialize(o)).toBe('{ list: [ [Circular] ], self: [Circular] }');
  });

  it('shows Map, Set and Date readably', () => {
    expect(serialize(new Map([['k', 1]]))).toBe("Map(1) { 'k' => 1 }");
    expect(serialize(new Set([1, 'a']))).toBe("Set(2) { 1, 'a' }");
    expect(serialize(new Date(Date.UTC(2026, 9, 17)))).toBe(
      '2026-10-17T00:00:00.000Z',
    );
    expect(serialize(new Map())).toBe('Map(0) {}');
  });

  it('names a class instance and a function', () => {
    expect(serialize(new Point(1, 2))).toBe('Point { x: 1, y: 2 }');
    expect(serialize(Point)).toBe('[class Point]');
    expect(serialize(function area() {})).toBe('[Function: area]');
    expect(serialize(() => 1)).toBe('[Function (anonymous)]');
    expect(serialize(Object.create(null))).toBe('[Object: null prototype] {}');
  });

  it('shows an Error as name and message, with its cause', () => {
    expect(serialize(new Error('boom'))).toBe('Error: boom');
    expect(serialize(new TypeError('bad'))).toBe('TypeError: bad');
    expect(serialize(new Error('outer', { cause: new Error('inner') }))).toBe(
      'Error: outer { cause: Error: inner }',
    );
  });

  it('shows typed arrays, regexps, promises and symbols keys', () => {
    expect(serialize(new Uint8Array([1, 2]))).toBe('Uint8Array(2) [ 1, 2 ]');
    expect(serialize(/a+/g)).toBe('/a+/g');
    expect(serialize(Promise.resolve(1))).toBe('Promise {}');
    expect(serialize({ [Symbol('s')]: 1 })).toBe('{ [Symbol(s)]: 1 }');
  });

  it('survives a getter that throws', () => {
    const o = {
      get bad(): never {
        throw new Error('no');
      },
    };
    expect(serialize(o)).toBe('{ bad: [Getter] }');
  });
});
