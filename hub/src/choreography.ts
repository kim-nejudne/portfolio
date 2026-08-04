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
 * When a card's flight begins, relative to its birth: after it has emerged and
 * waited its turn. Derived rather than declared, so the queue cannot silently
 * fall out of the chain.
 */
export const cardFlies = (born: number) => born + CARD_EMERGE + CARD_QUEUE;

/** When it lands. */
export const cardSettles = (born: number) => cardFlies(born) + CARD_RISE;

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
 * A card's life has four movements, not two. It **emerges** from the opening
 * and stops — out of his head, small, unmistakably a card. It **queues** there
 * while the card above it is being read. It **flies** up into the sky. It
 * **holds**, and then it **leaves**.
 *
 * The queue is the whole reason this is not simply "a longer rise", and it was
 * arrived at by trying that first and failing on geometry rather than on
 * timing. A card is nearly as tall as the distance it climbs — the sky is one
 * card deep. So a card far enough along its rise to be *seen below* the settled
 * one is already far enough along to be printed *over* it, and no easing curve
 * escapes that, because it is a fact about the layout and not about the motion.
 * Every attempt to buy visibility by starting the rise earlier either hid the
 * newcomer or obscured the caption of the card being read.
 *
 * Splitting the climb in two dissolves it. The emergence is short and travels
 * almost nowhere, so a queued card sits *in the opening* rather than in the
 * sky, where there is room for it and where it reads as the next idea waiting
 * its turn. The flight keeps the arc it always had.
 *
 * The overlap is arithmetic, not feel. Writing S for the stride and E, Q, R, H,
 * L for the five phases, with the climb C = E + Q + R:
 *
 *   S + 0.6E < C   — the next card has finished appearing before the current
 *                    one even lands, which is Kim's requirement stated exactly:
 *                    whenever a card is on stage, the next is already visible.
 *   S > H          — and it does not *arrive* before the current one gives up
 *                    the spot. Every card shares one position in the layout, so
 *                    below this two of them are printed on top of each other.
 *   S > H + L      — the stricter line actually taken: the outgoing card has
 *                    finished fading before the incoming one lands, so the two
 *                    are never even near the destination together.
 *
 * All three hold here: 16.8 < 20, 15 > 10, 15 > 14. A card is on screen for 34
 * units against a stride of 15, so for the whole of the middle of the sequence
 * there are two — one being read, one waiting in his head.
 *
 * The middle line was written as `S > H + L` at first and it was wrong — the two
 * conditions are different constraints and only the weaker one is a collision.
 * `scripts/verify.mjs` is what settled it: sabotaging the stride to 10, which
 * breaks `S > H + L` but not `S > H`, produced no double-settled frame, and the
 * sequence looked fine. Sabotaging it to 6 broke `S > H` and the check caught
 * two cards on the same coordinate immediately.
 * ------------------------------------------------------------------ */

/** Scroll units from one card's birth to the next one's. */
export const CARD_STRIDE = 15;

/**
 * Out of the opening and no further. Short, because this is an appearance
 * rather than a journey — the card clears the tear, becomes legible as a card,
 * and stops.
 */
export const CARD_EMERGE = 3;

/**
 * Waiting its turn at the mouth of the opening, while the card above it is
 * read. This is the beat Kim asked for twice: "when a card is on stage, the
 * next card should already be visible."
 */
export const CARD_QUEUE = 9;

/**
 * The flight: mouth of the opening to the middle of the sky. The genie itself.
 *
 * One number falls out of the chain rather than being chosen. Card one is born
 * at unit 3 and the emergence fades in over 60% of `CARD_EMERGE`, so it is
 * fully visible at 4.8 — comfortably before unit 7, where the lid passes 90
 * degrees and Kim asked for a card to be there.
 */
export const CARD_RISE = 8;

/** On stage, unmoving, being read. */
export const CARD_HOLD = 10;

/** Up and away. */
export const CARD_LEAVE = 4;

/**
 * How small a card is at the instant it leaves the cavity. Small enough to
 * read as coming *out of* the opening, large enough not to pop.
 */
export const CARD_BIRTH_SCALE = 0.14;

/**
 * How big it is once it has emerged, and how far up it has come — as a fraction
 * of the whole climb.
 *
 * Both are deliberately small. A queued card has to be legible as a card and
 * illegible as *the* card: big enough that you can see something is coming,
 * low enough that it is plainly still in his head and not competing with the
 * one being read. Push the travel much past a fifth and it starts covering the
 * caption of the card above it, which is the failure the queue exists to avoid.
 */
export const CARD_QUEUE_SCALE = 0.3;
export const CARD_QUEUE_TRAVEL = 0.18;

/**
 * Per-card character. Nothing moves in parallel with anything else: each card
 * gets its own launch rotation and its own pair of eases, and animating x and
 * y on different curves is what bends a straight line into an arc without
 * paying for a motion-path plugin. No pair here is the same curve twice — two
 * identical eases would travel a straight line.
 *
 * These govern the **flight** only. The emergence has a fixed ease of its own,
 * because it is the same gesture for every card — five different ways of poking
 * out of a hole would be noise.
 *
 * **Every y ease is `inOut`, and that is load-bearing rather than taste.** They
 * were all `out` while the cards ran one at a time, which front-loads the
 * travel: an `out` curve is already 77% of the way up a third of the way
 * through its flight. Fine in isolation, fatal under overlap — the incoming
 * card would arrive almost on top of the outgoing one while it was still being
 * read. `inOut` holds it low for the first third, then swoops it into place as
 * the stage clears. The arithmetic above says a collision cannot happen; the
 * easing is what makes the near-miss look deliberate.
 */
export const CARD_ARCS = [
  { rotate: -9, xEase: 'power1.inOut', yEase: 'power3.inOut' },
  { rotate: 7, xEase: 'sine.inOut', yEase: 'power2.inOut' },
  { rotate: -5, xEase: 'power2.inOut', yEase: 'power4.inOut' },
  { rotate: 11, xEase: 'power1.inOut', yEase: 'power2.inOut' },
  { rotate: -7, xEase: 'sine.inOut', yEase: 'power3.inOut' },
] as const;
