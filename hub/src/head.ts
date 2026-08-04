/**
 * The head's asset contract.
 *
 * This file is the seam between the choreography and the artwork. Nothing else
 * in the app knows a filename, a stacking order or where the hinge is.
 *
 * Everything is expressed as a percentage of the shared 1200x1600 canvas, so
 * the numbers are resolution-independent and the layers register by
 * construction. `scripts/compose-art.py` places every layer through one
 * transform onto that canvas, which is what makes registration a property of
 * the build rather than three careful exports.
 */

/** Canvas aspect. Every full-bleed layer is exactly this shape. */
export const CANVAS = { w: 1200, h: 1600 } as const;

/**
 * Landmarks, in canvas units, measured off Kim's drawing.
 *
 * `CUT_Y` is a level *through* the tear rather than a line it follows — the
 * tear is a hand-drawn wave running from y 471 at the temples down to y 757 in
 * the middle. Nothing paints it any more; it is only where the cards are born.
 */
const CUT_Y = 560;
const LIP_Y = 1050;

/**
 * Where the cards are born: the mouth of the opening.
 *
 * The one landmark that survived the layers being deleted. `Head.tsx` renders a
 * zero-size marker here and the timeline measures the launch point off that
 * element rather than recomputing canvas geometry — so the geometry lives in
 * this file alone, and moving the tear cannot silently leave the cards flying
 * out of his forehead.
 */
export const CAVITY_POINT = {
  x: 50,
  y: (CUT_Y / CANVAS.h) * 100, // 35%
} as const;

/**
 * The hinge: the **bottom-right corner of the lid**, where the tear meets the
 * right edge of the head.
 *
 * The lid swings open in the picture plane — a z rotation, a hinge, the way a
 * flip-top lid swivels aside. Nothing rotates out of plane, which is what
 * separates it from the two mechanisms it replaced: a `rotateX` across the back
 * of the skull, whose perspective-magnified projection swept straight back down
 * over the hole it had just made, and a `rotateY` book-cover door.
 *
 * Measured off `public/head/lid.png`, not derived. If the lid is re-cut,
 * re-measure: the furthest point of its silhouette in the +x+y direction is the
 * corner, and `compose-art.py` puts every layer in the same coordinate space so
 * the number stays meaningful.
 */
export const HINGE = {
  x: 82.889, // 995 of 1200
  y: 30.833, // 493 of 1600
} as const;

/**
 * The lower lip, as a fraction of the canvas.
 *
 * The layout positions the head by this rather than by its top edge, because
 * the composition is an instruction about where the head *ends* on screen:
 * "the lower lip almost touching the bottom of the page". Everything else — how
 * much sky the pitch gets above the crown, where the eyes land, how far the
 * descent has left to travel — falls out of it.
 *
 * It replaced the eye line, which had been the anchor while the pitch sat in a
 * column beside the head and the head was vertically centred against it. With
 * the pitch above the head there is nothing to centre against; there is a
 * bottom edge to sit on.
 *
 * Measured off `public/head/face.png`, and worth knowing it lands *below*
 * `HEAD_FRACTION`'s notional chin at canvas 1080 — that figure was taken where
 * the collar flares, not at the jaw, so "crown to chin" is really crown to
 * about the mouth. The name is inherited; the number is what the framing uses.
 */
export const LIP_LINE = LIP_Y / CANVAS.h; // 0.656

/**
 * The visible head — crown to chin — as a fraction of the canvas height. The
 * canvas also carries neck and shoulders and a margin, so sizing the element
 * by canvas height would make the head itself unpredictably small.
 */
export const HEAD_FRACTION = 900 / CANVAS.h; // 0.5625

/**
 * How far the *open* head reaches above the lip line, as a fraction of the
 * canvas. This is the ceiling the cards have to clear.
 *
 * It is not the cut line, which is the number the layout used first and the
 * reason the cards landed on his forehead. Against this drawing the swung lid
 * is the tallest thing on the artboard at every angle up to about 170.
 *
 * It is not derived, because it depends on the hinge angle and on the artwork.
 * It is *checked* instead: `scripts/verify.mjs` photographs the open head with
 * the showcase hidden, finds its real topmost pixel, and fails if a card
 * overlaps it. So this can be wrong and the suite will say so — which is what
 * happened every time it was wrong before.
 */
export const HEAD_OPEN_RISE = 0.52;

export type LayerName = 'sky' | 'face' | 'neck' | 'lid';

/**
 * What shows through the hole the lid leaves.
 *
 * It is the one layer of the six deleted that came back, and it turned out to
 * cost a single drawing rather than the four it looked like. `face.png` is
 * completely transparent above the tear — its ink starts exactly where the cut
 * does — so the head already opened onto nothing, and a colour field behind it
 * needs no drawn cavity and no back-of-skull. The tear is its rim.
 *
 * The other five stay gone, and the mechanism is why rather than the budget.
 * `head-back` and `lid-underside` existed to be seen when the lid tipped away
 * from the viewer; an in-plane hinge never turns. `cavity` was the drawn rim.
 * The eyes are drawn into the face.
 *
 * **It is the only colour on the page that is not a project.** That is the one
 * colour rule doing what it was written to do: the reveal is colour arriving at
 * the moment the head opens, and it has been absent since the layer was cut.
 */
export const BACK_STACK: readonly LayerName[] = ['sky'];

/**
 * Back to front. Three layers, down from nine.
 *
 * `lid` sits in *front* of `face`, not behind it — it is the hair that swings
 * off the top, and with the face on top the tear rendered as a flat line
 * instead of an edge.
 *
 * What used to be here: `head-back`, `cavity`, `eyes-forward`, `eyes-up`, and
 * briefly `lid-underside`. Every one was a placeholder grey shape standing in
 * for art that was never drawn, and the decision was to delete them rather than
 * draw them. The consequences are real and belong here rather than in a commit
 * message nobody reads: the head does not open onto a modelled cavity, and the
 * eye-flick beat is gone, because the eyes are drawn into `face` and cannot
 * change.
 *
 * `sky` was the sixth and it has been restored — see `BACK_STACK`. It is not in
 * this list because it does not stack with these: it is behind the cards and
 * these are in front of them.
 *
 * `neck` is written fully transparent — the face was cut with the collar and
 * shoulders attached. It stays in the stack because a separately cut neck is a
 * one-line change, and it costs one cached empty PNG.
 */
export const STACK: readonly LayerName[] = ['face', 'neck', 'lid'];

/**
 * Stacking. Three tiers, and the middle one is the whole paper-craft illusion.
 *
 * **The sky is behind them and the rest of the head is in front**, which is why
 * the drawing is two elements rather than one. A card has to come *out of* the
 * sky and *behind* his face, and those are opposite sides of the card — so the
 * two halves of the head cannot share a stacking context. `.head-plate` carries
 * the geometry and creates no context of its own; `.head-sky` and `.head` sit
 * inside it at either side of `CARD_Z`, both driven by the same tween.
 *
 * **The head is in front of the cards.** That is the correction that makes the
 * opening an opening: a card leaving the tear passes *behind* his scalp, so its
 * lower edge is cut by the drawing rather than laid over it, and a queued card
 * reads as something rising out of his head instead of a rectangle parked on his
 * forehead. The cards were on top for most of this build and it was wrong the
 * whole time — it only became obvious once one of them sat still long enough to
 * be looked at.
 *
 * It has a cost that has to be paid rather than ignored: the head can now hide a
 * card. `.head` is therefore `pointer-events: none`, so a link stays clickable
 * where the drawing covers it, and `scripts/verify.mjs` asserts in pixels both
 * that the head really does paint over the overlap *and* that a queued card
 * still contributes visible ink above the crown. One without the other is a
 * card that is either in front of his face or invisible.
 *
 * Chrome — the pitch and the scroll cue — sits above both. They are page
 * furniture rather than part of the scene, and at rest the head fills the bottom
 * of the screen where the cue lives.
 */
export const SKY_Z = 10;
export const CARD_Z = 20;
export const HEAD_Z = 30;
export const CHROME_Z = 40;

const base = (name: LayerName) => `/head/${name}`;

/**
 * AVIF with a PNG fallback, both written by `compose-art.py`.
 *
 * The AVIF is offered first, so a stale one silently wins over a PNG that was
 * just rewritten and the page shows the previous cut with no error anywhere.
 * That is why the composer always writes both.
 */
export const sources = (name: LayerName) => ({
  avif: `${base(name)}.avif`,
  png: `${base(name)}.png`,
});
