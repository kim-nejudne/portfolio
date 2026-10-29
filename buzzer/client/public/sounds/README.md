# Sounds

The Screen plays these with Howler (`client/src/lib/sounds.ts`).

| File           | Plays on                             | Source    |
| -------------- | ------------------------------------ | --------- |
| `buzz.wav`     | `fx buzz`: someone buzzed first      | Self-made |
| `correct.wav`  | `fx correct`                         | Self-made |
| `wrong.wav`    | `fx wrong`                           | Self-made |
| `timeUp.wav`   | `fx timeUp`: the answer time ran out | Self-made |
| `join.wav`     | `fx join`: a new player joined       | Self-made |
| `practice.wav` | `fx practice`: a lobby test buzz     | Self-made |
| `fanfare.wav`  | The Screen's phase turns to FINAL    | Self-made |

All seven are synthesised from plain waveforms by `scripts/make-sounds.mjs`, written for Buzzr. No third-party audio is used, so there is nothing to license or attribute. To change a sound, edit that script and run `node scripts/make-sounds.mjs`.
