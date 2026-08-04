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
const EYE_CY = 754;

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
 * The eye line, as a fraction of the canvas. The layout positions the head by
 * this rather than by its top edge: the whole piece is composed around where
 * he is looking, and "the eyes reach the bottom of the screen" is the
 * instruction the descent has to satisfy at any viewport size.
 *
 * It survives the eye *layers* being deleted, because it was never about them.
 * The eyes are drawn into `face`, and this is where they are.
 */
export const EYE_LINE = EYE_CY / CANVAS.h; // 0.471

/**
 * The visible head — crown to chin — as a fraction of the canvas height. The
 * canvas also carries neck and shoulders and a margin, so sizing the element
 * by canvas height would make the head itself unpredictably small.
 */
export const HEAD_FRACTION = 900 / CANVAS.h; // 0.5625

/**
 * How far the *open* head reaches above the eye line, as a fraction of the
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
export const HEAD_OPEN_RISE = 0.33;

export type LayerName = 'face' | 'neck' | 'lid';

/**
 * Back to front. Three layers, down from nine.
 *
 * `lid` sits in *front* of `face`, not behind it — it is the hair that swings
 * off the top, and with the face on top the tear rendered as a flat line
 * instead of an edge.
 *
 * What used to be here: `head-back`, `sky`, `cavity`, `eyes-forward`,
 * `eyes-up`, and briefly `lid-underside`. Every one was a placeholder grey
 * shape standing in for art that was never drawn, and the decision was to
 * delete them rather than draw them. The consequences are real and belong here
 * rather than in a commit message nobody reads: the head no longer opens onto a
 * cavity, it opens onto his drawn scalp; there is no sky, so the **only colour
 * left on the page is the five project crops**; and the eye-flick beat is gone,
 * because the eyes are drawn into `face` and cannot change.
 *
 * `neck` is written fully transparent — the face was cut with the collar and
 * shoulders attached. It stays in the stack because a separately cut neck is a
 * one-line change, and it costs one cached empty PNG.
 */
export const STACK: readonly LayerName[] = ['face', 'neck', 'lid'];

/** The cards fly above everything. */
export const CARD_Z = 20;

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
