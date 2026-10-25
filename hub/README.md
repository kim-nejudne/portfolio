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

`hub-brief.md`, in the private planning repository, is the source of truth for
the art direction and the beats. This file covers the build.

## Four layers, and it was built against nine

The head is `sky`, `face`, `neck` and `lid` — a pen-and-ink portrait Kim drew,
cut in two along a wavy tear, with the neck carried by the face and written
blank, and a colour field behind the cut.

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

- The head **still has no modelled cavity** — no drawn rim, no inside wall. It
  opens onto colour rather than onto a bowl, which reads as a hole cut in paper
  and suits a page made of paper better than the thickness would have.
- ~~**There is no sky.**~~ **It came back**, and it cost one drawing rather than
  the four it looked like — see below. The reveal the one colour rule was
  written for is on the page again: colour arrives as the head opens.
- **The eye-flick beat is gone.** The eyes are drawn into `face` and cannot
  change. The pause before the first card survives as a breath, but the
  argument for it — he looks up at empty sky and your gaze follows his to the
  spot the card then arrives in — went with the layers.

```sh
npm run crops    # re-shoot the spokes still on stand-in crops
```

### The card crops

`public/crops/` holds one 900×600 image per spoke, and `src/spokes.ts`
builds their paths from the spoke `id` — the filenames and the 3:2 ratio are the
whole contract. They come from two different places and that distinction is
load-bearing:

- **`poketrack` is a chosen capture.** Taken at 2× from a real browser; the
  source is kept in `art/crops/` so the crop is reproducible from the repo. Its
  stand-in was a stale build with the wrong CTA copy.
- **A stand-in is a headless screenshot**, and the brief is clear that a
  screenshot is not the decision: the real crop is chosen for silhouette and
  colour, not legibility. `ts-dojo` is one, shot when it joined on
  2026-10-25.

`npm run crops` defaults to the stand-ins, so it cannot quietly overwrite a
chosen crop. Naming one opts in and clobbers it. To re-derive a chosen crop from its
source instead — which is nearly always what you want:

```sh
magick art/crops/poketrack.png -gravity north -crop 2880x1920+0+0 +repage \
  -resize 900x600 public/crops/poketrack.png
avifenc -q 62 --speed 4 public/crops/poketrack.png public/crops/poketrack.avif
```

The capture is 2880×2048 — 1440×1024 at DPR 2, which is 1.40 rather than 3:2,
so 64 CSS px comes off the bottom.

**Write both formats.** The same stale-`.avif` trap described below for the head
applies here — `sources()` offers AVIF first, so a fresh PNG beside a stale AVIF
ships the stale image and looks like nothing happened.

Nothing in `verify.mjs` checks these files. A 404 or a wrong aspect ratio would
pass, because `object-fit: cover` plus `aspect-ratio: 3 / 2` absorbs both.

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

Then re-measure. `HINGE`, `CUT_Y` and `HEAD_OPEN_RISE` are constants of the
*drawing*, not of the design, and every one of them has moved twice — once when
the photograph was replaced by the pen cut, and again when the pen cut was
re-torn lower. Measure `HINGE` off the new lid — the furthest point of its
silhouette in the +x+y direction — set `CUT_Y` to where the tear crosses the
middle of the canvas, re-tune `LID_ANGLE` by eye and by the clearance the suite
prints, and let `npm run verify` tell you whether `HEAD_OPEN_RISE` is still
right.

**The second cut is a worked example, and the cheapest thing about it was the
alignment.** `head_bottom.png` and `head_top.png` are the same master drawing
torn at the brow instead of the mid-forehead. Because it is the same master, the
new lid could be correlated against the old one directly rather than aligned by
its edge: it matches at `(-12, 0)` in the old lid's coordinates with a mean
absolute difference of **0.0** across 149,307 pixels — identical pixels, not a
good fit. Carried through the old registration that gives `LID_OFFSET =
(376, -467)`, which is exactly what `align-art.py` reports from the tear alone.
Two independent methods, one answer, and the tool's habitual `SUSPECT` flag
(~30px RMS, from wispy pen strokes trailing past the tear) shown up for what it
is. **Crown to chin is 856 source pixels in both cuts**, so the scale never
changed and the drawing lands on the artboard exactly where it did — which is
why `LIP_LINE`, `HEAD_FRACTION` and `HEAD_CENTRE_X` did not have to move.

What did move, and what it cost:

| | first cut | second cut |
|---|---|---|
| `CUT_Y` | 560 | 692 — the tear is at the brow, so the whole cranium hinges away |
| `HINGE` | 82.889%, 30.833% | 82.222%, 42.833% |
| `HEAD_OPEN_RISE` | 0.52 | 0.427, and now bounded by the **sky** rather than the swung lid, at 0.387 |
| head paints in front of cards | proven by natural overlap | overlap manufactured — see below |

`LID_OFFSET` carries a nudge on x on top of the measured value — Kim's, by eye,
after looking at the composed page. It is written as a sum so the measurement
and the nudge stay legible as two different kinds of number.

**It was asked for in screen pixels and it is stored in source pixels, and the
two are not close.** The chain is source → artboard (×1.577) → canvas units
(÷1.5) → CSS (× the head element's height over 1600), which at the desktop
reference — a 900px-tall viewport, artboard 928px — comes to **0.610 CSS px per
source pixel**. So "move it 2px right" is `+3.28` here, and taking the 2 at face
value moved it 1.22 CSS px, a little over half of what was asked for. The
composer writes the conversion out rather than the answer. It is exact only at
that viewport height, because the head is sized in `vh` — which is fine for a
nudge judged by eye, and the reason the reference is recorded next to it.

Two consequences worth knowing before the third cut. The sky got bigger for
free, because `compose-art.py` derived the dome's rise from the height of the
lid — though that has since been given up, see below. And the
cards stopped touching the drawing at all — the opening is now larger than a
card, so a sweep of the whole pin finds 86 contended pixels at one frame and
zero everywhere else. That broke the check that the head paints in front of the
cards, which had depended on the art happening to overlap. It now pushes a card
onto the drawing for the length of one measurement, so it rests on the
stylesheet alone and will survive the next re-cut.

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

## The case studies — `/work/<spoke>/`

One reading page per spoke, generated by `scripts/case-studies.mjs` from
each spoke's own `CASE-STUDY.md`. They are what the index's second link points
at, and they are the pages a recruiter reads if the homepage works.

**The build reads sibling directories.** Each spoke's directory, named by its
`id` in `src/spokes.ts`, must sit beside `hub/`, because the case studies live
there. A missing file fails the build with the path it wanted — never a silent
publish of fewer pages than there are spokes. Wired to `prebuild` and
`predev`, so nothing depends on remembering; `npm run cases` runs it alone.

Those five were separate repositories until the six were merged into one, and
that read genuinely crossed a boundary this build had no way to fetch across.
The path resolution did not change by a character, because what it rests on was
never "hub is a repository root" but "hub/ sits beside the five" — which is the
reason the monorepo puts all six at the top level rather than under `apps/`.

They are hosted here rather than on each spoke's own subdomain, and that is the
argument rather than the convenience. `positioning-brief.md` locates coherence
in "the curator's hand" — one craft bar, one voice in the writing. Five case
studies in five art directions would be five more spokes; five in one
paper-and-ink frame is a curator with five subjects. It is also one
implementation instead of five across four build systems, and it needs no nginx
change at all: `try_files $uri $uri/` already resolves `/work/poketrack/`.

Each page is HTML and one stylesheet. No React, no GSAP, no head art — **79KB
to 86KB on a cold load** against the homepage's 290KB, and `verify.mjs` asserts
it per page rather than trusting it.

Nearly all of that is type: the three faces are 70KB of it, and the document
itself is 2KB to 13KB gzipped. Anyone arriving from the homepage already has two
of the three cached, so the marginal cost of a case study is the italic and the
prose.

Three things worth knowing before editing them:

- **`src/tokens.css` is shared** by `index.css` and `case-study.css`, so each
  face is emitted once and downloaded once across all six pages. A stylesheet
  that declares its own `@font-face` instead would emit the same bytes under a
  second hash and look identical. There is an assertion for it.
- **`scripts/case-study/policy.mjs` is the disclosure rule**, imported by both
  the generator and `verify.mjs`. Every case study has to state plainly that its
  spoke began as a generated scaffold; the build refuses to render one that does
  not, and the deploy refuses to ship one. The retired PLINTH's heading was
  *"Where this page came from, plainly"* where the others said *"Where this
  started"* — the rule is a pattern plus a substance test on the prose beneath
  it, not a string match, and a string match would have failed the spoke whose
  disclosure was the longest.
- **The measure is 44rem because it was counted.** 36rem held 52 characters, not
  the 65–75 the usual advice assumes, because Bodoni Moda averages 0.58em per
  character rather than 0.5em. If the size or the face changes, count again —
  nothing derives it.

### No focus style on this site had ever been tested

Adding a skip-link assertion for the case studies turned up something older than
the case studies. **A headless tab reports `document.hasFocus() === false`, and
CSS `:focus` does not match in an unfocused document.** So `.focus()` moved
`document.activeElement`, painted nothing, and any assertion written the obvious
way failed against correct CSS — the kind of failure that gets "fixed" by
weakening the check.

`verify.mjs` now calls `Emulation.setFocusEmulationEnabled` immediately after
`Runtime.enable`. The older assertion above it — that the skip link's *target*
exists and is visible — never exercised `:focus` at all, so on the homepage the
reveal itself had gone unverified from the beginning. It is covered on the five
reading pages now; the homepage's own reveal still is not.

The same blind spot applies to anything in a browser here that reads a focus
state, including a manual pass: `:focus` will not match while the Chrome window
is in the background, so a skip link checked by clicking around a page in an
unfocused window looks broken whether it is or not.

There is a second, worse form of the same trap, found while checking the CV
button's focus style by hand. An unfocused *or unrendered* window does not
advance CSS transitions either — so `getComputedStyle` keeps returning the
pre-focus colour indefinitely, and the button reports as having no focus style
while `:hover` and `:focus-visible` both match. The rule was correct the whole
time. Nothing about that reads as an environment problem; it reads as a cascade
bug, and the obvious "fix" is to weaken or delete a working rule. The assertion
that settles it lives in `verify.mjs`, waits out the transition, and runs in a
headless tab where focus emulation is on.

## The CV — `/cv.pdf`

Two buttons, one component (`src/components/CvButton.tsx`), one source of truth
(`src/cv.ts`): at the top inside `Pitch`, and at the bottom inside `Colophon`.
`positioning-brief.md` had "no CV or résumé anywhere" under open items, and a
page whose only takeaway was an email address is what that gap looked like.

The top copy is inside `[data-pitch]` on purpose, so the timeline's existing
`autoAlpha` fade carries it away with the rest of the rest-state — the sky it
occupies is where the first card climbs. `autoAlpha` rather than `opacity` is
load-bearing: it writes `visibility: hidden`, which takes the anchor out of the
tab order. Swapping it for `opacity` would look identical at every scroll
position and leave an invisible, focusable, clickable button sitting over the
performance. There is an assertion for that, and it has been sabotaged.

**The file is currently a placeholder.** `deploy/deploy.sh` refuses to run while
`cv/PLACEHOLDER` exists — see `cv/README.md` for the swap. The sentinel is a
sidecar file rather than a string inside the PDF because chromium writes page
text into a compressed stream, so a `grep` for a marker would never match and
the guard would pass in silence.

`verify.mjs` checks the *shape* of the file — 200, `application/pdf`, and the
`%PDF-` magic bytes — so the suite keeps working across that swap. The status is
not the assertion: `vite preview` answers a missing `/cv.pdf` with `index.html`
at **200**, which is the same trap the crops and the case-study links fell into.

`/cv.pdf` is deliberately **not** in `sitemap.xml`: `verify.mjs` enforces set
equality on that file in both directions, so an extra entry fails as "unknown".

## Verifying

```sh
npm run build
npm run preview           # :4501
npm run verify            # 112 assertions in a real browser, over all six pages
npm run beats             # photograph every beat, desktop and phone
```

`verify.mjs` drives headless Chrome over the DevTools Protocol — 112 assertions
across six pages, thirty-six of which have been sabotaged to confirm they fail
on the thing they exist to catch. One of those was on the list and did not
deserve to be: deleting `pointer-events: none` from `.head` left the click check
passing, because the card it probes had drifted out from under the head's
element box. It is on the list honestly now. It checks what a stylesheet cannot demonstrate: that reduced motion
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

### The check that stopped having evidence

The head paints in front of the cards, and that had been proven by finding
whichever queue frame had the most natural overlap between a card and the
drawing. The second cut moved the tear to the brow, the opening became bigger
than a card, and the cards now sit entirely inside it: **a sweep of the whole
pin at 2% steps finds 86 contended pixels at one frame and zero at every other
one.** The stacking order stopped being observable and the check went from
proving something to reporting "nothing to judge" — which is a failure, and it
reported one.

No amount of hunting would have fixed that, because the evidence is genuinely
gone. So the check now *pushes a settled card onto the drawing* — far enough
that a third of its height is past the topmost ink in its own columns, measured
rather than assumed — takes its four frames, and undoes the push. It is a
stronger test than the one it replaces: the claim was always about the
stylesheet, and it now depends on the stylesheet alone rather than on the
artwork happening to produce an overlap. It survives the next re-cut for free.
`translate` and not `transform`, because GSAP owns the transform matrix.

The same push repaired a check that had quietly stopped guarding anything.
`pointer-events: none` on `.head` is what stops a mostly-transparent
screen-sized artboard from eating clicks on the links underneath it — but the
settled card now sits *above* the top edge of the head's element box, so its
centre was not under the head at all. Deleting `pointer-events: none` outright
left the hit test passing. Asked while the card is pushed, it fails. Two smaller
traps inside that one probe, both of which produced a false failure first: the
push lands the card on top of the card queued in the opening, a sibling at the
same z-index, so every other card is hidden for the hit test — and restoring
those cards with `style.visibility = ''` un-hides the ones GSAP's `autoAlpha`
had legitimately hidden, so the exact prior inline value goes back instead.

### The sky came back, and it cost one drawing

The brief lists it among six deletions and treats restoring it as a real
project. It was one layer, because of a fact nobody had checked: **`face.png` is
completely transparent above the tear.** Its ink starts exactly where the cut
does, so the head already opened onto nothing and a colour field behind it needs
no drawn cavity and no back of skull. The tear is its rim.

The other five stay gone on the mechanism rather than the budget. `head-back`
and `lid-underside` existed to be seen when the lid tipped away from the viewer,
and an in-plane hinge never turns. `cavity` was the drawn rim. The eyes are in
the face.

Three things make it work, and each is asserted:

- **It fades in across the swing** rather than being uncovered by it. The lid is
  hair — 57% coverage inside its own box — so a solid field behind it speckles
  through the strands at rest and the reveal is spent before the first scroll.
  `SKY_REVEAL` in `choreography.ts`.
- **Its bottom edge is the face's own alpha.** `compose-art.py` clips it, so the
  sky stops at the tear however far past it the drawing paints. Overlap is free;
  a gap is a visible seam. That clip is asserted **in the composer**, not the
  browser, because it is the one property a screenshot cannot see: what is
  hidden underneath his face leaves no trace in a frame.
- **The head is two elements.** A card comes *out of* the sky and goes *behind*
  his face — opposite sides of the same card — so the two halves cannot share a
  stacking context. `.head-plate` carries the geometry and deliberately creates
  no context of its own; `.head-sky` and `.head` sit either side of `CARD_Z` and
  are driven by the same tween.

**The shape is not worth drawing, so it isn't.** It is a **circle** whose
diameter is the head's own width at the tear, centred on the tear so the upper
half is the dome and the lower half runs under the face to be clipped away by
it. Both numbers are already in the cuts. The dome is derived and only the
*fill* comes from outside, which is why there are three intake paths:

```sh
art/sky-fill.png   # any rectangle of colour. Cover-fitted through the dome.
art/sky_cut.png    # a cut layer with its own alpha, placed like the lid.
# neither          # a flat placeholder in the dome.
```

It was an **ellipse** until Kim asked for a circle, and the swap gives up
something worth naming rather than losing quietly. The ellipse took its height
from the lid, so the cap rose exactly as far as the piece that swung away: the
sky filled precisely the volume the lid vacated, and **the open head was exactly
as tall as the closed head**, with `HEAD_OPEN_RISE` equal to the closed head's
own rise. A circle's rise is half the head's width and has nothing to do with
the lid, so that coincidence is gone — against this cut the lid is 737px tall
and half the head is 507, and `HEAD_OPEN_RISE` came down from 0.544 to 0.448 to
match. What it buys is independence: the sky no longer changes when the hair is
re-cut, and the shape reads as a hole punched in paper rather than an egg.

**The dome was off-centre for three commits and nothing noticed.** Its width came
from a fixed 60-row band below the topmost face pixel, which reads as a fair
proxy for "the head's width at the tear" and is not one, because the tear is a
*wave*. Its high point is at x 849 and its left end sits 86 canvas units lower,
so a band 40 canvas units deep never reached the left half of the cut. It
measured x 360–1037 of a tear that actually spans 210–1020, and centred the
circle **83 units right of the opening** — with the left end of his brow opening
onto bare paper.

It survived a re-cut, an ellipse-to-circle change and 35 passing browser
assertions, because the failure renders as *paper* on a page that is already
paper: a slightly smaller dome that looks entirely deliberate. So the fix is two
parts. `tear_edge` separates the tear from the shoulders by walking out from its
high point while the edge stays continuous — neighbouring columns of a hand-drawn
tear differ by a pixel or two, the drop into the shoulders is several hundred,
and any threshold between those scales works. Then the radius is derived rather
than guessed: **the smallest circle centred on the tear that contains the whole
tear**.

That derived answer is the *baseline*, not the shipped shape. `SKY_RADIUS_SCALE`
and `SKY_CENTRE_NUDGE_X` scale and shift it, and both are Kim's by eye — the dome
currently ships at **0.7× and 70 canvas units right**, so it covers 72% of the
tear and paper shows inside his head at both ends of the cut. Which is a
legitimate thing to want: a window of sky rather than the whole inside of a
skull. It is also, pixel for pixel, the defect above. So the composer holds two
different lines:

- **Coverage is reported, and enforced only when nobody asked otherwise.** Every
  run prints what fraction of the tear has sky above it. With the dome left at
  its derived size a shortfall is an accident and the build exits; once the shape
  has been deliberately shrunk or shifted, partial coverage is the request. A
  full-size circle 4% short still names its 23 bare columns; restoring the old
  60-row band names 264.
- **Leaving the head is an error with no opt-out.** There is no version of this
  design where a crescent of colour beside his ear is wanted, and the piece has
  shipped that once already. Nudging the circle 200 units right instead of 70
  reports 37,273 stray pixels and refuses to write.

The two knobs are **in direct tension, because a skull is not a circle.** Moving
the dome right runs it into the right side of his cranium, which slopes in above
the tear, so every step right costs size. Measured against this cut:

| `SKY_RADIUS_SCALE` | 0.60 | 0.70 | 0.80 | 0.90 |
|---|---|---|---|---|
| **max `SKY_CENTRE_NUDGE_X`** | 115 | 70 | 30 | 0 |

At the shipped 0.70 the rightward headroom is spent exactly: 70 passes, 75 does
not. Further right has to be paid for with a smaller circle.

`sky-fill.png` is the one to reach for. No transparency, no alignment, no size
to hit — and it is the shape of asset an image model can actually produce,
where a precisely-cut silhouette on a real alpha channel is not.

Getting the derived dome right still took two goes: sized to the lid's
*bounding box* first, which is far wider than his skull because the hair sweeps
out to one side, and it rendered as a blue disc behind him instead of a hole in
his head. Even a stand-in has to be measured off the drawing.

### The head is in front of the cards

That one line is what makes the tear an *opening* rather than a line the cards
happen to start on. A card leaving it passes behind his scalp and is cut by the
drawing, so a queued card reads as something rising out of his head instead of a
rectangle parked on his forehead. The cards were on top for most of this build
and it was wrong the whole time — it only became visible once one of them sat
still long enough to be looked at.

Three things had to move with it, and each is a bug someone would otherwise
reintroduce:

- **`pointer-events: none` on `.head`.** The head's element is the whole
  1200×1600 artboard and most of that box is transparent. Raising it above the
  cards hands it a screen-sized invisible shield that paints nothing and
  swallows every click. Removing this line changes not one pixel and breaks
  every link.
- **The pitch and the scroll cue moved above both.** They are page furniture,
  not part of the picture, and at rest the head fills the bottom of the screen —
  exactly where the cue lives. Without it the first instruction a visitor gets
  is printed behind his chin.
- **The head can now hide a card**, so "in front" and "still visible" are two
  assertions, not one. Either alone is satisfiable by a broken page.

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

### The card is sized from the sky, and for a long time it was not sized at all

It was `min(30rem, 46vw)`, and the `46vw` never once bound. Past about 1044px
wide the rem always won, so the card was **480px on a 1280 laptop and 480px on a
4K monitor** — the thumbnail marooned in the middle of a wide screen that the
comment beside it claimed to be avoiding, produced by the rule itself. On the
monitor it was measured on there were 385px of unused sky above the head.

It is `min(max(46vw, 23rem), calc((var(--sky-h) - 1rem - 9.5rem) * 1.5))` now,
and the middle term is the interesting one: **the reservation's own height,
solved backwards.** A card is a 3:2 crop with a caption under it, so its height
is `(w - mount) * 2/3 + caption`; setting that equal to `--sky-h` less the
stack's padding and solving for `w` is where the `* 1.5` comes from. `--sky-h`
is the same custom property `.showcase` sizes itself with rather than a copy of
it, so `HEAD_OPEN_RISE` or `HEAD_HEIGHT_VH` moving takes the card along.

Everything else about the card descends from that one number — the crop takes it
as a width, the caption takes it as a type scale, the mount as a padding — so a
bigger card cannot arrive still wearing the type it had when it was small.

**A flat `62vh` was tried first, and the mistake is worth keeping.** It fits a
1440x900 window with 48px to spare and misses a 1280x720 one by 15px, because
the caption is a *fixed* number of pixels that no viewport unit knows about.
Nothing looks broken when it happens: grid clamps an item taller than its cell to
the start edge rather than centring it, so the card silently stops being centred
in the sky and starts hanging from the top of it, and the head-clearance check
below reads a comfortable pass because a card growing downward off the padding is
still nowhere near his forehead. The subtraction is what makes one rule correct
at both ends.

**`the card on stage fits the sky reserved for it`** is the check that says so —
both edges of the settled card inside `.showcase`, at all five holds. It earned
its place before the change it was written for: pointed at the *old* fixed
`30rem` card in a 1366x620 window, it fails by 62px. That card had been
overflowing the sky on short screens the whole time, and the only visible symptom
was that it sat slightly high.

The obvious version of the check was wrong, and the sabotage is what caught it.
It asked whether the card's top had risen above the stage — and the answer is
that it never can, for the same clamping reason. It passed on a card more than
100px too tall. A check that cannot fail is decoration, so it asks about the
reservation instead, where the consequence actually lives.

One unrelated probe had to be made scale-independent by the same change. `the
cards are in front of the sky` insets a fixed 26px from every edge of the queued
card's crop; the queued card is a fraction of the settled one, so on a short
window that crop is ~64px tall and the inset leaves nothing to measure. It
reported "no queued card image to test against" on a page where the stacking was
exactly right — a measurement failing because the ruler stopped fitting. The
inset is a fifth of the image now.

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

### Asking which layer won, in pixels

Proving the head is in front took three attempts, and the failures are worth
more than the answer. A `z-index` is trivially readable from the computed styles
and says almost nothing — stacking contexts, transforms and `will-change` all
change what it means, and this project has already shipped one bug where a
`will-change` silently altered what a rendering property did. So the check works
from photographs.

1. **A horizon.** Take the head's topmost row in the card's columns, call
   everything below it "head". His tear is a hand-drawn wave running 300 canvas
   units side to side, so most of that band is bare paper the card may perfectly
   well paint on. It failed a correct page.
2. **A silhouette, measuring how much ink changed.** Correct region, wrong
   question: putting the head back behind the cards moved the number from 0.00%
   to 0.25%, under the threshold, *passing the exact regression it existed to
   catch*. A card's body and his paper are both pale, so an occlusion that is
   glaring to the eye is nearly invisible as a difference in ink.
3. **Four frames — both, head alone, cards alone, neither.** Intersect the two
   silhouettes to get the pixels they genuinely contend for, then ask which
   candidate the real frame agrees with. Where they contend the composite
   matches one almost exactly and the other hardly at all, and which is which
   *is* the stacking order. Off-head 0.0015 against off-card 0.3276 with the
   head in front; the two swap under sabotage. No threshold to guess.

The frame it judges used to be **found, not chosen** — the probe walked the
queue window and kept the frame with the most contended pixels, because a
hand-picked scroll position had drifted three times in one afternoon of
re-timing and fails silently when it does.

**Then the second cut removed the contention entirely** and finding the best of
several nothings is still nothing. So the overlap is manufactured now: a settled
card is pushed onto the drawing, far enough that a third of its height clears
the topmost ink in its own columns, and put back afterwards. There is no frame
to pick and nothing to drift. It is the stronger version of the check — the
claim was always about the stylesheet — and the push is what makes the
`pointer-events` hit test real as well. See *The check that stopped having
evidence* above.

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
| Card crops | ≤ 400KB | 83KB *(three still placeholders)* |
| Fonts | ≤ 90KB | 70KB *(three faces)* |
| JS, gzipped | ≤ 120KB | 111KB |
| CSS + HTML, gzipped | — | 5KB |
| **First load** | **≤ 1.3MB** | **290KB** |

The JS line is the tight one: React plus GSAP plus ScrollTrigger is 111KB of a
120KB budget, so there is no room for another library. Anything new has to
replace something.

The fonts line moved when the case studies landed: a real Bodoni italic is 30KB
and the reading pages use emphasis constantly, where a synthesised oblique on a
Didone is a smear rather than a near miss. The homepage does not pay for it — an
`@font-face` nobody matches triggers no request — and neither does the JS
budget, which is a *runtime* budget. `markdown-it` is a devDependency that runs
once at build time and ships nothing.

Each case-study page is 79KB to 86KB on a cold load, asserted per page — of
which 70KB is the three faces.

That number was briefly recorded as "8KB to 33KB", which was the **cache**
being measured rather than the page: the verify profile at
`/tmp/hub-verify-profile` persists between runs, so `transferSize` collapsed to
near zero on a second visit. It showed up in a deploy log as a page weighing
1KB. `verify.mjs` disables the cache now, so every navigation is a cold load.

Only `transform` and `opacity` are animated. Layers are promoted when the
section pins and demoted the moment it does not, so scrolling the rest of the
page costs nothing.

## Deploy

Static, like PLINTH. Built on the workstation, `rsync`ed to `/var/www/hub`,
served by nginx. There is no backend and nothing to containerise. Not written
yet — the hub is not live.
