/**
 * The six beats, in one place.
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
  lidEnd: 35,
  descentStart: 4,
  descentEnd: 38,

  /** 2 · Look — the eyes flick up. Triggered, not scrubbed. */
  look: 38,

  /** 3 · Beat — nothing. Do not fill it. */

  /** 4 · Emergence — the cards rise into the sky he is already staring at. */
  emergeStart: 48,
  emergeEnd: 78,

  /** 5 · Settle — the head keeps going and leaves the bottom of the frame. */
  exitStart: 78,
  exitEnd: 100,
} as const;

/** The timeline is built in these units: 1 unit = 1% of the pinned scroll. */
export const TOTAL = 100;

/**
 * How much scroll the whole performance costs. Six beats over three and a bit
 * viewport heights: enough that the empty beat at 38–48% is felt as a pause
 * rather than skipped over, and short enough that a recruiter skimming with a
 * trackpad reaches the cards.
 */
export const PIN_LENGTH = '+=320%';

/**
 * Where the eyes sit, as a percentage of viewport height, at rest and at the
 * end of the descent.
 *
 * The second number is the whole answer to the portrait-phone problem. A head
 * that fills a 390x844 screen leaves nowhere for a card to rise into — so the
 * head does not stay put. It sinks as it opens until the eyes are at the
 * bottom of the screen, which frees the entire viewport above it, keeps the
 * gaze pointing at the space the cards arrive in, and means beat 5 needs no
 * dissolve: the head simply carries on and leaves.
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
 */
export const HEAD_HEIGHT_VH = { mobile: 44, desktop: 62 } as const;

/**
 * How far the lid swings.
 *
 * Just under vertical, deliberately. Past 90 degrees the crown would fling
 * forward over the face and cover the sky the cards need; short of about 60 it
 * reads as a lifted hat rather than an opened container. At 74 the lid is
 * foreshortened almost to its cut edge — which is why that edge carries a
 * paper-thickness band in the asset spec, and why this angle is the first
 * thing to re-tune when the real art lands.
 */
export const LID_ANGLE = -74;

/** The gaze change. Its own easing, its own duration, in real seconds. */
export const FLICK_SECONDS = 0.12;

/**
 * How far a card is scaled down at the instant it leaves the cavity. Small
 * enough to read as coming *out of* the opening, large enough not to pop.
 */
export const CARD_BIRTH_SCALE = 0.12;

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

/** Heavy, so the five arrivals are five events rather than a swarm. */
export const CARD_STAGGER = 4.2; // in timeline units
export const CARD_DURATION = 13; // in timeline units
