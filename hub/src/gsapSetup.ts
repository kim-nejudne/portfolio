import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(useGSAP, ScrollTrigger);

/*
 * A mobile browser shrinking or growing its viewport as the URL bar hides is
 * not a resize the page should react to. Without this, that one gesture
 * re-measures the pin mid-scroll and the head visibly jumps — which is why the
 * stage is sized in `svh` as well: the two together mean the pinned section
 * has one height for its whole life.
 */
ScrollTrigger.config({ ignoreMobileResize: true });

/**
 * Reduced motion is a policy, not a per-component afterthought — the PLINTH
 * pattern. Every timeline is created inside a `gsap.matchMedia` conditional,
 * so when the preference is `reduce` nothing is built at all and there is
 * nothing left to remember to guard.
 *
 * The static layout that replaces it is owned entirely by CSS, under the same
 * media query. That is deliberate: one query, two consumers, so the animated
 * and static branches cannot drift apart.
 */
export const MM = {
  isDesktop: '(min-width: 768px)',
  isMobile: '(max-width: 767px)',
  animate: '(prefers-reduced-motion: no-preference)',
} as const;

export { gsap, useGSAP, ScrollTrigger };
