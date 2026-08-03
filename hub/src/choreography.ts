/**
 * The beats, in one place.
 *
 * Every number the timeline uses lives here, because the whole argument for
 * building against placeholder art is that the *timing* can be tuned before
 * the artwork exists. Tuning is worthless if it means hunting constants
 * through four components.
 *
 * Positions are percentages of the pinned scroll, so they read against the
 * table in `hub-brief.md` without arithmetic.
 */

export const BEATS = {
  /** 0 · Rest — closed, eyes meeting yours. */
  /** 1 · Lid — the cranium hinges open, and the head sinks as it does. */
  lidStart: 0,
  lidEnd: 26,
  descentStart: 3,
  descentEnd: 30,

  /** 2 · Look — the eyes flick up. Triggered, not scrubbed. */
  look: 32,

  /** 3 · Beat — nothing. Do not fill it. */

  /** 4 · Showcase — the ideas come out one at a time. */
  showcaseStart: 36,

  /** 5 · Settle — the head leaves the bottom of the frame. */
  exitStart: 90,
  exitEnd: 100,
} as const;

/** The timeline is built in these units: 1 unit = 1% of the pinned scroll. */
export const TOTAL = 100;

/**
 * How much scroll the whole performance costs.
 *
 * Nearly twice what the settled-grid version needed, and unavoidably so: five
 * projects shown one at a time is five separate arrivals, and a beat you pass
 * in a flick is not a showcase. At this length each card owns roughly 60% of a
 * viewport of scrolling — about one unhurried wheel gesture.
 *
 * The skim risk that creates is real, and the index below the pin is the
 * answer to it: a reader who flings past the whole sequence still lands on a
 * complete list of the work.
 */
export const PIN_LENGTH = '+=560%';

/**
 * Where the eyes sit, as a percentage of viewport height, at rest and at the
 * end of the descent.
 *
 * The second number is the whole answer to the portrait-phone problem. A head
 * that fills a 390x844 screen leaves nowhere for a card to rise into — so the
 * head does not stay put. It sinks as it opens until the eyes are at the
 * bottom of the screen, which frees the entire viewport above it, keeps the
 * gaze pointing at the space the cards arrive in, and means the last beat
 * needs no dissolve: the head simply carries on and leaves.
 */
export const EYE_REST_VH = { mobile: 52, desktop: 46 } as const;
export const EYE_END_VH = 88;

/**
 * Head size, crown to chin, as a percentage of viewport height — not of the
 * artboard, which also carries neck, shoulders and margin.
 *
 * Smaller on a phone than the ratio alone would suggest, and sitting lower.
 * A 390x844 screen has to fit the pitch above the crown, and at the desktop
 * proportion the headline lands on his hair.
 *
 * The head and the card compete for the same viewport, so these move whenever
 * the lid's silhouette does. They came down when the lid was lifting clear
 * above the head and went back up when it started flipping sideways instead:
 * a lid lying to the right reaches far less far up than one hovering over the
 * crown. `npm run verify` measures the real clearance and prints it, which is
 * what these are tuned against.
 */
export const HEAD_HEIGHT_VH = { mobile: 42, desktop: 58 } as const;

/**
 * How far the lid flips.
 *
 * A `rotateY` about the right end of the cut — the top of the head opens
 * sideways, like a book cover, and ends up lying to the right of the face with
 * its inside toward you. See `HINGE` in `head.ts` for why the axis is vertical
 * rather than across the back of the skull.
 *
 * Past 90 degrees the lid is facing away and the browser swaps to the backface
 * plate, so this angle is also what decides whether you end up looking at the
 * outside of the crown or the inside of it. 168 lands it almost flat, still
 * caught by a few degrees of perspective so it does not read as a decal.
 *
 * Positive, so it swings *toward* the viewer on the way round rather than away
 * — the difference between a lid opening and a lid retreating.
 */
export const LID_ANGLE = 168;

/**
 * A little counter-rotation in the plane, so the lid tips as it swings instead
 * of tracking a perfect arc. Mechanisms do this; drawings that do not look
 * like diagrams.
 */
export const LID_TILT = -7;

/** The gaze change. Its own easing, its own duration, in real seconds. */
export const FLICK_SECONDS = 0.12;

/* ------------------------------------------------------------------ *
 * The genie
 *
 * One card at a time. Each is born tiny at the mouth of the opening, arcs up
 * into the middle of the sky, holds still long enough to be read, then drifts
 * on up and out of frame while the next is already on its way.
 *
 * The slot (rise + hold + leave) is longer than the stride, so an outgoing
 * card and an incoming one overlap by about a beat and a half. Without that
 * overlap the screen empties five times, and an empty screen mid-scroll reads
 * as something broken rather than as a pause.
 * ------------------------------------------------------------------ */

/** Scroll units from one card's birth to the next one's. */
export const CARD_STRIDE = 10.5;

/** Out of the opening: the genie itself. */
export const CARD_RISE = 3.4;

/** On stage, unmoving, being read. */
export const CARD_HOLD = 5.2;

/** Up and away. */
export const CARD_LEAVE = 3.4;

/**
 * How small a card is at the instant it leaves the cavity. Small enough to
 * read as coming *out of* the opening, large enough not to pop.
 */
export const CARD_BIRTH_SCALE = 0.1;

/**
 * Per-card character. Nothing moves in parallel with anything else: each card
 * gets its own launch rotation and its own pair of eases, and animating x and
 * y on different curves is what bends a straight line into an arc without
 * paying for a motion-path plugin.
 */
export const CARD_ARCS = [
  { rotate: -9, xEase: 'power1.inOut', yEase: 'power3.out' },
  { rotate: 7, xEase: 'power2.inOut', yEase: 'power2.out' },
  { rotate: -5, xEase: 'sine.inOut', yEase: 'power3.out' },
  { rotate: 11, xEase: 'power1.inOut', yEase: 'power2.out' },
  { rotate: -7, xEase: 'power2.inOut', yEase: 'power3.out' },
] as const;
