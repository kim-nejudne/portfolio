/**
 * The head's asset contract.
 *
 * This file is the seam between the choreography and the artwork. Nothing else
 * in the app knows a filename, a stacking order or where the hinge is — so when
 * the real duotone layers replace the placeholders, this is the only file that
 * can possibly need to change, and most likely it will not.
 *
 * Everything is expressed as a percentage of the shared 1200x1600 canvas, so
 * the numbers are resolution-independent and the layers register by
 * construction. `scripts/placeholder-head.py` draws to the same canvas and the
 * same geometry; the real art has to as well.
 */

/** Canvas aspect. Every full-bleed layer is exactly this shape. */
export const CANVAS = { w: 1200, h: 1600 } as const;

/**
 * Landmarks, in canvas units.
 *
 * These still describe the *placeholder* cavity, not Kim's tear — his runs from
 * y 429 to 613 with a half-width of about 374, against the 410/244 below. They
 * move as a set the day the real cavity and sky are cut, because moving them
 * alone would slide `SKY_CLIP` off a painted rim that had not moved with it.
 *
 * `HEAD_CX` used to live here to derive the hinge. It does not any more: the
 * hinge is measured off the real lid, so a constant claiming to know where the
 * centre of the head is would have been a second, disagreeing source of truth.
 */
const CUT_Y = 410;
const CAVITY_RY = 140;
const CAVITY_RX = 244;
const EYE_CY = 640;

/** Where the cards are born: the centre of the opening. */
export const CAVITY_POINT = {
  x: 50,
  y: (CUT_Y / CANVAS.h) * 100, // 26.875%
} as const;

/**
 * The opening, as a clip path.
 *
 * The sky is drawn larger than the hole it shows through so it has room to
 * parallax, and the first attempt left the cavity layer in front of it to do
 * the masking. That works until the sky actually moves: a 15px drift put its
 * top edge above the mask and two blue crescents appeared beside his ears.
 *
 * Clipping the sky to the opening itself makes the failure impossible rather
 * than merely unlikely — the sky can be any size and travel any distance and
 * still cannot be seen anywhere except through the hole. A hair larger than
 * the cavity ellipse so the rim's own edge covers the seam.
 */
export const SKY_CLIP = `ellipse(${((CAVITY_RX / CANVAS.w) * 100 + 0.3).toFixed(3)}% ${(
  (CAVITY_RY / CANVAS.h) * 100 +
  0.2
).toFixed(3)}% at ${CAVITY_POINT.x}% ${CAVITY_POINT.y}%)`;

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
 * Measured off `public/head/lid.png` rather than derived from the cut ellipse,
 * because the pivot has to be on Kim's tear and not on the placeholder's. If
 * the lid is re-cut, re-measure: the furthest point of its silhouette in the
 * +x+y direction is the corner, and `scripts/compose-art.py` puts every layer
 * in the same coordinate space so the number stays meaningful.
 *
 * A consequence worth naming: an in-plane rotation never shows a backface, so
 * the cap presents its outside — its hair — all the way round. `lid-underside`
 * has nothing left to do and is no longer in `STACK`.
 */
export const HINGE = {
  x: 81.917, // 983 of 1200
  y: 37.125, // 594 of 1600
} as const;

/**
 * The eye line, as a fraction of the canvas. The layout positions the head by
 * this rather than by its top edge: the whole piece is composed around where
 * he is looking, and "the eyes reach the bottom of the screen" is the
 * instruction the descent has to satisfy at any viewport size.
 */
export const EYE_LINE = EYE_CY / CANVAS.h; // 0.40

/**
 * The visible head — crown to chin — as a fraction of the canvas height. The
 * canvas also carries neck and shoulders and a margin, so sizing the element
 * by canvas height would make the head itself unpredictably small.
 */
export const HEAD_FRACTION = 900 / CANVAS.h; // 0.5625

/**
 * How far the *open* head reaches above the eye line, as a fraction of the
 * canvas. This is the ceiling the settled cards have to clear.
 *
 * It is not the cut line, which is the number the layout used first and the
 * reason the cards landed on his forehead. The rear wall of the skull stands
 * above the cut whatever the lid is doing, and depending on how far the lid has
 * swung, the lid itself may stand above *that* — at `LID_ANGLE` 132 it did, and
 * cost 34px of overlap.
 *
 * It is not derived, because it depends on the hinge angle and on artwork that
 * does not exist yet. It is *checked* instead:
 * `scripts/verify.mjs` photographs the open head with the showcase hidden,
 * finds its real topmost pixel, and fails if a card overlaps it. So this can
 * be wrong and the suite will say so — which is what happened both times it
 * was wrong before.
 */
export const HEAD_OPEN_RISE = 0.315;

/**
 * The eye pair is the one layer that is not full-bleed. It is cross-faded on
 * every gaze change, and promoting a 1200x1600 texture to composite two
 * eyeballs is exactly the kind of waste that loses the frame budget on the
 * mid-range phone the brief insists on. Box in canvas units, expressed as
 * percentages so it can be positioned without any script.
 */
export const EYE_BOX = {
  left: (430 / CANVAS.w) * 100,
  top: (560 / CANVAS.h) * 100,
  width: (340 / CANVAS.w) * 100,
  height: (160 / CANVAS.h) * 100,
} as const;

export type LayerName =
  | 'head-back'
  | 'sky'
  | 'cavity'
  | 'face'
  | 'neck'
  | 'lid'
  | 'eyes-forward'
  | 'eyes-up';

/**
 * Back to front. The order is not arbitrary and two entries in it were wrong
 * on the first pass:
 *
 *  - `cavity` sits in *front* of `sky` because the sky is drawn larger than
 *    the opening so it can parallax; the cavity's rim is what stops it
 *    escaping.
 *  - `lid` sits in *front* of `face`, not behind it. The brief says the lid
 *    tips toward you — so it tips over the face, and with the face on top the
 *    seam rendered as a flat horizontal line instead of the front lip of a cut
 *    ellipse.
 *
 * The eye pair sits behind `face`, showing through the sockets that layer has
 * cut out of it, so the gaze can change without redrawing a single feature.
 *
 * `lid-underside` used to sit between `neck` and `lid` as the back plate of a
 * two-sided hinge. The hinge is an in-plane rotation now, which never turns the
 * cap away from the viewer, so there is no backface to fill and the layer is
 * gone rather than left rendering nothing.
 */
export const STACK: readonly LayerName[] = [
  'head-back',
  'sky',
  'cavity',
  'eyes-forward',
  'eyes-up',
  'face',
  'neck',
  'lid',
];

/**
 * The cards fly above everything.
 *
 * Strictly they ought to emerge from *between* the cavity and the lid, so the
 * open lid occludes the first frames of a card's rise. That reads better and
 * is a one-line change here once the real art exists — but it only pays off
 * when the lid is an opaque photographic crown rather than a grey shape, and
 * until then it costs a stacking context around the flight path for no visible
 * gain. Noted rather than quietly dropped.
 */
export const CARD_Z = 20;

const base = (name: LayerName) => `/head/${name}`;

/** AVIF with a PNG fallback. Both are written by the generator script. */
export const sources = (name: LayerName) => ({
  avif: `${base(name)}.avif`,
  png: `${base(name)}.png`,
});
