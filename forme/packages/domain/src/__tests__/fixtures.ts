import type { JobRecord, PriceMatrix, QuoteInput } from '../types';

/**
 * A deliberately small, hand-checkable price matrix.
 *
 * Not the seed data: these tests assert exact peso totals, and against the real
 * matrix every expectation would be a number nobody could verify by hand and
 * everybody would "fix" by pasting in whatever the code returned. Round
 * numbers here mean the arithmetic can be checked on paper.
 */
export const TEST_MATRIX: PriceMatrix = {
  products: [
    { id: 'flyers', label: 'Flyers', setup: 1000, perThousand: 2000, note: '' },
    { id: 'booklets', label: 'Booklets', setup: 2000, perThousand: 4000, note: '' },
    { id: 'posters', label: 'Posters', setup: 1000, perThousand: 5000, note: '' },
    { id: 'business-cards', label: 'Business cards', setup: 500, perThousand: 1000, note: '' },
    { id: 'folded-leaflets', label: 'Folded leaflets', setup: 1000, perThousand: 2000, note: '' },
  ],
  stocks: [
    {
      id: 'silk-150',
      label: 'Silk 150gsm',
      gsm: 150,
      coated: true,
      inkLimit: 300,
      multiplier: 1000,
    },
    {
      id: 'uncoated-170',
      label: 'Uncoated 170gsm',
      gsm: 170,
      coated: false,
      inkLimit: 260,
      multiplier: 1200,
    },
    { id: 'gloss-130', label: 'Gloss 130gsm', gsm: 130, coated: true, inkLimit: 300, multiplier: 900 },
    {
      id: 'silk-board-300',
      label: 'Silk board 300gsm',
      gsm: 300,
      coated: true,
      inkLimit: 300,
      multiplier: 1500,
    },
    {
      id: 'uncoated-board-350',
      label: 'Uncoated board 350gsm',
      gsm: 350,
      coated: false,
      inkLimit: 260,
      multiplier: 1600,
    },
    {
      id: 'colorplan-270',
      label: 'Colorplan 270gsm',
      gsm: 270,
      coated: false,
      inkLimit: 260,
      multiplier: 2000,
    },
  ],
  quantityBreaks: [
    { quantity: 100, multiplier: 1000 },
    { quantity: 500, multiplier: 900 },
    { quantity: 1000, multiplier: 800 },
    { quantity: 2500, multiplier: 700 },
  ],
  finishing: [
    { id: 'trim', label: 'Trim only', perThousand: 0, flat: 0, bindery: false },
    { id: 'matt-lam', label: 'Matt lamination', perThousand: 1000, flat: 500, bindery: false },
    { id: 'saddle-stitch', label: 'Saddle stitch', perThousand: 2000, flat: 0, bindery: true },
    { id: 'half-fold', label: 'Half fold', perThousand: 500, flat: 0, bindery: true },
    { id: 'roll-fold', label: 'Roll fold', perThousand: 600, flat: 0, bindery: true },
    { id: 'gate-fold', label: 'Gate fold', perThousand: 700, flat: 0, bindery: true },
    { id: 'perfect-bound', label: 'Perfect bound', perThousand: 3000, flat: 1000, bindery: true },
    { id: 'gloss-lam', label: 'Gloss lamination', perThousand: 1000, flat: 500, bindery: false },
    { id: 'spot-uv', label: 'Spot UV', perThousand: 1500, flat: 800, bindery: false },
    { id: 'die-cut', label: 'Die cut', perThousand: 2000, flat: 2000, bindery: true },
  ],
  turnarounds: [
    { id: 'standard', label: 'Standard', workingDays: 5, multiplier: 1000 },
    { id: 'express', label: 'Express', workingDays: 3, multiplier: 1300 },
    { id: 'rush', label: 'Rush', workingDays: 1, multiplier: 1800 },
  ],
  colours: [
    { id: '4/4', label: '4/4', plates: 8, multiplier: 1000 },
    { id: '4/0', label: '4/0', plates: 4, multiplier: 800 },
    { id: '1/1', label: '1/1', plates: 2, multiplier: 600 },
    { id: '5/4', label: '5/4', plates: 9, multiplier: 1400 },
  ],
  sizes: [
    { id: 'A6', label: 'A6', widthMm: 105, heightMm: 148 },
    { id: 'A5', label: 'A5', widthMm: 148, heightMm: 210 },
    { id: 'A4', label: 'A4', widthMm: 210, heightMm: 297 },
    { id: 'A3', label: 'A3', widthMm: 297, heightMm: 420 },
    { id: 'DL', label: 'DL', widthMm: 99, heightMm: 210 },
    { id: '85x55', label: '85 × 55mm', widthMm: 85, heightMm: 55 },
  ],
};

/** A Wednesday, so working-day arithmetic has a Sunday to trip over. */
export const WEDNESDAY = '2026-08-05T09:00:00+08:00';

export function quoteInput(overrides: Partial<QuoteInput> = {}): QuoteInput {
  return {
    product: 'flyers',
    size: 'A5',
    pageCount: null,
    stock: 'silk-150',
    colours: '4/4',
    quantity: 1000,
    finishing: ['trim'],
    turnaround: 'standard',
    ...overrides,
  };
}

export function jobRecord(overrides: Partial<JobRecord> = {}): JobRecord {
  return {
    reference: 'FM-2608-0001',
    customerId: 'nine-dots',
    description: 'Test job',
    spec: quoteInput(),
    state: 'PREFLIGHT',
    stamps: {
      ESTIMATE: '2026-08-01T09:00:00+08:00',
      ARTWORK_RECEIVED: '2026-08-01T10:00:00+08:00',
      PREFLIGHT: '2026-08-01T11:00:00+08:00',
    },
    receivedAt: '2026-08-01T09:00:00+08:00',
    dueAt: '2026-08-08T17:00:00+08:00',
    proofState: 'NONE',
    proofAt: null,
    preflightReportId: null,
    comments: [],
    files: [],
    note: null,
    ...overrides,
  };
}

export const TEST_CUSTOMER = {
  id: 'nine-dots',
  name: 'Nine Dots Studio',
  shortName: 'Nine Dots',
  contact: 'studio@ninedots.test',
  city: 'Manila',
  terms: '30 days',
  account: 'ND-001',
};
