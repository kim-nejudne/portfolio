const BLOCK_COPY = [
  {
    n: '01',
    name: 'ACCUMULATE',
    weeks: 'WEEKS 01–04',
    line1: 'Four weeks of high volume at moderate load.',
    line2: 'Tonnage climbs week on week. The base is built here.',
  },
  {
    n: '02',
    name: 'INTENSIFY',
    weeks: 'WEEKS 05–08',
    line1: 'Volume holds while the load rises.',
    line2: 'Sets get heavier, rest gets longer, the work narrows.',
  },
  {
    n: '03',
    name: 'REALISE',
    weeks: 'WEEKS 09–12',
    line1: 'Volume drops away. Intensity peaks.',
    line2: 'Heavy doubles and triples at the cycle’s highest percentages.',
  },
  {
    n: '04',
    name: 'RESTORE',
    weeks: 'WEEKS 13–16',
    line1: 'The deload, programmed rather than improvised.',
    line2: 'Load falls away so the next cycle can start heavier.',
  },
] as const;

/**
 * Weekly tonnage, kg. Four blocks of four, each ending in a deload.
 *
 * The scaffold's figures rose across the cycle and put their maximum in block
 * four — which contradicted every block description beside them ("volume drops
 * away", "load falls away") and the volume bars on those same panels. These
 * descend block by block, as the copy has always said they do. Range holds to
 * the program's stated 12,000–28,000 kg.
 */
export const TONNAGE_KG = [
  24000, 26000, 28000, 17000, // 01 ACCUMULATE — climbs to the cycle peak
  23000, 24000, 25000, 16500, // 02 INTENSIFY  — volume holds while load rises
  19000, 19500, 20000, 14000, // 03 REALISE    — volume drops away
  15500, 14500, 13500, 12000, // 04 RESTORE    — falls away
];

/**
 * Average intensity, % of tested 1RM. Climbs across the first three blocks and
 * deloads at the end of each, which is what a periodised block actually does —
 * the scaffold's copy claimed it "does not negotiate" while plotting a sawtooth
 * directly beside the sentence.
 *
 * Tuned so the two series cross exactly once, on the INTENSIFY/REALISE divider.
 * `CROSSOVER_X` in LoadCurve computes that point from these numbers rather than
 * trusting the tuning, so the annotation cannot drift away from the picture.
 */
export const INTENSITY_1RM = [
  67.5, 70, 72.5, 65, // 01 ACCUMULATE
  75, 77.5, 80, 70,   // 02 INTENSIFY
  78, 84, 90, 75,     // 03 REALISE — peaks at 90% in week 11
  72.5, 71, 69, 67.5, // 04 RESTORE
];

export const CURVE_STATEMENTS = [
  'Volume peaks in week three at 28,000 kg, then steps down block by block.',
  'Intensity climbs to 90% in week eleven, deloading at the end of each block.',
  'The two cross once, where REALISE begins. After that, load leads.',
];

export interface BlockDef {
  n: string;
  name: string;
  weeks: string;
  line1: string;
  line2: string;
  /** Mean weekly tonnage for the block, kg. */
  tonnage: number;
  /** Mean intensity for the block, % of tested 1RM. */
  intensity: number;
  /** Bar widths, 0–100, normalised within each series across the four blocks. */
  volumeBar: number;
  intensityBar: number;
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const weeksOf = (xs: number[], block: number) =>
  xs.slice((block - 1) * 4, block * 4);

/**
 * The panel bars used to be four hand-written percentages with no unit and no
 * source — 92/44, 74/63, 46/95, 22/18 — which meant they could say anything and
 * did: they told the correct periodisation story while the plotted tonnage told
 * the opposite one. They are now derived from the same two arrays the load
 * curve plots, and each is labelled with the real figure it represents.
 *
 * Widths are normalised within each series rather than to an absolute zero:
 * mean intensity only ranges 69–82% across the cycle, so a zero-based bar would
 * render four near-identical blocks and lose the inversion that is the point of
 * the panel. The 12% floor keeps the smallest block visible as a mark.
 */
const BLOCK_TONNAGE = [1, 2, 3, 4].map((b) => mean(weeksOf(TONNAGE_KG, b)));
const BLOCK_INTENSITY = [1, 2, 3, 4].map((b) => mean(weeksOf(INTENSITY_1RM, b)));

const bar = (value: number, series: number[]) => {
  const lo = Math.min(...series);
  const hi = Math.max(...series);
  return Math.round(12 + 88 * ((value - lo) / (hi - lo)));
};

export const BLOCKS: BlockDef[] = BLOCK_COPY.map((copy, i) => ({
  ...copy,
  tonnage: Math.round(BLOCK_TONNAGE[i]),
  intensity: Math.round(BLOCK_INTENSITY[i]),
  volumeBar: bar(BLOCK_TONNAGE[i], BLOCK_TONNAGE),
  intensityBar: bar(BLOCK_INTENSITY[i], BLOCK_INTENSITY),
}));

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
