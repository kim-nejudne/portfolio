// Stock movements — delivery events primarily. Deterministic ISO dates.
import type { StockMovement } from '@suki/domain';

export const STOCK_MOVEMENTS: StockMovement[] = [
  { id: 'm001', itemId: 'i01', kind: 'delivery', qty: 24, createdAt: '2025-08-15T07:30:00.000Z', note: 'Delivery from market' },
  { id: 'm002', itemId: 'i01', kind: 'delivery', qty: 12, createdAt: '2025-09-01T07:30:00.000Z', note: 'Delivery from market' },
  { id: 'm003', itemId: 'i03', kind: 'delivery', qty: 24, createdAt: '2025-08-22T07:30:00.000Z' },
  { id: 'm004', itemId: 'i10', kind: 'delivery', qty: 24, createdAt: '2025-08-15T07:30:00.000Z' },
  { id: 'm005', itemId: 'i10', kind: 'sale',     qty: 24, createdAt: '2025-09-10T18:00:00.000Z' },
  { id: 'm006', itemId: 'i35', kind: 'delivery', qty: 25, createdAt: '2025-09-08T07:30:00.000Z' },
  { id: 'm007', itemId: 'i35', kind: 'spoilage', qty: 1,  createdAt: '2025-09-11T20:00:00.000Z', note: 'One kilo wet from leak' },
  { id: 'm008', itemId: 'i06', kind: 'delivery', qty: 60, createdAt: '2025-09-05T07:30:00.000Z' },
  { id: 'm009', itemId: 'i31', kind: 'delivery', qty: 200,createdAt: '2025-09-01T07:30:00.000Z' },
  { id: 'm010', itemId: 'i34', kind: 'sale',     qty: 40, createdAt: '2025-09-12T19:00:00.000Z', note: 'Sold out' },
];
