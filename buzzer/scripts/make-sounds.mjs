// Synthesises Buzzr's sound effects into client/public/sounds/ as 16-bit mono WAV files.
// Every sound is made from plain waveforms here, so there is no third-party audio to license.
// Run: node scripts/make-sounds.mjs
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

const waves = {
  sine: (phase) => Math.sin(2 * Math.PI * phase),
  triangle: (phase) => 1 - 4 * Math.abs((phase % 1) - 0.5),
  square: (phase) => (phase % 1 < 0.5 ? 1 : -1),
  saw: (phase) => 2 * (phase % 1) - 1,
  // A few odd and even harmonics with falling weight: a soft brass-like tone.
  brass: (phase) =>
    [1, 0.6, 0.45, 0.3, 0.2, 0.12].reduce(
      (sum, weight, i) => sum + weight * Math.sin(2 * Math.PI * (i + 1) * phase),
      0,
    ) / 2.67,
};

/**
 * Adds one tone into `buffer`, starting at `start` seconds. `freq` may be a function of the time
 * into the tone, for sweeps. The envelope attacks over `attack` seconds and decays exponentially
 * with time constant `decay`, or holds and releases over the last `release` seconds when `decay`
 * is not given.
 */
function tone(
  buffer,
  { start = 0, length, freq, wave = 'sine', gain = 1, attack = 0.005, decay, release = 0.05 },
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

const sounds = {
  // Someone rang in first: two bright, fast rising notes.
  buzz: render(0.45, [
    { start: 0, length: 0.12, freq: hz('A5'), wave: 'square', gain: 0.5, decay: 0.08 },
    { start: 0.09, length: 0.36, freq: hz('E6'), wave: 'square', gain: 0.5, decay: 0.12 },
    { start: 0.09, length: 0.36, freq: hz('E5'), wave: 'sine', gain: 0.6, decay: 0.15 },
  ]),
  // Correct: a quick rising major arpeggio that rings out.
  correct: render(0.9, [
    { start: 0, length: 0.5, freq: hz('C5'), wave: 'triangle', decay: 0.18 },
    { start: 0.08, length: 0.5, freq: hz('E5'), wave: 'triangle', decay: 0.18 },
    { start: 0.16, length: 0.5, freq: hz('G5'), wave: 'triangle', decay: 0.2 },
    { start: 0.24, length: 0.66, freq: hz('C6'), wave: 'triangle', decay: 0.3 },
    { start: 0.24, length: 0.66, freq: hz('C7'), wave: 'sine', gain: 0.25, decay: 0.2 },
  ]),
  // Wrong: the low, harsh game-show buzzer (two detuned saws), in two pulses.
  wrong: render(
    0.75,
    [
      { start: 0, length: 0.3, freq: 110, wave: 'saw', release: 0.03 },
      { start: 0, length: 0.3, freq: 116.5, wave: 'saw', release: 0.03 },
      { start: 0.36, length: 0.39, freq: 110, wave: 'saw', release: 0.08 },
      { start: 0.36, length: 0.39, freq: 116.5, wave: 'saw', release: 0.08 },
    ],
    0.55,
  ),
  // Time's up: three quick high beeps, then a longer falling tone.
  timeUp: render(
    0.95,
    [
      ...[0, 0.14, 0.28].map((start) => ({
        start,
        length: 0.09,
        freq: hz('A5'),
        wave: 'square',
        gain: 0.5,
        release: 0.02,
      })),
      { start: 0.42, length: 0.5, freq: (t) => hz('E5') - 300 * t, wave: 'triangle', decay: 0.2 },
      {
        start: 0.42,
        length: 0.5,
        freq: (t) => hz('E4') - 150 * t,
        wave: 'square',
        gain: 0.25,
        decay: 0.2,
      },
    ],
    0.6,
  ),
  // A player joined: a short upward blip.
  join: render(
    0.18,
    [{ start: 0, length: 0.18, freq: (t) => 600 + 4000 * t, wave: 'sine', decay: 0.07 }],
    0.6,
  ),
  // A lobby test buzz: a soft two-note tick, quieter than the join blip, since a room may tap a lot.
  practice: render(
    0.14,
    [
      { start: 0, length: 0.06, freq: hz('E6'), wave: 'triangle', decay: 0.025 },
      { start: 0.05, length: 0.09, freq: hz('B6'), wave: 'triangle', decay: 0.03 },
    ],
    0.3,
  ),
  // Game over: a brass call that lands on a held major chord.
  fanfare: render(2.4, [
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
  ]),
};

mkdirSync(OUT, { recursive: true });
for (const [name, samples] of Object.entries(sounds)) {
  writeFileSync(`${OUT}${name}.wav`, wav(samples));
  console.log(`${name}.wav  ${(samples.length / RATE).toFixed(2)} s`);
}
