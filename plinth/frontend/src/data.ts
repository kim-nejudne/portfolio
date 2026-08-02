export interface BlockDef {
  n: string;
  name: string;
  weeks: string;
  line1: string;
  line2: string;
  volume: number;
  intensity: number;
}

export const BLOCKS: BlockDef[] = [
  {
    n: '01',
    name: 'ACCUMULATE',
    weeks: 'WEEKS 01–04',
    line1: 'Four weeks of high volume at moderate load.',
    line2: 'Tonnage climbs week on week. The base is built here.',
    volume: 92,
    intensity: 44,
  },
  {
    n: '02',
    name: 'INTENSIFY',
    weeks: 'WEEKS 05–08',
    line1: 'Volume holds while the load rises.',
    line2: 'Sets get heavier, rest gets longer, the work narrows.',
    volume: 74,
    intensity: 63,
  },
  {
    n: '03',
    name: 'REALISE',
    weeks: 'WEEKS 09–12',
    line1: 'Volume drops away. Intensity peaks.',
    line2: 'Heavy doubles and triples at the cycle’s highest percentages.',
    volume: 46,
    intensity: 95,
  },
  {
    n: '04',
    name: 'RESTORE',
    weeks: 'WEEKS 13–16',
    line1: 'The deload, programmed rather than improvised.',
    line2: 'Load falls away so the next cycle can start heavier.',
    volume: 22,
    intensity: 18,
  },
];

export const TONNAGE_KG = [
  12500, 15200, 17800, 11800, 18200, 20500, 22800, 14600, 21200, 23600, 24100,
  16200, 23800, 22000, 17600, 12400,
];

export const INTENSITY_1RM = [
  66, 69, 72, 65, 74, 76, 78, 70, 80, 82, 84, 74, 88, 90, 85, 72,
];

export const CURVE_STATEMENTS = [
  'Volume builds the base. Tonnage peaks inside each block, then deloads.',
  'Intensity rises on one line for sixteen weeks. It does not negotiate.',
  'The two cross once. Week eleven. After that, load leads.',
];

export interface SessionRow {
  label: string;
  detail: string;
}

export interface SessionDef {
  id: string;
  day: string;
  title: string;
  rows: SessionRow[];
}

export const SESSIONS: SessionDef[] = [
  {
    id: 'day-1',
    day: 'DAY 1',
    title: 'SQUAT',
    rows: [
      { label: 'WARM-UP', detail: 'BAR × 10 · 40% × 5 · 55% × 3 · 65% × 2' },
      { label: 'BACK SQUAT', detail: '5 × 3 @ 82.5% 1RM · RPE 8 · REST 4:00' },
      { label: 'FRONT SQUAT', detail: '3 × 6 @ 65% 1RM · RPE 7 · REST 2:30' },
      { label: 'GOOD MORNING', detail: '3 × 8 · RPE 7 · REST 2:00' },
      { label: 'TOTAL', detail: '68 MIN · 9,840 KG' },
    ],
  },
  {
    id: 'day-2',
    day: 'DAY 2',
    title: 'PRESS',
    rows: [
      { label: 'WARM-UP', detail: 'BAR × 10 · 40% × 5 · 52% × 3 · 62% × 2' },
      { label: 'OVERHEAD PRESS', detail: '5 × 3 @ 80% 1RM · RPE 8 · REST 3:00' },
      { label: 'BARBELL ROW', detail: '4 × 6 @ 72.5% 1RM · RPE 8 · REST 2:30' },
      { label: 'PUSH PRESS', detail: '3 × 5 @ 67.5% 1RM · RPE 7 · REST 2:00' },
      { label: 'TOTAL', detail: '61 MIN · 7,120 KG' },
    ],
  },
  {
    id: 'day-3',
    day: 'DAY 3',
    title: 'DEADLIFT',
    rows: [
      { label: 'WARM-UP', detail: '40% × 5 · 55% × 3 · 67.5% × 2 · 75% × 1' },
      { label: 'DEADLIFT', detail: '4 × 2 @ 87.5% 1RM · RPE 9 · REST 4:00' },
      { label: 'ROMANIAN DEADLIFT', detail: '3 × 6 @ 70% 1RM · RPE 7 · REST 2:30' },
      { label: 'RACK PULL', detail: '3 × 3 @ 92.5% 1RM · RPE 8 · REST 3:00' },
      { label: 'TOTAL', detail: '74 MIN · 8,960 KG' },
    ],
  },
];

/** The free week: block 01, moderate load, high volume. */
export const WEEK_ONE: SessionDef[] = [
  {
    id: 'w1-day-1',
    day: 'DAY 1',
    title: 'SQUAT',
    rows: [
      { label: 'BACK SQUAT', detail: '5 × 8 @ 65% 1RM · RPE 6 · REST 2:30' },
      { label: 'FRONT SQUAT', detail: '3 × 8 @ 55% 1RM · RPE 6 · REST 2:00' },
      { label: 'TOTAL', detail: '58 MIN · 7,400 KG' },
    ],
  },
  {
    id: 'w1-day-2',
    day: 'DAY 2',
    title: 'PRESS',
    rows: [
      { label: 'OVERHEAD PRESS', detail: '5 × 8 @ 62% 1RM · RPE 6 · REST 2:00' },
      { label: 'BARBELL ROW', detail: '4 × 10 @ 60% 1RM · RPE 6 · REST 2:00' },
      { label: 'TOTAL', detail: '52 MIN · 5,900 KG' },
    ],
  },
  {
    id: 'w1-day-3',
    day: 'DAY 3',
    title: 'DEADLIFT',
    rows: [
      { label: 'DEADLIFT', detail: '5 × 5 @ 67.5% 1RM · RPE 7 · REST 3:00' },
      { label: 'ROMANIAN DEADLIFT', detail: '3 × 8 @ 55% 1RM · RPE 6 · REST 2:30' },
      { label: 'TOTAL', detail: '61 MIN · 8,100 KG' },
    ],
  },
];

export interface EvidenceDef {
  target: number;
  kind: 'int' | 'm' | 'plus' | 'pct';
  realText: string;
  caption: string;
}

export const EVIDENCE: EvidenceDef[] = [
  { target: 41600, kind: 'int', realText: '41,600', caption: 'MEMBERS' },
  { target: 1.9, kind: 'm', realText: '1.9M', caption: 'SESSIONS COMPLETED' },
  { target: 18, kind: 'plus', realText: '+18%', caption: 'MEDIAN EST. 1RM, ONE CYCLE' },
  { target: 71, kind: 'pct', realText: '71%', caption: 'FINISH THE CYCLE THEY START' },
];

export const MARQUEE_TEXT = 'ACCUMULATE · INTENSIFY · REALISE · RESTORE · ';
