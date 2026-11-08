# Sounds

The Screen plays these with Howler (`client/src/lib/sounds.ts`). Phones never play sound.

| File          | Plays on                                                   | Source    |
| ------------- | ---------------------------------------------------------- | --------- |
| `flap.wav`    | A split-flap row flapping in, stopped when the row settles | Self-made |
| `chime.wav`   | The start of GUESSING                                      | Self-made |
| `tick.wav`    | Each of the last 5 s of GUESSING                           | Self-made |
| `thud.wav`    | Each pin landing at the start of the reveal                | Self-made |
| `fanfare.wav` | The 1st podium step on the finale                          | Self-made |

All five are synthesised from plain waveforms by `scripts/make-sounds.mjs` (adapted from Buzzr's), as mono 16-bit WAV at 22,050 Hz, about 250 KB together. No third-party audio is used, so there is nothing to license or attribute. To change a sound, edit that script and run `node scripts/make-sounds.mjs`.
