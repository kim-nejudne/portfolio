// Synthesises Pinpoint's Screen sounds into client/public/sounds/ as 16-bit mono WAV files.
// Adapted from Buzzr's script: every sound is made from plain waveforms here, so there is no
// third-party audio to license. Run: node scripts/make-sounds.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const RATE = 22050;
const OUT = fileURLToPath(new URL('../client/public/sounds/', import.meta.url));

/** Frequency of a note name such as 'C5' or 'F#4'. */
function hz(note) {
  const [, letter, sharp, octave] = /^([A-G])(#?)(\d)$/.exec(note);
  const semitone = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 }[letter] + (sharp ? 1 : 0);
  return 440 * 2 ** (Number(octave) - 4 + semitone / 12);
}

// Seeded, so every run writes the same bytes.
let seed = 0x9e3779b9;
function random() {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

const waves = {
  sine: (phase) => Math.sin(2 * Math.PI * phase),
  triangle: (phase) => 1 - 4 * Math.abs((phase % 1) - 0.5),
  noise: () => 2 * random() - 1,
  // A few harmonics with falling weight: a soft brass-like tone.
  brass: (phase) =>
    [1, 0.6, 0.45, 0.3, 0.2, 0.12].reduce(
      (sum, weight, i) => sum + weight * Math.sin(2 * Math.PI * (i + 1) * phase),
      0,
    ) / 2.67,
};

/**
 * Adds one tone into `buffer`, starting at `start` seconds. `freq` may be a function of the time
 * into the tone, for sweeps. The envelope attacks over `attack` seconds and decays exponentially
 * with time constant `decay`, or holds and releases over the last `release` seconds.
 */
function tone(
  buffer,
  { start = 0, length, freq = 0, wave = 'sine', gain = 1, attack = 0.005, decay, release = 0.05 },
) {
  const first = Math.round(start * RATE);
  const count = Math.round(length * RATE);
  const shape = waves[wave];
  const pitch = typeof freq === 'function' ? freq : () => freq;
  let phase = 0;
  for (let i = 0; i < count && first + i < buffer.length; i++) {
    const t = i / RATE;
    phase += pitch(t) / RATE;
    let env = Math.min(1, t / attack);
    if (decay) env *= Math.exp(-t / decay);
    else env *= Math.min(1, (length - t) / release);
    buffer[first + i] += gain * env * shape(phase);
  }
}

/** Renders `parts` into a buffer `length` seconds long, normalised to `peak`. */
function render(length, parts, peak = 0.8) {
  const buffer = new Float32Array(Math.round(length * RATE));
  for (const part of parts) tone(buffer, part);
  const max = buffer.reduce((m, v) => Math.max(m, Math.abs(v)), 0) || 1;
  // A 5 ms fade at each end, so no file starts or stops with a click.
  const fade = Math.round(0.005 * RATE);
  return buffer.map(
    (v, i) => (v / max) * peak * Math.min(1, i / fade, (buffer.length - 1 - i) / fade),
  );
}

function wav(samples) {
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((v, i) =>
    data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v)) * 32767), i * 2),
  );
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVEfmt ', 8);
  header.writeUInt32LE(16, 16); // fmt chunk size
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(RATE, 24);
  header.writeUInt32LE(RATE * 2, 28); // byte rate
  header.writeUInt16LE(2, 32); // block align
  header.writeUInt16LE(16, 34); // bits per sample
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

/** One flap falling: a short noise click over a hollow knock. */
const flapClick = (start, gain) => [
  { start, length: 0.03, wave: 'noise', gain: 0.5 * gain, attack: 0.001, decay: 0.004 },
  {
    start,
    length: 0.04,
    freq: 900 + 500 * random(),
    wave: 'triangle',
    gain,
    attack: 0.001,
    decay: 0.008,
  },
];

const sounds = {
  // Split-flap clatter: about 1.6 s of uneven clicks, the longest a row takes to settle. The
  // Screen stops it early for a shorter row.
  flap: render(
    1.6,
    Array.from({ length: 90 }, (_, i) =>
      flapClick(i * 0.0175 + 0.01 * random(), 0.6 + 0.4 * random()),
    ).flat(),
    0.45,
  ),
  // The start of GUESSING: a two-tone station chime, high then low.
  chime: render(
    1.4,
    [
      { start: 0, length: 0.8, freq: hz('E5'), wave: 'triangle', decay: 0.35 },
      { start: 0, length: 0.8, freq: hz('E6'), wave: 'sine', gain: 0.15, decay: 0.2 },
      { start: 0.4, length: 1.0, freq: hz('C5'), wave: 'triangle', decay: 0.45 },
      { start: 0.4, length: 1.0, freq: hz('C6'), wave: 'sine', gain: 0.15, decay: 0.25 },
    ],
    0.6,
  ),
  // Each of the last 5 s: a short, soft woodblock tick.
  tick: render(
    0.08,
    [
      { start: 0, length: 0.08, freq: 1600, wave: 'sine', attack: 0.001, decay: 0.015 },
      { start: 0, length: 0.02, wave: 'noise', gain: 0.15, attack: 0.001, decay: 0.003 },
    ],
    0.45,
  ),
  // A pin landing: a low, falling thump.
  thud: render(
    0.3,
    [
      {
        start: 0,
        length: 0.3,
        freq: (t) => 140 - 250 * t,
        wave: 'sine',
        attack: 0.002,
        decay: 0.07,
      },
      { start: 0, length: 0.03, wave: 'noise', gain: 0.1, attack: 0.001, decay: 0.006 },
    ],
    0.7,
  ),
  // The 1st podium step: a brass call that lands on a held major chord.
  fanfare: render(
    2.4,
    [
      { start: 0, length: 0.14, freq: hz('G4'), wave: 'brass', release: 0.03 },
      { start: 0.16, length: 0.14, freq: hz('G4'), wave: 'brass', release: 0.03 },
      { start: 0.32, length: 0.14, freq: hz('G4'), wave: 'brass', release: 0.03 },
      { start: 0.48, length: 0.45, freq: hz('C5'), wave: 'brass', release: 0.05 },
      { start: 0.96, length: 0.2, freq: hz('E5'), wave: 'brass', release: 0.04 },
      { start: 1.18, length: 0.2, freq: hz('D5'), wave: 'brass', release: 0.04 },
      ...['C5', 'E5', 'G5', 'C6'].map((note) => ({
        start: 1.4,
        length: 1.0,
        freq: hz(note),
        wave: 'brass',
        gain: 0.7,
        attack: 0.02,
        release: 0.5,
      })),
    ],
    0.7,
  ),
};

mkdirSync(OUT, { recursive: true });
let total = 0;
for (const [name, samples] of Object.entries(sounds)) {
  const bytes = wav(samples);
  total += bytes.length;
  writeFileSync(`${OUT}${name}.wav`, bytes);
  console.log(
    `${name}.wav  ${(samples.length / RATE).toFixed(2)} s  ${(bytes.length / 1024).toFixed(1)} KB`,
  );
}
console.log(`total  ${(total / 1024).toFixed(1)} KB`);
