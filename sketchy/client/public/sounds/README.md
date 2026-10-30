# Sounds

The Screen plays these with Howler (`client/src/lib/sounds.ts`). Phones play none.

| File           | Plays on                                                   | Source    |
| -------------- | ---------------------------------------------------------- | --------- |
| `join.wav`     | `fx join`: a new player joined                             | Self-made |
| `yourTurn.wav` | A new turn starts (the next drawer is choosing or drawing) | Self-made |
| `correct.wav`  | `fx correct`: someone got the word                         | Self-made |
| `tick.wav`     | Each of the last 10 seconds of DRAWING                     | Self-made |
| `timeUp.wav`   | The reveal, when the drawing time ran out                  | Self-made |
| `reveal.wav`   | The reveal sting, as the word pops in                      | Self-made |
| `fanfare.wav`  | The game reaches FINAL                                     | Self-made |

All seven are synthesised from plain waveforms by `scripts/make-sounds.mjs` (ported from Buzzr). No third-party audio is used, so there is nothing to license or attribute. To change a sound, edit that script and run `node scripts/make-sounds.mjs`.
