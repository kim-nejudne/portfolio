# The hub — `kimnejudne.dev`

The homepage. The pitch is set at the top of the page and a pen-and-ink
portrait hangs below it, low enough that his lower lip is almost touching the
bottom edge. On scroll the top of the head swings open on a hinge, the head
sinks a little further, and the five projects come out of the opening **one at
a time** — each held big and still in the sky above him, then drifting away as
the next arrives. A quiet index follows, so nothing depends on having watched.

**The whole composition hangs off one landmark.** The head is positioned by the
lower lip, not by its top edge and not by the eye line — "the lip almost
touching the bottom" is the instruction, and how much sky the pitch gets, where
the eyes land and how far the descent has left to travel all fall out of it. See
`LIP_LINE` in `src/head.ts`.

`../hub-brief.md` is the source of truth for the art direction and the beats.
This file covers the build.

## Three layers, and it was built against nine

The head is `face`, `neck` and `lid` — a pen-and-ink portrait Kim drew, cut in
two along a wavy tear, with the neck carried by the face and written blank.

It was built against **nine placeholder layers**: flat grey shapes in the
correct proportions, stacking order and registration, written to the exact
filenames the real art would use. The choreography, layout, type,
reduced-motion policy, keyboard path and performance budget were all tuned
against those, so the real art was a file swap against timing that already
worked. That bet paid repeatedly, in ways reading a stylesheet could not have
caught:

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

Then, when the drawing arrived, **six of those nine placeholders were deleted
rather than drawn** — `head-back`, `sky`, `cavity`, `eyes-forward`, `eyes-up`
and `lid-underside`. That is a design decision with teeth and it is recorded
here rather than absorbed quietly:

- The head **no longer opens onto a cavity**. The hair swings off and reveals
  his drawn scalp. There is no hole, no paper thickness, no inside.
- **There is no sky**, so the only colour left on the page is the five project
  crops. The one colour rule got stricter and the reveal it was built around —
  colour arriving at the exact moment the head opens — is gone. The first
  colour on the page is now the first card.
- **The eye-flick beat is gone.** The eyes are drawn into `face` and cannot
  change. The pause before the first card survives as a breath, but the
  argument for it — he looks up at empty sky and your gaze follows his to the
  spot the card then arrives in — went with the layers.

```sh
npm run crops    # re-grab a crop from each live spoke
```

### Replacing or re-cutting the art

**Do not hand-edit `public/head/`.** Put cut layers in `art/` and run
`python3 scripts/compose-art.py`, which places every one through the same
transform onto the artboard. Registration is the whole game and it is a
property of that script, not of careful exports.

```sh
python3 scripts/compose-art.py             # art/ -> public/head/, registered
python3 scripts/align-art.py a.png b.png   # recover a trimmed layer's offset
```

Export **untrimmed** — keep the document at the photo's size and turn off "trim
transparent pixels" — and a layer's offset is `(0, 0)`. If it was trimmed,
`align-art.py` recovers the offset by matching the tear two layers share, and
prints the RMS residual so you know whether to believe it.

One trap, which has already fired: **a stale `.avif` silently beats a fresh
`.png`.** `sources()` offers AVIF first, so writing only the PNG shows the
*previous* cut with no error anywhere. `compose-art.py` always writes both.

Then re-measure. `HINGE`, `LID_ANGLE` and `HEAD_OPEN_RISE` are constants of the
*drawing*, not of the design, and all three moved when the photograph was
replaced by the pen cut. Measure `HINGE` off the new lid — the furthest point
of its silhouette in the +x+y direction — re-tune `LID_ANGLE` by eye and by the
clearance the suite prints, and let `npm run verify` tell you whether
`HEAD_OPEN_RISE` is still right.

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

## The rule that is load-bearing

**The one colour rule.** The hub is paper and ink. The only colour on the page
is the five project crops — images, never tokens. That is what keeps a
statement hub from competing with five loud spokes.

It used to be the crops *and* the sky inside his head, and the reveal was built
on it: colour arrived at the exact moment the head opened. The sky was deleted
along with the other placeholders, so the rule is stricter and the beat is
gone.

`npm run verify` projects every **CSS-painted** colour onto the paper-to-ink
line and fails anything that misses. Note the limit, because it was overstated
here until real art arrived: it reads `getComputedStyle`, not pixels. A
full-colour image in a head layer passes it silently, which is exactly what
happened the day Kim's untreated cut face and lid landed. It is worth having —
it is what caught the colophon hairline — but nothing enforces what an image
contains. The green stripe on his shirt in the drawing is a live example: it is
colour on the page, and no check will ever mention it.

**Scrub the mechanism.** The lid, the descent and the cards are tied 1:1 to the
scroll — the viewer is the one opening the head. This used to be half a rule:
*scrub the mechanism, trigger the performances*, the performance being an
eye-flick that ran on its own easing whatever the wheel was doing. There are no
triggered performances left, so what remains is the scrub.

## Reduced motion

Not a quieter variant — a different layout, and CSS owns all of it under the
same media query GSAP tests. The timeline is never built, and the showcase —
which is a performance and nothing else — never renders at all. The head
renders already open, with the index beneath it. Every word readable, nothing
moves.

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
npm run verify            # 30 assertions in a real browser
npm run beats             # photograph every beat, desktop and phone
```

`verify.mjs` drives headless Chrome over the DevTools Protocol — 30 assertions,
fourteen of which have been sabotaged to confirm they fail on the thing they exist
to catch. It checks what a stylesheet cannot demonstrate: that reduced motion
builds no timeline rather than a quieter one, that the work is reachable
without the performance running, that the head and showcase are invisible to
assistive technology while nothing tabbable is buried inside an `aria-hidden`
subtree, that layer promotion is released when unpinned, and the colour rule.

It also *walks* the showcase rather than spot-checking it: 33 samples from the
first card's birth to the head's exit, asserting five things about the overlap
between one card and the next — never two settled at once, a card on stage for
most of the sequence, never a blank frame, the next card visibly climbing while
the current one is read, and **never a card alone on stage while another is
still to come**.

That last one is the strong form of the one above it, and it exists because the
weak form is satisfiable by a sequence that still feels wrong. "The overlap
happens somewhere" passed twice on layouts where you scrolled through most of a
hold looking at a single card on an empty page. Setting `CARD_QUEUE` to 0 is the
sabotage: the crossover count stays healthy at 12 samples and the strong check
names the eight scroll positions where a card was stranded.

What it counts changed when the cards were made to overlap, and the change is
the interesting part. It used to count cards that were merely **opaque**, a fair
proxy while each card faded in only after the previous had gone — and a check
that would have *failed* the sequence for doing exactly what it was later asked
to do. It now counts cards that are **settled**: opaque, at full size, and at
their layout position, read off the transform matrix. Two cards on screen is the
design; two cards on the same coordinate is the bug.

Sabotaging `CARD_STRIDE` in either direction proves both halves. At 16 — longer
than `CARD_RISE + CARD_HOLD` — no card ever overlaps the next and the crossover
check reports zero. At 6, shorter than `CARD_HOLD`, two cards settle on the same
spot and the peak reads two. A first attempt at 10 passed both, which is how the
constraint in `choreography.ts` got corrected: `S > CARD_HOLD` is the collision
line, `S > CARD_HOLD + CARD_LEAVE` is the comfort margin actually taken.

Three checks exist because three things broke in ways nothing else could see.
One photographs the open head and fails if a card overlaps it, printing the
measurements `HEAD_OPEN_RISE` should be derived from. One compares the
reduced-motion lid pose against the animated end state — CSS and GSAP express
it in two different files and they had already drifted, leaving the static head
technically open and visibly shut. And one isolates the lid's own pixels, by
differencing a frame against the same frame with the lid hidden, and fails if
the flipped lid looks like the closed one — which is what a lost 3D context
looks like, and it is invisible in the computed styles.

### A card's life has four movements, and the middle one is doing nothing

Emerge, queue, fly, hold, leave. The queue — the card sitting in the opening,
out of his head and plainly next, while the card above it is being read — is
what "the next card is already visible" actually required, and it was reached
by trying the obvious thing twice and failing on geometry rather than timing.

**A card is nearly as tall as the distance it climbs.** The sky is one card
deep. So a card far enough along its rise to be *seen below* the settled one is
already far enough along to be printed *over* its caption, and no easing curve
escapes that, because it is a fact about the layout. Both attempts to buy
visibility by starting the rise earlier ended in the same place: either the
newcomer was invisible or it was covering the thing you were reading.

Splitting the climb dissolves it. The emergence is three units and travels 18%
of the way, so a queued card sits *in the opening*, where there is room and
where it reads as the next idea waiting its turn rather than as a card in the
wrong place. The flight keeps the arc it always had.

### The showcase runs *through* the mechanism, and two checks came out of it

The first card used to wait for the lid to finish and the head to stop sinking.
It is born at unit 3 instead, to meet "the card is already visible when the head
is at 90 degrees". Two assertions exist because that change quietly invalidated
things that had been safely true for the whole life of the piece:

**`the first card is born at the opening, not where the opening will be`.** The
launch measurement added the *whole* descent to every card, on the reasoning
that the head had finished sinking before any card emerged. Card one is now born
before the head has sunk at all, and launched a full 108px below the tear — out
of his jaw. Cards two to five are born after the descent ends and stayed
correct, so four fifths of the sequence looked right; the wrong fifth just read
as "a bit off". The cavity marker is the only thing on the page that knows where
the opening is, so the check asks it, on the frame the card is created.

**`the first card is visible by the time the lid reaches 90 degrees`.** Kim's
constraint, kept in his terms. Deliberately *not* written as "unit 7", which is
where the arithmetic puts vertical — that figure depends on the lid's easing as
much as its duration, and `power1.out` passes 90 degrees a third of the way
through the swing rather than halfway. The check walks the scroll, reads the
rotation off the matrix, and asks what the card is doing wherever 90 actually
lands.

The clearance check had to be corrected twice in the same pass, and both were
the check being wrong rather than the page. It compared the head's topmost pixel
*anywhere in the frame* against the card's bottom, which is only meaningful when
the tallest ink is directly behind the card — true at every settled pose, false
mid-swing, when the highest ink is the hair sweeping out to the right. It
reported a 254px collision between two things hundreds of pixels apart in x. It
crops to the card's own columns now. Then it was pointed at the lowest *visible*
card, which mid-sequence is a newborn sitting **inside his head**, because that
is where cards come from. It picks the settled card and skips samples that have
none.

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
