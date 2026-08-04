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
  lidEnd: 22,
  descentStart: 3,
  descentEnd: 24,

  /**
   * 4 · Showcase — the ideas come out one at a time. It begins on the frame the
   * head finishes sinking, which is also the frame the launch point becomes
   * true, so the first card leaves an opening that has stopped moving.
   *
   * There used to be a pause here, six units of nothing between the lid
   * settling and the first card, and the brief said in as many words not to
   * fill it. Its justification was the eye-flick: he looked up at empty sky and
   * the viewer's gaze followed his to the spot the card then arrived in. The
   * eyes are drawn into `face` now and cannot move, so the cue the pause was
   * built around no longer exists and what was left was just waiting. Removing
   * it is the eye layers' bill arriving, not a change of mind about pacing.
   */
  showcaseStart: 24,

  /** 5 · Settle — the head leaves the bottom of the frame. */
  exitStart: 88,
  exitEnd: 100,
} as const;

/** The timeline is built in these units: 1 unit = 1% of the pinned scroll. */
export const TOTAL = 100;

/**
 * How much scroll the whole performance costs.
 *
 * Nearly twice what the settled-grid version needed, and unavoidably so: five
 * projects shown one at a time is five separate arrivals, and a beat you pass
 * in a flick is not a showcase. At this length each card owns roughly 58% of a
 * viewport of scrolling — about one unhurried wheel gesture.
 *
 * That per-card figure is the number to hold constant, which is why this moved
 * when `CARD_STRIDE` did. The stride grew from 10.5 units to 12 to buy the
 * overlap between cards, and units are a percentage of *this*, so leaving it at
 * 560% would have made every card 14% slower to get through — the opposite of
 * the ask. 480% keeps a card's stride at the same physical distance and takes
 * most of a viewport off the front of the page, where the waiting was.
 *
 * The skim risk that a long pin creates is real, and the index below it is the
 * answer: a reader who flings past the whole sequence still lands on a complete
 * list of the work.
 */
export const PIN_LENGTH = '+=480%';

/**
 * Where the **lower lip** sits, as a percentage of viewport height, at rest and
 * at the end of the descent.
 *
 * At rest the lip is almost touching the bottom of the page. That is the whole
 * composition: the head sits low, and the pitch goes in the sky above the crown
 * rather than in a column beside it. It also answers the portrait-phone problem
 * outright — a head that fills a 390x844 screen leaves nowhere for a card to
 * rise into, and this one does not fill it, it hangs off the bottom of it.
 *
 * The descent survives, smaller. It used to carry the head from the middle of
 * the screen to the floor, about 42vh of travel, because that was the only way
 * to free the sky. The new resting position frees the sky by itself, so what is
 * left is a 12vh slide that puts the eyes on the bottom edge — which is where
 * Kim asked for them — and gives the exit at beat 5 something continuous to
 * carry on from rather than starting cold.
 */
export const LIP_REST_VH = { mobile: 94, desktop: 95 } as const;
export const LIP_END_VH = 107;

/**
 * Head size, crown to chin, as a percentage of viewport height — not of the
 * artboard, which also carries neck, shoulders and margin.
 *
 * Smaller on a phone than the ratio alone would suggest, and sitting lower.
 * A 390x844 screen has to fit the pitch above the crown, and at the desktop
 * proportion the headline lands on his hair.
 *
 * The head and the card compete for the same viewport, so these move whenever
 * the lid's silhouette does — and it has moved three times now: a lid lifting
 * clear above the crown, a lid flipping sideways like a door, and a lid
 * swinging aside on a hinge. `npm run verify` measures the real clearance and
 * prints it, which is what these are tuned against rather than reasoned to.
 */
export const HEAD_HEIGHT_VH = { mobile: 42, desktop: 58 } as const;

/**
 * How far the lid swings.
 *
 * A plain **in-plane rotation about the z axis**, pivoting on the bottom-right
 * corner of the tear — a hinge, not a door. Nothing rotates out of the picture
 * plane, so there is no perspective, no foreshortening and no backface.
 *
 * Positive is clockwise on screen. Because the lid sits up and to the *left* of
 * its own pivot, clockwise sweeps it up and over to the right, and the tear
 * line rotates from pointing left, through vertical, to pointing right.
 *
 * The value is measured against the artwork, not chosen. The cap's far corner
 * passes through vertical at about 69 degrees — the peak of the whole arc — and
 * stays the tallest thing on the artboard for a long way past it, so a swing
 * that stops too early leaves the cap sitting in the sky the cards need. Against
 * the pen drawing, 155 still throws it, 160 overlaps a card by 16px, and 175
 * lies flat enough to read as flipped over rather than hinged open. 165 clears
 * by 21px and keeps some lift.
 *
 * It was 150 against the photographic cut, which had a shallower cap and a
 * lower pivot. Expect to re-measure whenever the lid is re-cut: this number
 * belongs to the artwork at least as much as to the choreography.
 *
 * `npm run verify` measures all of that: that the swing lands on this number,
 * and separately, in pixels, that the opening is actually uncovered at the end
 * of it. The second is the one that matters — this piece has twice shipped a
 * lid that rotated perfectly and revealed nothing.
 *
 * The two rotations this replaced were a `rotateY` door plus a few degrees of
 * in-plane tilt. One number where there were two.
 */
export const LID_ANGLE = 165;

/* ------------------------------------------------------------------ *
 * The genie
 *
 * One card at a time. Each is born tiny at the mouth of the opening, arcs up
 * into the middle of the sky, holds still long enough to be read, then drifts
 * on up and out of frame — and the next one is out of the opening and climbing
 * before it goes.
 *
 * That overlap is the design, and it is an arithmetic relationship between four
 * numbers rather than a feel. Writing S, R, H, L for the four below:
 *
 *   S < R + H   — the next card is born while the current one is still being
 *                 read, so there is always something visibly on its way up.
 *   S > H       — and it does not *arrive* before the current one gives up the
 *                 spot. Every card shares one position in the layout, so below
 *                 this two of them are printed on top of each other.
 *   S > H + L   — the stricter line actually taken: the outgoing card has
 *                 finished fading before the incoming one lands, so the two are
 *                 never even near the destination together.
 *
 * All three hold here: 12 < 15, 12 > 8, 12 > 11. That leaves a three-unit window
 * where one card is on stage and the next is climbing towards it, and a six-unit
 * window where two cards are on screen at all.
 *
 * The middle line was written as `S > H + L` at first and it was wrong — the two
 * conditions are different constraints and only the weaker one is a collision.
 * `scripts/verify.mjs` is what settled it: sabotaging the stride to 10, which
 * breaks `S > H + L` but not `S > H`, produced no double-settled frame, and the
 * sequence looked fine. Sabotaging it to 6 broke `S > H` and the check caught
 * two cards on the same coordinate immediately.
 * ------------------------------------------------------------------ */

/** Scroll units from one card's birth to the next one's. */
export const CARD_STRIDE = 12;

/**
 * Out of the opening: the genie itself. Twice what it was, because a card that
 * crosses the whole sky in 3.4 units is not visible *travelling* for long
 * enough to read as the next one coming — it is just suddenly there.
 */
export const CARD_RISE = 7;

/** On stage, unmoving, being read. */
export const CARD_HOLD = 8;

/** Up and away. */
export const CARD_LEAVE = 3;

/**
 * How small a card is at the instant it leaves the cavity. Small enough to
 * read as coming *out of* the opening, large enough not to pop — and large
 * enough now to be legible as a card while it is still down there, since being
 * seen early is the whole job.
 */
export const CARD_BIRTH_SCALE = 0.14;

/**
 * Per-card character. Nothing moves in parallel with anything else: each card
 * gets its own launch rotation and its own pair of eases, and animating x and
 * y on different curves is what bends a straight line into an arc without
 * paying for a motion-path plugin. No pair here is the same curve twice — two
 * identical eases would travel a straight line.
 *
 * **Every y ease is `inOut`, and that is load-bearing rather than taste.** They
 * were all `out` while the cards ran one at a time, which front-loads the
 * travel: an `out` curve is already 77% of the way up a third of the way
 * through its rise. Fine in isolation, fatal under overlap — the incoming card
 * would arrive almost on top of the outgoing one while it was still being read.
 * `inOut` holds the new card low and small for the first third, then swoops it
 * into place as the stage clears. The arithmetic above says a collision cannot
 * happen; the easing is what makes the near-miss look deliberate.
 */
export const CARD_ARCS = [
  { rotate: -9, xEase: 'power1.inOut', yEase: 'power3.inOut' },
  { rotate: 7, xEase: 'sine.inOut', yEase: 'power2.inOut' },
  { rotate: -5, xEase: 'power2.inOut', yEase: 'power4.inOut' },
  { rotate: 11, xEase: 'power1.inOut', yEase: 'power2.inOut' },
  { rotate: -7, xEase: 'sine.inOut', yEase: 'power3.inOut' },
] as const;
