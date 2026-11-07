import { describe, expect, it } from 'vitest';
import { PALETTE, TOKENS } from './constants.js';

// The colour maths lives here: nothing else needs it (DECISIONS 60).

type Vec3 = [number, number, number];
type Matrix = [Vec3, Vec3, Vec3];

const mul = (m: Matrix, v: Vec3): Vec3 =>
  m.map((row) => row[0] * v[0] + row[1] * v[1] + row[2] * v[2]) as Vec3;

const hexToSrgb = (hex: string): Vec3 =>
  [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as Vec3;

const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

/** sRGB (D65) linear RGB → XYZ, IEC 61966-2-1. */
const RGB_TO_XYZ: Matrix = [
  [0.4124564, 0.3575761, 0.1804375],
  [0.2126729, 0.7151522, 0.072175],
  [0.0193339, 0.119192, 0.9503041],
];
const WHITE: Vec3 = mul(RGB_TO_XYZ, [1, 1, 1]);

function linearToLab(rgb: Vec3): Vec3 {
  const xyz = mul(RGB_TO_XYZ, rgb.map((c) => Math.min(1, Math.max(0, c))) as Vec3);
  const f = (t: number) => (t > (6 / 29) ** 3 ? Math.cbrt(t) : t / (3 * (6 / 29) ** 2) + 4 / 29);
  const [fx, fy, fz] = xyz.map((v, i) => f(v / WHITE[i]!)) as Vec3;
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

const hexToLab = (hex: string, sim?: Matrix): Vec3 => {
  const linear = hexToSrgb(hex).map(toLinear) as Vec3;
  return linearToLab(sim ? mul(sim, linear) : linear);
};

/** CIEDE2000 (Sharma, Wu and Dalal 2005), kL = kC = kH = 1. */
function deltaE2000([L1, a1, b1]: Vec3, [L2, a2, b2]: Vec3): number {
  const rad = Math.PI / 180;
  const C1 = Math.hypot(a1, b1);
  const C2 = Math.hypot(a2, b2);
  const Cbar7 = ((C1 + C2) / 2) ** 7;
  const G = 0.5 * (1 - Math.sqrt(Cbar7 / (Cbar7 + 25 ** 7)));
  const a1p = (1 + G) * a1;
  const a2p = (1 + G) * a2;
  const C1p = Math.hypot(a1p, b1);
  const C2p = Math.hypot(a2p, b2);
  const hue = (b: number, a: number) => {
    if (a === 0 && b === 0) return 0;
    const h = Math.atan2(b, a) / rad;
    return h < 0 ? h + 360 : h;
  };
  const h1p = hue(b1, a1p);
  const h2p = hue(b2, a2p);

  const dLp = L2 - L1;
  const dCp = C2p - C1p;
  let dhp = 0;
  if (C1p * C2p !== 0) {
    dhp = h2p - h1p;
    if (dhp > 180) dhp -= 360;
    else if (dhp < -180) dhp += 360;
  }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp / 2) * rad);

  const Lbarp = (L1 + L2) / 2;
  const Cbarp = (C1p + C2p) / 2;
  let hbarp = h1p + h2p;
  if (C1p * C2p !== 0) {
    if (Math.abs(h1p - h2p) <= 180) hbarp /= 2;
    else hbarp = h1p + h2p < 360 ? (hbarp + 360) / 2 : (hbarp - 360) / 2;
  }
  const T =
    1 -
    0.17 * Math.cos((hbarp - 30) * rad) +
    0.24 * Math.cos(2 * hbarp * rad) +
    0.32 * Math.cos((3 * hbarp + 6) * rad) -
    0.2 * Math.cos((4 * hbarp - 63) * rad);
  const dTheta = 30 * Math.exp(-(((hbarp - 275) / 25) ** 2));
  const Cbarp7 = Cbarp ** 7;
  const RC = 2 * Math.sqrt(Cbarp7 / (Cbarp7 + 25 ** 7));
  const SL = 1 + (0.015 * (Lbarp - 50) ** 2) / Math.sqrt(20 + (Lbarp - 50) ** 2);
  const SC = 1 + 0.045 * Cbarp;
  const SH = 1 + 0.015 * Cbarp * T;
  const RT = -Math.sin(2 * dTheta * rad) * RC;
  return Math.sqrt(
    (dLp / SL) ** 2 + (dCp / SC) ** 2 + (dHp / SH) ** 2 + RT * (dCp / SC) * (dHp / SH),
  );
}

/** Machado, Oliveira and Fernandes 2009, severity 1.0, applied to linear RGB. */
const MACHADO: Record<'protanopia' | 'deuteranopia' | 'tritanopia', Matrix> = {
  protanopia: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deuteranopia: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
  tritanopia: [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.3039],
  ],
};

const pairs = PALETTE.flatMap((a, i) => PALETTE.slice(i + 1).map((b) => [a, b] as const));

/** Every pair below `min` under `sim`, so a failure names the colours. */
const closePairs = (min: number, sim?: Matrix) =>
  pairs
    .map(([a, b]) => ({ a, b, dE: +deltaE2000(hexToLab(a, sim), hexToLab(b, sim)).toFixed(2) }))
    .filter(({ dE }) => dE < min);

describe('colour maths', () => {
  it('matches the CIEDE2000 reference pairs (Sharma, Wu and Dalal 2005, Table 1)', () => {
    const table: [Vec3, Vec3, number][] = [
      [[50, 2.6772, -79.7751], [50, 0, -82.7485], 2.0425],
      [[50, 3.1571, -77.2803], [50, 0, -82.7485], 2.8615],
      [[50, 0, 0], [50, -1, 2], 2.3669],
      [[50, -1, 2], [50, 0, 0], 2.3669],
      [[50, 2.49, -0.001], [50, -2.49, 0.0011], 7.2195],
      [[50, 2.5, 0], [50, 0, -2.5], 4.3065],
      [[50, 2.5, 0], [73, 25, -18], 27.1492],
      [[50, 2.5, 0], [61, -5, 29], 22.8977],
      [[50, 2.5, 0], [56, -27, -3], 31.903],
      [[50, 2.5, 0], [58, 24, 15], 19.4535],
      [[60.2574, -34.0099, 36.2677], [60.4626, -34.1751, 39.4387], 1.2644],
      [[22.7233, 20.0904, -46.694], [23.0331, 14.973, -42.5619], 2.0373],
      [[90.8027, -2.0831, 1.441], [91.1528, -1.6435, 0.0447], 1.4441],
      [[2.0776, 0.0795, -1.135], [0.9033, -0.0636, -0.5514], 0.9082],
    ]; // prettier-ignore
    for (const [lab1, lab2, expected] of table) {
      expect(deltaE2000(lab1, lab2)).toBeCloseTo(expected, 4);
    }
  });

  it('converts sRGB to CIELAB (D65) like the published values', () => {
    const expectLab = (hex: string, lab: Vec3) =>
      hexToLab(hex).forEach((v, i) => expect(v).toBeCloseTo(lab[i]!, 2));
    expectLab('#FFFFFF', [100, 0, 0]);
    expectLab('#000000', [0, 0, 0]);
    expectLab('#FF0000', [53.2408, 80.0925, 67.2032]);
    expectLab('#00FF00', [87.7347, -86.1827, 83.1793]);
    expectLab('#0000FF', [32.297, 79.1875, -107.8602]);
    expectLab('#808080', [53.585, 0, 0]);
  });

  it('uses the Machado matrices, whose rows each sum to 1 (white and greys stay put)', () => {
    for (const m of Object.values(MACHADO)) {
      for (const row of m) expect(row[0] + row[1] + row[2]).toBeCloseTo(1, 5);
      expect(deltaE2000(hexToLab('#808080', m), hexToLab('#808080'))).toBeLessThan(0.01);
    }
  });

  it('collapses red and green under protanopia and deuteranopia, not tritanopia', () => {
    const dE = (sim?: Matrix) => deltaE2000(hexToLab('#D62728', sim), hexToLab('#2CA02C', sim));
    const normal = dE();
    expect(normal).toBeGreaterThan(50);
    expect(dE(MACHADO.protanopia)).toBeLessThan(normal / 2);
    expect(dE(MACHADO.deuteranopia)).toBeLessThan(normal / 10);
    expect(dE(MACHADO.tritanopia)).toBeGreaterThan(normal * 0.8);
  });
});

describe('player palette', () => {
  it('has 12 distinct colours', () => {
    expect(new Set(PALETTE).size).toBe(12);
  });

  it('keeps every pair at least 15 apart with normal vision', () => {
    expect(closePairs(15)).toEqual([]);
  });

  for (const [name, m] of Object.entries(MACHADO)) {
    it(`keeps every pair at least 8 apart under ${name}`, () => {
      expect(closePairs(8, m)).toEqual([]);
    });
  }

  it('keeps every colour at least 15 from --amber', () => {
    const amber = hexToLab(TOKENS.amber);
    const close = PALETTE.map((c) => ({ c, dE: +deltaE2000(hexToLab(c), amber).toFixed(2) }));
    expect(close.filter(({ dE }) => dE < 15)).toEqual([]);
  });
});
