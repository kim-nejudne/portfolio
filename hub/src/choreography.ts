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
   * 4 · Showcase — the ideas come out, **while the head is still opening**.
   *
   * This used to wait for the mechanism: the lid finished, the head finished
   * sinking, a pause, and then the first card. It has moved twice, and the
   * second move is a different kind of change from the first.
   *
   * The first was deleting the pause. That was the eye-flick's bill arriving —
   * six units of nothing only earned their place as *anticipation*, and
   * anticipation needs him to look at the spot the card is about to occupy.
   * The eyes are drawn into `face` and cannot move, so what was left was
   * waiting.
   *
   * The second is the sequential reading of the whole thing: open, then show.
   * Kim's constraint was "the card is already visible when the head is at 90
   * degrees", which is unit 7 of 100 — the lid eases *out*, so it passes
   * vertical a third of the way through its swing, not halfway. Meeting it
   * means the first card is born at 3, before the lid is a quarter open and
   * before the head has begun to sink.
   *
   * Two things follow, and neither is optional:
   *
   *  - **The launch point can no longer assume a stationary head.** The comment
   *    it used to carry — "by the time a card emerges the head has finished
   *    sinking, so its launch point is the opening's final position" — is
   *    exactly false for card one now. `useHubTimeline` samples the descent
   *    curve at each card's own birth instead. Cards two to five are born after
   *    `descentEnd` and are unaffected, which is why this could be wrong by a
   *    whole descent and still look nearly right.
   *  - **The pitch has to clear much sooner**, because the sky it occupies is
   *    the sky the first card climbs into.
   */
  showcaseStart: 3,

  /** 5 · Settle — the head leaves the bottom of the frame. */
  exitStart: 90,
  exitEnd: 100,
} as const;

/**
 * The descent's easing, named rather than inlined.
 *
 * `useHubTimeline` both *runs* this tween and *samples* it, to find where the
 * opening is at the instant a card is born. Two copies of the curve would agree
 * until one of them was changed, and the symptom would be cards launching from
 * slightly the wrong place — which is precisely the bug that is invisible.
 */
export const DESCENT_EASE = 'power2.inOut';

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
 * **That per-card figure is the number held constant**, and it is the reason
 * this has moved twice while the sequence got faster. Units are a percentage of
 * *this*, so growing `CARD_STRIDE` without shrinking the pin makes every card
 * slower to scroll through — the opposite of the ask, arrived at by doing what
 * looks like the right thing. 560% -> 480% paid for a stride of 12; 480% -> 340%
 * pays for a stride of 17.
 *
 * What actually got cut, both times, was the front of the page: a pause, and
 * then the assumption that the head had to finish opening before anything could
 * come out of it. The showcase now runs *through* the mechanism rather than
 * after it, so an entire viewport and a half of scrolling disappeared without a
 * single card being rushed.
 *
 * The skim risk that a long pin creates is real, and the index below it is the
 * answer: a reader who flings past the whole sequence still lands on a complete
 * list of the work.
 */
export const PIN_LENGTH = '+=340%';

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
 * All three hold here: 17 < 23, 17 > 11, 17 > 15. That leaves a six-unit window
 * where one card is on stage and the next is climbing towards it, and a ten-unit
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
export const CARD_STRIDE = 17;

/**
 * Out of the opening: the genie itself. More than three times what it was, in
 * two steps and for two different reasons. First because a card that crosses
 * the whole sky in 3.4 units is not visible *travelling* long enough to read as
 * the next one coming — it is just suddenly there. Then because the first card
 * now launches at unit 3 and must not have finished arriving by the time the
 * lid is still swinging behind it.
 *
 * One number falls out of this rather than being chosen. The fade-in runs for
 * 35% of the rise, so card one reaches full opacity at unit 3 + 4.2 = 7.2 —
 * which is where the lid passes 90 degrees. Kim asked for the card to be
 * visible at that moment; it finishes becoming visible exactly on it.
 */
export const CARD_RISE = 12;

/** On stage, unmoving, being read. */
export const CARD_HOLD = 11;

/** Up and away. */
export const CARD_LEAVE = 4;

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
