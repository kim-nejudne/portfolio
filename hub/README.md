# The hub — `kimnejudne.dev`

The homepage. A portrait fills the hero; on scroll the cranium hinges open, the
head sinks until the eyes are at the bottom of the screen, he looks up, and the
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
  reveal. Fixed by making the bowl deep enough to have an inside, giving the
  lid a **lift** as well as a rotation so it visibly leaves the head, and
  easing the lid `out` rather than `inOut` — `power2.inOut` spent the first
  third of the scroll on a quarter of the movement, which on a 66° swing is
  invisible, and a scrubbed mechanism has to answer the hand turning it.
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

Drop the real layers into `public/head/` under the same names, as `.avif` with
a `.png` beside them. Then check `CUT_Y` / `CAVITY_RX` / `CAVITY_RY` / `EYE_CY`
in `src/head.ts` still match where the artwork actually puts them, re-tune
`LID_ANGLE` and `LID_LIFT`, and let `npm run verify` tell you whether
`HEAD_OPEN_RISE` is still right. Nothing else should need to change.

The lift is worth understanding before changing it. A strict hinge is the more
truthful mechanism and the less legible one: a cap pivoting toward the viewer
foreshortens into its own seam, and perspective magnification sweeps its
projection back down over the opening it just made. A top that rises *and*
tilts reads instantly as a lid coming off a box. Legibility won.

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
head opens. `npm run verify` asserts it, by projecting every painted colour
onto the paper-to-ink line and failing anything that misses.

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
npm run verify            # 22 assertions in a real browser
npm run beats             # photograph every beat, desktop and phone
```

`verify.mjs` drives headless Chrome over the DevTools Protocol — 22 assertions,
eight of which have been sabotaged to confirm they fail on the thing they exist
to catch. It checks what a stylesheet cannot demonstrate: that reduced motion
builds no timeline rather than a quieter one, that the work is reachable
without the performance running, that the head and showcase are invisible to
assistive technology while nothing tabbable is buried inside an `aria-hidden`
subtree, that layer promotion is released when unpinned, and the colour rule.

It also *walks* the showcase rather than spot-checking it: 29 samples across
the sequence, asserting that no more than one card is ever fully on stage and
that a card is on stage for most of it. Collapsing `CARD_STRIDE` makes it
report a peak of five.

Two checks exist because the same thing broke twice. One photographs the open
head and fails if a card overlaps it. The other compares the reduced-motion
lid transform against the animated end state — CSS and GSAP express that pose
in two different files and they had already drifted, leaving the static head
technically open and visibly shut. It compares rotation and *proportional*
lift, not raw matrices: the head is deliberately a different size in flow than
on the stage, so the pixel translations differ by design.

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
