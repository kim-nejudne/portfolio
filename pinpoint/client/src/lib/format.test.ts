import { describe, expect, it } from 'vitest';
import { flapRows, formatKm, formatMovement, gateLabel, multiplierRow } from './format.js';

describe('format', () => {
  it('writes distances with one decimal under 10 km', () => {
    expect(formatKm(4.24)).toBe('4.2 km');
    expect(formatKm(9.96)).toBe('10 km');
    expect(formatKm(1240.4)).toBe('1,240 km');
  });

  it('wraps prompt flaps at 22 cells, whole words', () => {
    expect(flapRows('Lima')).toEqual(['Lima']);
    expect(flapRows('Santiago de Compostela, Spain')).toEqual(['Santiago de', 'Compostela, Spain']);
    expect(flapRows('Ciudad del Este, Paraguay')).toEqual(['Ciudad del Este,', 'Paraguay']);
    expect(flapRows('a'.repeat(22) + ' b')).toEqual(['a'.repeat(22), 'b']);
  });

  it('builds the gate label, with the multiplier only on boosted rounds', () => {
    const r = { number: 3, total: 10, multiplier: 1 };
    expect(gateLabel(r, 'nowBoarding')).toBe('Round 3/10 · Now boarding');
    expect(gateLabel(r, 'boarding')).toBe('Round 3/10 · Boarding');
    expect(gateLabel({ ...r, multiplier: 1.5 }, 'finalCall')).toBe(
      'Round 3/10 · ×1.5 · Final call',
    );
    expect(gateLabel({ ...r, multiplier: 2 }, 'delayed')).toBe('Round 3/10 · ×2 · Delayed');
  });

  it('names boosted rounds and movement', () => {
    expect(multiplierRow(1)).toBeNull();
    expect(multiplierRow(1.5)).toBe('×1.5 Bonus round');
    expect(multiplierRow(2)).toBe('×2 Final round');
    expect(formatMovement(2)).toBe('▲2');
    expect(formatMovement(-1)).toBe('▼1');
    expect(formatMovement(0)).toBe('');
  });
});
