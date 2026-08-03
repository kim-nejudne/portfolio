// Three months of ledger entries. Deterministic ISO strings. Every amount an integer.
// About 15 customers carry a positive balance as of APP_TODAY (2025-09-15).
// Purchases increase utang, payments decrease it.

import type { LedgerEntry, SaleItem } from '../../types';

function line(itemId: string, name: string, qty: number, unitPrice: number): SaleItem {
  return { itemId, name, qty, unitPrice, lineTotal: qty * unitPrice };
}

export const LEDGER: LedgerEntry[] = [
  // ============ July — payments cleared many old balances ============
  {
    id: 'l001', customerId: 'c01', kind: 'purchase', amount: 94,
    createdAt: '2025-07-02T10:15:00.000Z',
    items: [line('i01', 'Palmolive Shampoo Sachet', 2, 10), line('i19', 'Lucky Me Pancit Canton Chilimansi', 3, 15), line('i42', 'Pandesal', 4, 3), line('i06', 'Kopiko Brown Coffee 3-in-1', 1, 9), line('i54', 'Joy Dishwash Sachet', 1, 8)],
  },
  {
    id: 'l002', customerId: 'c01', kind: 'purchase', amount: 65,
    createdAt: '2025-07-05T17:20:00.000Z',
    items: [line('i11', 'Century Tuna Flakes 155g', 1, 35), line('i19', 'Lucky Me Pancit Canton Chilimansi', 2, 15)],
  },
  { id: 'l003', customerId: 'c01', kind: 'payment', amount: 159, createdAt: '2025-07-15T08:00:00.000Z', note: 'Kinsenas' },

  {
    id: 'l004', customerId: 'c02', kind: 'purchase', amount: 132,
    createdAt: '2025-07-03T09:00:00.000Z',
    items: [line('i31', 'Marlboro Red Stick', 6, 10), line('i06', 'Kopiko Brown Coffee 3-in-1', 4, 9), line('i42', 'Pandesal', 12, 3)],
  },
  {
    id: 'l005', customerId: 'c02', kind: 'purchase', amount: 48,
    createdAt: '2025-07-08T18:00:00.000Z',
    items: [line('i31', 'Marlboro Red Stick', 3, 10), line('i06', 'Kopiko Brown Coffee 3-in-1', 2, 9)],
  },
  { id: 'l006', customerId: 'c02', kind: 'payment', amount: 180, createdAt: '2025-07-31T19:30:00.000Z', note: 'Katapusan' },

  {
    id: 'l007', customerId: 'c04', kind: 'purchase', amount: 163,
    createdAt: '2025-07-06T11:30:00.000Z',
    items: [line('i35', 'Sinandomeng Rice', 2, 55), line('i11', 'Century Tuna Flakes 155g', 1, 35), line('i54', 'Joy Dishwash Sachet', 1, 8), line('i01', 'Palmolive Shampoo Sachet', 1, 10)],
  },
  { id: 'l008', customerId: 'c04', kind: 'payment', amount: 163, createdAt: '2025-07-31T20:00:00.000Z', note: 'Katapusan' },

  {
    id: 'l009', customerId: 'c07', kind: 'purchase', amount: 71,
    createdAt: '2025-07-04T15:45:00.000Z',
    items: [line('i31', 'Marlboro Red Stick', 3, 10), line('i24', 'Coke Sakto 200ml', 1, 16), line('i44', 'Skyflakes Crackers Single', 1, 10), line('i42', 'Pandesal', 5, 3)],
  },

  // ============ August ============
  {
    id: 'l010', customerId: 'c01', kind: 'purchase', amount: 100,
    createdAt: '2025-08-02T09:20:00.000Z',
    items: [line('i19', 'Lucky Me Pancit Canton Chilimansi', 4, 15), line('i42', 'Pandesal', 10, 3), line('i01', 'Palmolive Shampoo Sachet', 1, 10)],
  },
  {
    id: 'l011', customerId: 'c01', kind: 'purchase', amount: 91,
    createdAt: '2025-08-09T16:00:00.000Z',
    items: [line('i04', 'Cream Silk Conditioner Sachet', 2, 10), line('i06', 'Kopiko Brown Coffee 3-in-1', 3, 9), line('i42', 'Pandesal', 12, 3), line('i54', 'Joy Dishwash Sachet', 1, 8)],
  },
  { id: 'l012', customerId: 'c01', kind: 'payment', amount: 100, createdAt: '2025-08-15T08:15:00.000Z', note: 'Kinsenas' },

  {
    id: 'l013', customerId: 'c02', kind: 'purchase', amount: 145,
    createdAt: '2025-08-05T09:15:00.000Z',
    items: [line('i31', 'Marlboro Red Stick', 10, 10), line('i06', 'Kopiko Brown Coffee 3-in-1', 5, 9)],
  },
  { id: 'l014', customerId: 'c02', kind: 'payment', amount: 145, createdAt: '2025-08-31T19:00:00.000Z', note: 'Katapusan' },

  {
    id: 'l015', customerId: 'c04', kind: 'purchase', amount: 230,
    createdAt: '2025-08-07T10:00:00.000Z',
    items: [line('i35', 'Sinandomeng Rice', 3, 55), line('i12', 'Argentina Corned Beef 150g', 1, 42), line('i54', 'Joy Dishwash Sachet', 1, 8), line('i22', 'Nissin Yakisoba Cheese', 0, 28), line('i19', 'Lucky Me Pancit Canton Chilimansi', 1, 15)].filter((s) => s.qty > 0),
  },
  { id: 'l016', customerId: 'c04', kind: 'payment', amount: 230, createdAt: '2025-08-31T20:30:00.000Z', note: 'Katapusan' },

  {
    id: 'l017', customerId: 'c07', kind: 'purchase', amount: 168,
    createdAt: '2025-08-10T14:00:00.000Z',
    items: [line('i31', 'Marlboro Red Stick', 10, 10), line('i24', 'Coke Sakto 200ml', 3, 16), line('i44', 'Skyflakes Crackers Single', 2, 10)],
  },
  { id: 'l018', customerId: 'c07', kind: 'payment', amount: 100, createdAt: '2025-08-31T19:15:00.000Z', note: 'Partial — pay next kinsenas' },

  {
    id: 'l019', customerId: 'c09', kind: 'purchase', amount: 260,
    createdAt: '2025-08-12T13:20:00.000Z',
    items: [line('i35', 'Sinandomeng Rice', 3, 55), line('i15', 'Mega Sardines Red 155g', 2, 25), line('i19', 'Lucky Me Pancit Canton Chilimansi', 3, 15)],
  },

  {
    id: 'l020', customerId: 'c15', kind: 'purchase', amount: 96,
    createdAt: '2025-08-15T09:30:00.000Z',
    items: [line('i42', 'Pandesal', 12, 3), line('i06', 'Kopiko Brown Coffee 3-in-1', 4, 9), line('i54', 'Joy Dishwash Sachet', 3, 8)],
  },

  // ============ September — today is 15 Sep. Balances build up. ============
  {
    id: 'l021', customerId: 'c01', kind: 'purchase', amount: 120,
    createdAt: '2025-09-02T08:45:00.000Z',
    items: [line('i35', 'Sinandomeng Rice', 1, 55), line('i19', 'Lucky Me Pancit Canton Chilimansi', 2, 15), line('i11', 'Century Tuna Flakes 155g', 1, 35)],
  },
  {
    id: 'l022', customerId: 'c01', kind: 'purchase', amount: 79,
    createdAt: '2025-09-05T17:10:00.000Z',
    items: [line('i42', 'Pandesal', 8, 3), line('i06', 'Kopiko Brown Coffee 3-in-1', 3, 9), line('i04', 'Cream Silk Conditioner Sachet', 2, 10), line('i54', 'Joy Dishwash Sachet', 1, 8)],
  },
  {
    id: 'l023', customerId: 'c01', kind: 'purchase', amount: 42,
    createdAt: '2025-09-09T18:30:00.000Z',
    items: [line('i42', 'Pandesal', 6, 3), line('i19', 'Lucky Me Pancit Canton Chilimansi', 1, 15), line('i06', 'Kopiko Brown Coffee 3-in-1', 1, 9)],
  },

  {
    id: 'l024', customerId: 'c02', kind: 'purchase', amount: 58,
    createdAt: '2025-09-02T07:20:00.000Z',
    items: [line('i31', 'Marlboro Red Stick', 4, 10), line('i06', 'Kopiko Brown Coffee 3-in-1', 2, 9)],
  },
  {
    id: 'l025', customerId: 'c02', kind: 'purchase', amount: 90,
    createdAt: '2025-09-06T07:15:00.000Z',
    items: [line('i31', 'Marlboro Red Stick', 6, 10), line('i06', 'Kopiko Brown Coffee 3-in-1', 3, 9), line('i42', 'Pandesal', 1, 3)],
  },
  {
    id: 'l026', customerId: 'c02', kind: 'purchase', amount: 90,
    createdAt: '2025-09-10T07:30:00.000Z',
    items: [line('i31', 'Marlboro Red Stick', 6, 10), line('i06', 'Kopiko Brown Coffee 3-in-1', 3, 9), line('i42', 'Pandesal', 1, 3)],
  },
  {
    id: 'l027', customerId: 'c02', kind: 'purchase', amount: 58,
    createdAt: '2025-09-13T07:40:00.000Z',
    items: [line('i31', 'Marlboro Red Stick', 4, 10), line('i06', 'Kopiko Brown Coffee 3-in-1', 2, 9)],
  },

  {
    id: 'l028', customerId: 'c04', kind: 'purchase', amount: 340,
    createdAt: '2025-09-03T11:00:00.000Z',
    items: [line('i35', 'Sinandomeng Rice', 4, 55), line('i11', 'Century Tuna Flakes 155g', 2, 35), line('i12', 'Argentina Corned Beef 150g', 1, 42), line('i54', 'Joy Dishwash Sachet', 1, 8)],
  },
  {
    id: 'l029', customerId: 'c04', kind: 'purchase', amount: 150,
    createdAt: '2025-09-08T15:15:00.000Z',
    items: [line('i19', 'Lucky Me Pancit Canton Chilimansi', 4, 15), line('i22', 'Nissin Yakisoba Cheese', 1, 28), line('i03', 'Head & Shoulders Sachet', 2, 12), line('i17', 'Del Monte Fiesta Spaghetti Sauce', 1, 38)],
  },

  {
    id: 'l030', customerId: 'c05', kind: 'purchase', amount: 35,
    createdAt: '2025-09-04T16:20:00.000Z',
    items: [line('i11', 'Century Tuna Flakes 155g', 1, 35), line('i06', 'Kopiko Brown Coffee 3-in-1', 0, 9), line('i44', 'Skyflakes Crackers Single', 0, 10), line('i06', 'Kopiko Brown Coffee 3-in-1', 0, 9), line('i54', 'Joy Dishwash Sachet', 0, 8), line('i06', 'Kopiko Brown Coffee 3-in-1', 0, 9)].filter((s) => s.qty > 0),
  },

  {
    id: 'l031', customerId: 'c07', kind: 'purchase', amount: 128,
    createdAt: '2025-09-02T14:50:00.000Z',
    items: [line('i31', 'Marlboro Red Stick', 8, 10), line('i24', 'Coke Sakto 200ml', 3, 16)],
  },
  {
    id: 'l032', customerId: 'c07', kind: 'purchase', amount: 78,
    createdAt: '2025-09-07T15:30:00.000Z',
    items: [line('i31', 'Marlboro Red Stick', 5, 10), line('i44', 'Skyflakes Crackers Single', 1, 10), line('i25', 'Royal Tru-Orange 250ml', 1, 18)],
  },

  {
    id: 'l033', customerId: 'c09', kind: 'purchase', amount: 182,
    createdAt: '2025-09-05T12:00:00.000Z',
    items: [line('i35', 'Sinandomeng Rice', 2, 55), line('i15', 'Mega Sardines Red 155g', 1, 25), line('i19', 'Lucky Me Pancit Canton Chilimansi', 2, 15), line('i06', 'Kopiko Brown Coffee 3-in-1', 1, 9), line('i54', 'Joy Dishwash Sachet', 1, 8)],
  },

  {
    id: 'l034', customerId: 'c10', kind: 'purchase', amount: 58,
    createdAt: '2025-09-06T09:20:00.000Z',
    items: [line('i01', 'Palmolive Shampoo Sachet', 2, 10), line('i04', 'Cream Silk Conditioner Sachet', 2, 10), line('i56', 'Colgate Toothpaste Sachet', 1, 10), line('i54', 'Joy Dishwash Sachet', 1, 8)],
  },

  {
    id: 'l035', customerId: 'c12', kind: 'purchase', amount: 211,
    createdAt: '2025-09-03T10:00:00.000Z',
    items: [line('i37', 'NFA Rice', 3, 42), line('i14', 'Ligo Sardines Green 155g', 2, 22), line('i19', 'Lucky Me Pancit Canton Chilimansi', 1, 15), line('i54', 'Joy Dishwash Sachet', 1, 8), line('i06', 'Kopiko Brown Coffee 3-in-1', 2, 9)],
  },
  { id: 'l036', customerId: 'c12', kind: 'payment', amount: 95, createdAt: '2025-09-12T18:20:00.000Z', note: 'Partial' },

  {
    id: 'l037', customerId: 'c15', kind: 'purchase', amount: 82,
    createdAt: '2025-09-04T13:00:00.000Z',
    items: [line('i42', 'Pandesal', 10, 3), line('i06', 'Kopiko Brown Coffee 3-in-1', 4, 9), line('i54', 'Joy Dishwash Sachet', 2, 8)],
  },

  {
    id: 'l038', customerId: 'c18', kind: 'purchase', amount: 219,
    createdAt: '2025-09-01T11:30:00.000Z',
    items: [line('i31', 'Marlboro Red Stick', 15, 10), line('i24', 'Coke Sakto 200ml', 2, 16), line('i44', 'Skyflakes Crackers Single', 2, 10), line('i06', 'Kopiko Brown Coffee 3-in-1', 1, 9), line('i54', 'Joy Dishwash Sachet', 1, 8)],
  },

  {
    id: 'l039', customerId: 'c20', kind: 'purchase', amount: 69,
    createdAt: '2025-09-08T09:00:00.000Z',
    items: [line('i11', 'Century Tuna Flakes 155g', 1, 35), line('i44', 'Skyflakes Crackers Single', 1, 10), line('i19', 'Lucky Me Pancit Canton Chilimansi', 1, 15), line('i06', 'Kopiko Brown Coffee 3-in-1', 1, 9)],
  },

  {
    id: 'l040', customerId: 'c22', kind: 'purchase', amount: 153,
    createdAt: '2025-09-06T16:30:00.000Z',
    items: [line('i35', 'Sinandomeng Rice', 2, 55), line('i11', 'Century Tuna Flakes 155g', 1, 35), line('i54', 'Joy Dishwash Sachet', 1, 8)],
  },
  { id: 'l041', customerId: 'c22', kind: 'payment', amount: 50, createdAt: '2025-09-13T17:00:00.000Z', note: 'Partial — pang katapusan pa' },

  {
    id: 'l042', customerId: 'c25', kind: 'purchase', amount: 96,
    createdAt: '2025-09-10T13:15:00.000Z',
    items: [line('i31', 'Marlboro Red Stick', 6, 10), line('i06', 'Kopiko Brown Coffee 3-in-1', 4, 9)],
  },

  {
    id: 'l043', customerId: 'c27', kind: 'purchase', amount: 35,
    createdAt: '2025-09-12T09:45:00.000Z',
    items: [line('i11', 'Century Tuna Flakes 155g', 1, 35)],
  },

  {
    id: 'l044', customerId: 'c29', kind: 'purchase', amount: 141,
    createdAt: '2025-09-04T12:00:00.000Z',
    items: [line('i31', 'Marlboro Red Stick', 8, 10), line('i06', 'Kopiko Brown Coffee 3-in-1', 3, 9), line('i25', 'Royal Tru-Orange 250ml', 1, 18), line('i44', 'Skyflakes Crackers Single', 1, 10), line('i42', 'Pandesal', 2, 3)],
  },

  {
    id: 'l045', customerId: 'c32', kind: 'purchase', amount: 55,
    createdAt: '2025-09-11T18:20:00.000Z',
    items: [line('i35', 'Sinandomeng Rice', 1, 55)],
  },

  {
    id: 'l046', customerId: 'c36', kind: 'purchase', amount: 85,
    createdAt: '2025-09-07T20:00:00.000Z',
    items: [line('i31', 'Marlboro Red Stick', 5, 10), line('i06', 'Kopiko Brown Coffee 3-in-1', 3, 9), line('i54', 'Joy Dishwash Sachet', 1, 8)],
  },

  {
    id: 'l047', customerId: 'c38', kind: 'purchase', amount: 132,
    createdAt: '2025-09-09T10:10:00.000Z',
    items: [line('i37', 'NFA Rice', 2, 42), line('i14', 'Ligo Sardines Green 155g', 1, 22), line('i54', 'Joy Dishwash Sachet', 1, 8), line('i06', 'Kopiko Brown Coffee 3-in-1', 2, 9)],
  },

  {
    id: 'l048', customerId: 'c40', kind: 'purchase', amount: 46,
    createdAt: '2025-09-13T08:45:00.000Z',
    items: [line('i42', 'Pandesal', 6, 3), line('i06', 'Kopiko Brown Coffee 3-in-1', 2, 9), line('i44', 'Skyflakes Crackers Single', 1, 10)],
  },
];
