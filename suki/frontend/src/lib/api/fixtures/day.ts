// Today's takings — for /day. Cash sales made outside the ledger.
// Deterministic. Amounts are integers.

export interface CashSaleFixture {
  id: string;
  createdAt: string;
  total: number;
  note?: string;
}

export const TODAY_CASH_SALES: CashSaleFixture[] = [
  { id: 's001', createdAt: '2025-09-15T06:20:00.000Z', total: 42, note: 'Pandesal + kopi' },
  { id: 's002', createdAt: '2025-09-15T06:45:00.000Z', total: 15 },
  { id: 's003', createdAt: '2025-09-15T07:10:00.000Z', total: 20 },
  { id: 's004', createdAt: '2025-09-15T07:35:00.000Z', total: 68 },
  { id: 's005', createdAt: '2025-09-15T08:15:00.000Z', total: 12 },
  { id: 's006', createdAt: '2025-09-15T08:40:00.000Z', total: 55 },
  { id: 's007', createdAt: '2025-09-15T09:05:00.000Z', total: 30, note: 'Load' },
  { id: 's008', createdAt: '2025-09-15T09:30:00.000Z', total: 88 },
  { id: 's009', createdAt: '2025-09-15T10:00:00.000Z', total: 25 },
];
