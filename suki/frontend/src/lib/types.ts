// All shared types for SUKI. No `any`. Amounts are integer pesos.

export type Peso = number; // integer pesos, always

export type Category =
  | 'sachet'
  | 'canned'
  | 'noodles'
  | 'drinks'
  | 'cigarettes'
  | 'rice'
  | 'load'
  | 'bread'
  | 'candy'
  | 'household';

export interface Item {
  id: string;
  name: string;
  category: Category;
  buyUnit: string;      // e.g. 'ream', 'case', 'pack', 'kilo'
  sellUnit: string;     // e.g. 'sachet', 'can', 'piece', 'stick'
  perPack: number;      // conversion: sell units per buy unit
  buyPrice: Peso;       // integer pesos per buy unit
  sellPrice: Peso;      // integer pesos per sell unit
  stock: number;        // in sell units
  reorderAt: number;    // reorder threshold in sell units
}

export interface Customer {
  id: string;
  name: string;
  purok: string;       // street/block within the barangay
  paydayPreference: 'kinsenas' | 'katapusan' | 'either';
  createdAt: string;   // ISO string
}

export type LedgerEntryKind = 'purchase' | 'payment';

export interface SaleItem {
  itemId: string;
  name: string;         // snapshot at time of sale
  qty: number;
  unitPrice: Peso;
  lineTotal: Peso;
}

export interface LedgerEntry {
  id: string;
  customerId: string;
  kind: LedgerEntryKind;
  amount: Peso;         // always positive integer
  createdAt: string;    // ISO string
  items?: SaleItem[];   // for purchases
  note?: string;
  operationId?: string; // links to the queued op that created it
}

export type StockMovementKind = 'delivery' | 'sale' | 'spoilage' | 'adjustment';
export interface StockMovement {
  id: string;
  itemId: string;
  kind: StockMovementKind;
  qty: number;           // sell units, positive integer
  createdAt: string;
  note?: string;
}

export type OperationType =
  | 'cash-sale'
  | 'credit-sale'
  | 'payment'
  | 'stock-adjustment'
  | 'buy-price-change'
  | 'settings-change';

export type OperationStatus = 'pending' | 'synced' | 'failed';

export interface Operation<P = unknown> {
  id: string;             // client UUID via crypto.randomUUID()
  type: OperationType;
  payload: P;
  createdAt: string;      // ISO
  status: OperationStatus;
}

export interface CashSalePayload {
  items: SaleItem[];
  total: Peso;
}

export interface CreditSalePayload extends CashSalePayload {
  customerId: string;
}

export interface PaymentPayload {
  customerId: string;
  amount: Peso;
}

export interface StockAdjustmentPayload {
  itemId: string;
  kind: StockMovementKind;
  qty: number;
  note?: string;
}

export interface BuyPriceChangePayload {
  itemId: string;
  buyPrice: Peso;
}

export interface SettingsChangePayload {
  storeName: string;
  barangay: string;
  paydays: { kinsenas: number; katapusan: 'last' };
  defaultReorderPoint: number;
}

export interface Session {
  storeName: string;
  barangay: string;
  today: string;        // ISO fixed at app start
  defaultReorderPoint: number;
}

export interface QueueSnapshot {
  pending: Operation[];
  online: boolean;
}
