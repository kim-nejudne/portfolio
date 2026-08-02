/**
 * Every type in FORME. Shared by every screen. Nothing structural is redeclared elsewhere.
 */

/* ---------------------------------------------------------------- session */

export type Role = 'customer' | 'prepress' | 'floor' | 'admin';

export interface Session {
  role: Role;
  operator: string;
  customerId: string | null;
  signedIn: boolean;
}

/* -------------------------------------------------------------- customers */

export interface Customer {
  id: string;
  name: string;
  shortName: string;
  contact: string;
  city: string;
  terms: string;
  account: string;
}

/* ------------------------------------------------------------------ quote */

export type ProductId = 'business-cards' | 'flyers' | 'booklets' | 'posters' | 'folded-leaflets';
export type SizeId = 'A6' | 'A5' | 'A4' | 'A3' | 'DL' | '85x55';
export type StockId =
  | 'gloss-130'
  | 'silk-150'
  | 'uncoated-170'
  | 'silk-board-300'
  | 'uncoated-board-350'
  | 'colorplan-270';
export type ColoursId = '4/4' | '4/0' | '1/1' | '5/4';
export type FinishingId =
  | 'trim'
  | 'half-fold'
  | 'roll-fold'
  | 'gate-fold'
  | 'saddle-stitch'
  | 'perfect-bound'
  | 'matt-lam'
  | 'gloss-lam'
  | 'spot-uv'
  | 'die-cut';
export type TurnaroundId = 'standard' | 'express' | 'rush';
export type SheetId = 'SRA3' | 'B2' | 'B1';
export type PressId = 'XL75' | 'G40' | 'INDIGO';

export interface QuoteInput {
  product: ProductId;
  size: SizeId;
  pageCount: number | null;
  stock: StockId;
  colours: ColoursId;
  quantity: number;
  finishing: readonly FinishingId[];
  turnaround: TurnaroundId;
}

export interface QuoteResult {
  input: QuoteInput;
  unitPrice: number;
  subtotal: number;
  vat: number;
  total: number;
  press: PressId;
  pressReason: string;
  sheetId: SheetId;
  upCount: number;
  sheetsRequired: number;
  wasteSheets: number;
  workingDays: number;
  despatchAt: string;
  scheme: SignatureScheme | null;
  notes: readonly string[];
}

export interface QuoteFieldError {
  field: keyof QuoteInput;
  message: string;
}

/* ------------------------------------------------------------ price matrix */

export interface ProductRate {
  id: ProductId;
  label: string;
  setup: number;
  perThousand: number;
  note: string;
}

export interface StockRate {
  id: StockId;
  label: string;
  gsm: number;
  coated: boolean;
  inkLimit: number;
  multiplier: number;
}

export interface QuantityBreak {
  quantity: number;
  multiplier: number;
}

export interface FinishingRate {
  id: FinishingId;
  label: string;
  perThousand: number;
  flat: number;
  bindery: boolean;
}

export interface TurnaroundRate {
  id: TurnaroundId;
  label: string;
  workingDays: number;
  multiplier: number;
}

export interface ColourRate {
  id: ColoursId;
  label: string;
  plates: number;
  multiplier: number;
}

export interface SizeRate {
  id: SizeId;
  label: string;
  widthMm: number;
  heightMm: number;
}

export interface PriceMatrix {
  products: readonly ProductRate[];
  stocks: readonly StockRate[];
  quantityBreaks: readonly QuantityBreak[];
  finishing: readonly FinishingRate[];
  turnarounds: readonly TurnaroundRate[];
  colours: readonly ColourRate[];
  sizes: readonly SizeRate[];
}

export type PriceCellGroup = 'products' | 'stocks' | 'quantityBreaks' | 'finishing' | 'turnarounds';

export interface PriceEdit {
  group: PriceCellGroup;
  rowId: string;
  field: string;
  value: number;
}

export interface PriceEditResult {
  ok: boolean;
  message: string;
}

/* --------------------------------------------------------------- preflight */

export type CheckSeverity = 'PASS' | 'WARN' | 'FAIL';

export type PreflightCheckId =
  | 'trim-size'
  | 'bleed'
  | 'safety-margin'
  | 'fonts-embedded'
  | 'image-resolution'
  | 'colour-space'
  | 'total-area-coverage'
  | 'spot-colours'
  | 'white-overprint'
  | 'hairlines'
  | 'page-count'
  | 'pdfx4';

export interface PreflightWaiver {
  reason: string;
  by: string;
  at: string;
  kind: 'WAIVED' | 'OVERRIDDEN';
}

export interface PreflightCheck {
  id: PreflightCheckId;
  label: string;
  severity: CheckSeverity;
  measured: string;
  tolerance: string;
  finding: string;
  page: string;
  waiver: PreflightWaiver | null;
}

export interface PreflightReport {
  id: string;
  jobReference: string;
  fileName: string;
  pages: number;
  ranAt: string;
  checks: readonly PreflightCheck[];
}

/* -------------------------------------------------------------------- jobs */

export type JobState =
  | 'ESTIMATE'
  | 'ARTWORK_RECEIVED'
  | 'PREFLIGHT'
  | 'PROOFING'
  | 'APPROVED'
  | 'IMPOSED'
  | 'PLATED'
  | 'ON_PRESS'
  | 'FINISHING'
  | 'DESPATCHED'
  | 'HELD'
  | 'CANCELLED';

export type ProofState = 'NONE' | 'AWAITING_APPROVAL' | 'APPROVED' | 'REJECTED';

export type StateOwner = 'system' | 'human' | 'held' | 'final';

export interface JobStage {
  state: JobState;
  at: string | null;
  by: string | null;
  done: boolean;
  current: boolean;
}

export interface JobComment {
  id: string;
  author: string;
  role: Role;
  at: string;
  body: string;
}

export interface JobFile {
  name: string;
  kind: string;
  bytes: number;
  at: string;
}

export interface JobRecord {
  reference: string;
  customerId: string;
  description: string;
  spec: QuoteInput;
  state: JobState;
  stamps: Partial<Record<JobState, string>>;
  receivedAt: string;
  dueAt: string;
  proofState: ProofState;
  proofAt: string | null;
  preflightReportId: string | null;
  comments: readonly JobComment[];
  files: readonly JobFile[];
  note: string | null;
}

export interface Job extends JobRecord {
  customer: Customer;
  quote: QuoteResult;
  stages: readonly JobStage[];
  progress: number;
  owner: StateOwner;
}

export interface JobFilter {
  customerId?: string;
  states?: readonly JobState[];
}

/** Flattened rows handed to the table components. Built on the server. */
export interface JobRow {
  reference: string;
  description: string;
  quantity: number;
  stockLabel: string;
  state: JobState;
  stateLabel: string;
  owner: StateOwner;
  dueAt: string;
  dueDate: string;
  dueLabel: string;
  overdue: boolean;
  progress: number;
  press: PressId;
  total: number;
  href: string;
}

export interface QueueRow extends JobRow {
  customer: string;
  productLabel: string;
  sheetLabel: string;
  sheets: number;
  ageMinutes: number;
  ageLabel: string;
}

/* ----------------------------------------------------------------- presses */

export type PressState = 'MAKEREADY' | 'RUNNING' | 'WASHUP' | 'IDLE';

export interface Press {
  id: PressId;
  name: string;
  kind: 'litho' | 'digital';
  units: string;
  maxSheet: SheetId;
  maxSheetMm: string;
  notes: string;
  state: PressState;
  jobReference: string | null;
  jobDescription: string | null;
  customer: string | null;
  sheetsRun: number;
  sheetsTarget: number;
  wasteSheets: number;
  sheetsPerHour: number;
  minutesRemaining: number;
  operator: string;
  shift: string;
  queue: readonly PressQueueItem[];
}

export interface PressQueueItem {
  reference: string;
  customer: string;
  sheets: number;
  stock: string;
  dueAt: string;
}

/* -------------------------------------------------------------- imposition */

export type SignatureScheme = '4pp' | '8pp' | '16pp';
export type BindingStyle = 'saddle-stitch' | 'perfect-bound' | 'none';
export type WorkStyle = 'sheetwise' | 'work-and-turn' | 'work-and-tumble';

export interface ImpositionInput {
  sheetId: SheetId;
  sizeId: SizeId;
  scheme: SignatureScheme;
  binding: BindingStyle;
  workStyle: WorkStyle;
  gripperMm: number;
  creepMm: number;
  pageCount: number;
  quantity: number;
}

export interface ImposedPage {
  key: string;
  label: string;
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
  rotated: boolean;
}

export interface ImposedForm {
  side: 'FRONT' | 'BACK';
  plate: string;
  pages: readonly ImposedPage[];
}

export interface ImpositionPlan {
  input: ImpositionInput;
  sheetWidthMm: number;
  sheetHeightMm: number;
  trimWidthMm: number;
  trimHeightMm: number;
  gutterMm: number;
  upCount: number;
  cols: number;
  rows: number;
  rotated: boolean;
  signatures: number;
  sheetsRequired: number;
  wasteSheets: number;
  fits: boolean;
  fitNote: string;
  forms: readonly ImposedForm[];
  foldSequence: readonly string[];
}

/* ------------------------------------------------------------------ upload */

export interface StoredFile {
  name: string;
  bytes: number;
  at: string;
}
