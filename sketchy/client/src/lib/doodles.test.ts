import { describe, expect, it } from 'vitest';
import { visibleStrokes } from '../../../shared/ink.js';
import type { InkOp } from '../../../shared/types.js';
import { createScreenDoodles } from './doodles.js';

const stroke = (id: number, x: number): InkOp[] => [
  ['b', id, 0, 1, x, 300],
  ['p', id, 4, -1, 6, -2],
  ['e', id],
];

describe('the Screen’s doodles', () => {
  it('starts from the snapshot, applies relays on top, and tells listeners which pid changed', () => {
    const doodles = createScreenDoodles();
    const changed: string[] = [];
    doodles.subscribe((pid) => changed.push(pid ?? '*'));
    doodles.replace({ ana: stroke(1, 100) });
    doodles.apply('ana', stroke(2, 200));
    doodles.apply('ben', stroke(1, 700));
    doodles.apply('ana', [['u']]);
    expect(visibleStrokes(doodles.get('ana')!).map((s) => s.points[0])).toEqual([100]);
    expect(visibleStrokes(doodles.get('ben')!).map((s) => s.points[0])).toEqual([700]);
    expect(changed).toEqual(['*', 'ana', 'ben', 'ana']);
  });

  it('a fresh snapshot replaces everything; one without doodles clears them', () => {
    const doodles = createScreenDoodles();
    doodles.replace({ ana: stroke(1, 100), ben: stroke(1, 700) });
    doodles.replace({ ben: stroke(1, 800) });
    expect(doodles.get('ana')).toBeUndefined();
    expect(visibleStrokes(doodles.get('ben')!)[0]!.points[0]).toBe(800);
    doodles.replace(undefined);
    expect(doodles.get('ben')).toBeUndefined();
  });

  it('bumps only the changed player’s version on a relay, everyone’s on a snapshot', () => {
    const doodles = createScreenDoodles();
    const ana0 = doodles.version('ana');
    const ben0 = doodles.version('ben');
    doodles.apply('ana', stroke(1, 100));
    expect(doodles.version('ana')).toBeGreaterThan(ana0);
    expect(doodles.version('ben')).toBe(ben0);
    const ana1 = doodles.version('ana');
    doodles.replace({});
    expect(doodles.version('ana')).toBeGreaterThan(ana1);
    expect(doodles.version('ben')).toBeGreaterThan(ben0);
  });
});
