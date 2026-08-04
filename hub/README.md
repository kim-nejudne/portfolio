# The hub — `kimnejudne.dev`

The homepage. A portrait fills the hero; on scroll the top of the head flips
open to the right, the head sinks until the eyes are at the bottom of the
screen, he looks up, and the
five projects come out of the opening **one at a time** — each held big and
still in the sky above him while he watches it, then drifting away as the next
arrives. A quiet index follows, so nothing depends on having watched.

`../hub-brief.md` is the source of truth for the art direction and the beats.
This file covers the build.

## The artwork does not exist yet, and that is the point

Everything here runs against **placeholder layers** — flat grey shapes in the
correct proportions, stacking order and registration, written to the exact
filenames the real duotone halftones will use. They are deliberately ugly. A
placeholder that looks finished is a placeholder that ships.

What this buys: the choreography, the layout, the type, the reduced-motion
policy, the keyboard path and the whole performance budget are built and tuned
*now*, so dropping the real art in is a file swap against timing that is
already correct. It also front-loads the risk — and it has already paid for
itself twice, in ways a stylesheet reading could not have caught:

- **The head did not appear to open at all.** The rotation ran from the first
  frame, but the cavity was 160 canvas units deep in a head 900 tall — a slot,
  not an opening — so even fully up it showed a sliver of sky that the
  foreshortened crown sat over. The transform was fine; it had nothing to
  reveal. The bowl is deep enough to be an inside now, and the lid eases `out`
  rather than `inOut`: `power2.inOut` spent the first third of the scroll on a
  quarter of the movement, which on a large swing is invisible, and a scrubbed
  mechanism has to answer the hand turning it.
- **The backface was silently never culled**, so the sideways-flipping lid went
  all the way round and kept showing its outside. Nothing in the computed styles
  said so. The cause was `will-change: opacity` on the hinge: that makes an
  element a grouping element, grouping forces `transform-style` back to `flat`,
  and a flattened context does no backface culling at all. My own
  layer-promotion optimisation was destroying the 3D. *Moot now* — the hinge is
  an in-plane rotation and there is no 3D left to destroy — but it is the
  clearest example this project has of a system reporting success while doing
  nothing, so it is recorded rather than deleted.
- **The cards landed on his forehead. Twice.** The layout sized the region they
  occupy to end at the *cut line*, which is not where the head ends; then, once
  the lid started lifting, the corrected figure was too small again.
  `HEAD_OPEN_RISE` is now a *checked* number rather than a reasoned one — the
  verify suite photographs the open head with the showcase hidden, trims away
  the paper to find its real topmost pixel, and fails if a card overlaps it.

```sh
npm run art      # regenerate the placeholder head layers
npm run crops    # re-grab a placeholder crop from each live spoke
```

### Replacing the placeholders

**Do not hand-edit `public/head/`.** Put cut layers in `art/` and run
`python3 scripts/compose-art.py`, which places every one through the same
transform onto the 2400x3200 artboard. Registration is the whole game and it is
a property of that script, not of nine careful exports.

```sh
python3 scripts/compose-art.py             # art/ -> public/head/, registered
python3 scripts/align-art.py a.png b.png   # recover a trimmed layer's offset
```

Export **untrimmed** — keep the document at the photo's size and turn off "trim
transparent pixels" — and a layer's offset is `(0, 0)`. If it was trimmed,
`align-art.py` recovers the offset by matching the tear two layers share, and
prints the RMS residual so you know whether to believe it.

Two traps, both of which have already fired:

- **A stale `.avif` silently beats a fresh `.png`.** `sources()` offers AVIF
  first, so writing only the PNG shows the *previous* cut with no error
  anywhere. `compose-art.py` always writes both.
- **`npm run art` used to overwrite real art with grey ellipses**, without
  saying anything. It now skips any layer `compose-art.py` owns unless you pass
  `--all`.

Then re-measure the geometry against the new cut. **`CUT_Y` / `CAVITY_RX` /
`CAVITY_RY` / `EYE_CY` exist in two places** — `src/head.ts` and
`scripts/placeholder-head.py` — and they have to move together, because the
first says where the opening *is* and the second draws it. Changing one alone
slides `SKY_CLIP` off a rim that has not moved with it, which is what put a
smear of blue sky on his forehead the first time. Then re-measure `HINGE` off
the new lid, re-tune `LID_ANGLE`, and let `npm run verify` tell you whether
`HEAD_OPEN_RISE` is still right — it prints the measurements to derive it from.

**The hinge.** The lid rotates **in the picture plane** about the bottom-right
corner of the tear: a hinge, the way a flip-top lid swings aside. No
perspective, no foreshortening, no backface, and nothing that can be flattened
by a stray `will-change`.

It is the third mechanism this piece has had, and the two it replaced both
failed for the same reason. A cap tipping **backwards** about the skull
foreshortens into its own seam, and perspective magnification sweeps its
projection straight back down over the opening it just made — so it needed a
vertical lift bolted on simply to escape itself. A **sideways** `rotateY` door
fixed that but ended flat-on to the viewer, which meant maintaining a two-plate
3D hinge and an entire extra layer to fill the backface. The in-plane hinge
reveals the opening as directly as the door does and costs one `rotate`.

The angle matters more than it looks, and it belongs to the artwork rather than
to the choreography. The cap's far corner passes through vertical at roughly a
third of the way round — the peak of the arc — and stays the tallest thing on
the artboard well past it, so a swing that stops too early parks the cap in the
sky the cards need. Re-measure it whenever the lid is re-cut: it was 150° for
the photographic cut and is 165° for the pen drawing.

## The three files that carry the design

| | |
|---|---|
| `src/choreography.ts` | Every number the timeline uses. Beat positions, the descent, the lid angle, the card arcs. Tuning happens here and nowhere else. |
| `src/head.ts` | The asset contract. Filenames, stacking order, the hinge, the opening, the eye box. No component knows a filename. |
| `src/hooks/useHubTimeline.ts` | The performance. One `matchMedia` conditional; under `reduce` it builds nothing. |

Layout lives in CSS and choreography lives in GSAP, but both need to agree
about where the eyes are. Rather than write the figures twice they are declared
once in TypeScript and handed to the stylesheet as custom properties from
`App.tsx`.

## Two rules that are load-bearing

**The one colour rule.** The hub is paper and ink. The only colour on the page
is the sky inside his head and the five project crops — both images, never
tokens. That is what keeps a statement hub from competing with five loud
spokes, and it is why the reveal lands: colour arrives at the exact moment the
head opens.

`npm run verify` projects every **CSS-painted** colour onto the paper-to-ink
line and fails anything that misses. Note the limit, because it was overstated
here until the real art arrived: it reads `getComputedStyle`, not pixels. A
full-colour photograph in a head layer passes it silently, which is exactly what
happened the day Kim's cut face and lid landed untreated. The check is worth
having — it is what caught the colophon hairline — but the duotone treatment is
enforced by nobody. Applying it is a step someone has to remember.

**Scrub the mechanism, trigger the performances.** The lid, the descent and the
cards are tied 1:1 to the scroll — the viewer is the one opening the head. The
eye-flick is not: it runs at its own speed with its own easing whatever the
wheel is doing. Scrub it too and a slow scroller watches the eyes creep upward
over four seconds, and the illusion dies.

## Reduced motion

Not a quieter variant — a different layout, and CSS owns all of it under the
same media query GSAP tests. The timeline is never built, and the showcase —
which is a performance and nothing else — never renders at all. The head
renders already open, eyes already up, sky visible, with the index beneath it.
Every word readable, nothing moves.

## Two components, one list of work

`Showcase` is the performance: five cards stacked in the same place, brought
out of the head one at a time. It renders nothing until the timeline claims the
stage, and it is `aria-hidden`, because it duplicates links that are announced
properly a screen further down.

`Index` is the navigation: five ruled rows below the pin, always in the
document, always visible, needing nothing to run.

That split is what makes the keyboard story dull, which is the goal. An earlier
version put the only copy of the work *inside* the pinned section, visible at
exactly one scroll position — so the skip link needed a scripted jump, which
needed the scrub landed synchronously first, which needed the timeline poked by
hand. Three mechanisms undoing one bad decision. The skip link is now an
ordinary `href="#work"`.

The showcase cards are still real links. A card that size in the middle of the
screen invites a click and refusing one would be a small betrayal. Outside its
own beat a card is `visibility: hidden`, so the browser enforces "only the card
on stage is live" with no bookkeeping.

## Verifying

```sh
npm run build
npm run preview           # :4501
npm run verify            # 23 assertions in a real browser
npm run beats             # photograph every beat, desktop and phone
```

`verify.mjs` drives headless Chrome over the DevTools Protocol — 23 assertions,
nine of which have been sabotaged to confirm they fail on the thing they exist
to catch. It checks what a stylesheet cannot demonstrate: that reduced motion
builds no timeline rather than a quieter one, that the work is reachable
without the performance running, that the head and showcase are invisible to
assistive technology while nothing tabbable is buried inside an `aria-hidden`
subtree, that layer promotion is released when unpinned, and the colour rule.

It also *walks* the showcase rather than spot-checking it: 29 samples across
the sequence, asserting that no more than one card is ever fully on stage and
that a card is on stage for most of it. Collapsing `CARD_STRIDE` makes it
report a peak of five.

Three checks exist because three things broke in ways nothing else could see.
One photographs the open head and fails if a card overlaps it, printing the
measurements `HEAD_OPEN_RISE` should be derived from. One compares the
reduced-motion lid pose against the animated end state — CSS and GSAP express
it in two different files and they had already drifted, leaving the static head
technically open and visibly shut. And one isolates the lid's own pixels, by
differencing a frame against the same frame with the lid hidden, and fails if
the flipped lid looks like the closed one — which is what a lost 3D context
looks like, and it is invisible in the computed styles.

**Do not verify motion through a visible browser tab that is not focused.** A
backgrounded tab throttles `requestAnimationFrame` to nothing and GSAP's ticker
rides on it, so screenshots show a timeline frozen partway through catching up.
That looks exactly like a choreography bug and is not one.

## Budget

Measured on a cold load, AVIF path. The `.png` fallbacks are ~880KB on disk and
a modern browser fetches none of them.

| | Budget | Now |
|---|---|---|
| Head layers | ≤ 600KB | 56KB *(placeholder)* |
| Card crops | ≤ 400KB | 78KB *(placeholder)* |
| Fonts | ≤ 90KB | 41KB |
| JS, gzipped | ≤ 120KB | 111KB |
| CSS + HTML, gzipped | — | 5KB |
| **First load** | **≤ 1.3MB** | **290KB** |

The JS line is the tight one: React plus GSAP plus ScrollTrigger is 111KB of a
120KB budget, so there is no room for another library. Anything new has to
replace something.

Only `transform` and `opacity` are animated. Layers are promoted when the
section pins and demoted the moment it does not, so scrolling the rest of the
page costs nothing.

## Deploy

Static, like PLINTH. Built on the workstation, `rsync`ed to `/var/www/hub`,
served by nginx. There is no backend and nothing to containerise. Not written
yet — the hub is not live.
