import type { RefObject } from 'react';
import { gsap, MM, ScrollTrigger, useGSAP } from '../gsapSetup';
import {
  BEATS,
  CARD_ARCS,
  CARD_BIRTH_SCALE,
  CARD_HOLD,
  CARD_LEAVE,
  CARD_RISE,
  CARD_STRIDE,
  DESCENT_EASE,
  LIP_END_VH,
  LIP_REST_VH,
  LID_ANGLE,
  PIN_LENGTH,
  TOTAL,
} from '../choreography';

/**
 * The whole performance.
 *
 * Two ideas govern this file, and both come straight out of `hub-brief.md`.
 *
 * **Scrub the mechanism, trigger the performances.** The lid, the descent and
 * the cards are tied to the scroll — the viewer is the one opening the head.
 * The eye-flick is not: it runs at its own speed with its own easing whatever
 * the wheel is doing. A fully scrubbed timeline feels dragged on a slider, and
 * a slow scroller would watch the eyes creep upward over four seconds and lose
 * the illusion entirely.
 *
 * **Reduced motion is a policy.** Everything below is created inside a
 * `matchMedia` conditional. Under `prefers-reduced-motion: reduce` this
 * function builds nothing at all, and the static layout is CSS's job under the
 * same query — so the two branches cannot drift.
 */
export function useHubTimeline(root: RefObject<HTMLElement | null>) {
  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      mm.add({ animate: MM.animate, isDesktop: MM.isDesktop }, (ctx) => {
        /*
         * `matchMedia` with a conditions object invokes this for every
         * combination, including the ones we want nothing to do with. The
         * reduced-motion branch is one of them: it builds nothing, and CSS
         * takes over under the identical query.
         */
        if (!ctx.conditions?.animate) return;
        const bp = ctx.conditions.isDesktop ? 'desktop' : 'mobile';

        const stage = root.current;
        if (!stage) return;

        const q = <T extends HTMLElement>(sel: string) => stage.querySelector<T>(sel);
        const head = q('[data-head]');
        const lid = q('[data-lid]');
        const cavity = q('[data-cavity]');
        const pitch = q('[data-pitch]');
        const cue = q('[data-cue]');
        const list = q('[data-cards]');
        const cards = gsap.utils.toArray<HTMLElement>('[data-card]', stage);

        if (!head || !lid || !cavity || !list || cards.length === 0) return;

        /*
         * Tell CSS that the timeline is driving. Until this lands the cards are
         * plainly visible in their settled grid, so if this hook throws — a bad
         * selector, a GSAP chunk that failed to load — React still renders five
         * working links instead of five invisible ones. `useGSAP` runs before
         * paint, so there is no flash of the un-hidden state.
         *
         * It is not a no-JavaScript fallback and is not claimed as one: this is
         * a client-rendered app, and with scripting off there is no page at all.
         * Server-rendering it would be the fix, and it is not worth a framework
         * for one route whose entire content is five links.
         */
        stage.setAttribute('data-ready', '');

        const descent = () => ((LIP_END_VH - LIP_REST_VH[bp]) / 100) * window.innerHeight;

        /*
         * How far the head has already sunk at timeline position `t`.
         *
         * The same curve the descent tween below runs, sampled rather than
         * animated. `DESCENT_EASE` is shared so there is one copy of it.
         */
        const descentAt = (t: number) => {
          const span = BEATS.descentEnd - BEATS.descentStart;
          const p = gsap.utils.clamp(0, 1, (t - BEATS.descentStart) / span);
          return gsap.parseEase(DESCENT_EASE)(p) * descent();
        };

        /*
         * Where each card is born, relative to where CSS has already put it.
         *
         * Measured with transforms cleared, because after the first refresh
         * every one of these elements is carrying one — measuring through it
         * would compound the offset a little more on each resize until the
         * cards launched from somewhere off-screen.
         *
         * The cavity is measured at rest, and then each card gets the descent
         * **as it stands at that card's own birth**. This used to add the whole
         * descent to all five, on the reasoning that the head had finished
         * sinking before any card emerged. That was true, and stopped being
         * true the moment the first card was moved to unit 3 to meet the
         * "visible at 90 degrees" constraint: card one is now born before the
         * head has sunk at all, and would have launched a full descent below
         * the opening — out of his jaw rather than out of the tear.
         *
         * Cards two to five are born after `descentEnd`, so they sample 1 and
         * are unchanged. That is what makes this the kind of bug worth a test:
         * four fifths of it stays right.
         */
        let launch: { dx: number; dy: number }[] = [];
        const measure = () => {
          gsap.set([head, ...cards], { clearProps: 'transform' });
          const c = cavity.getBoundingClientRect();
          const cx = c.left + c.width / 2;
          launch = cards.map((card, i) => {
            const cy = c.top + c.height / 2 + descentAt(BEATS.showcaseStart + i * CARD_STRIDE);
            const r = card.getBoundingClientRect();
            return { dx: cx - (r.left + r.width / 2), dy: cy - (r.top + r.height / 2) };
          });
        };
        measure();
        ScrollTrigger.addEventListener('refreshInit', measure);

        /*
         * The gaze used to live here: a triggered cross-fade between an
         * `eyes-forward` and an `eyes-up` layer showing through sockets cut out
         * of the face, running on its own easing rather than on the scroll.
         *
         * It is gone with those layers. The eyes are drawn into `face` and
         * cannot change, so beat 2 has nothing to perform. What that costs is
         * worth naming: the flick was the piece's argument for why the pause
         * before the first card exists — he looked up at empty sky, and the
         * viewer's gaze followed his to the spot the card then arrived in. The
         * pause is still there and still worth having, but it is a breath now
         * rather than a cue.
         */

        /* ---- the mechanism: scrubbed --------------------------------- */

        const tl = gsap.timeline({
          defaults: { ease: 'none' },
          scrollTrigger: {
            trigger: stage,
            start: 'top top',
            end: PIN_LENGTH,
            pin: true,
            /*
             * A little smoothing, not a lot. At 0 the lid judders on a mouse
             * wheel's discrete steps; much above 0.5 it stops feeling like the
             * viewer's own hand is opening it, which is the point of scrubbing
             * it at all.
             */
            scrub: 0.4,
            invalidateOnRefresh: true,
            onToggle: (self) => stage.classList.toggle('is-pinned', self.isActive),
          },
        });

        /* 1 · the top of the head swings open on a hinge at the tear's right */
        tl.fromTo(
          lid,
          { rotate: 0 },
          {
            rotate: LID_ANGLE,
            duration: BEATS.lidEnd - BEATS.lidStart,
            /*
             * Out, not inOut. A scrubbed mechanism has to answer the hand that
             * is turning it: `power2.inOut` spends the first third of the
             * scroll delivering a quarter of the movement, and the head
             * appeared not to open at all until the scroll was already a
             * tenth of the way down the page. Easing out means the lid breaks
             * free immediately and settles into place, which is what a hinged
             * thing you are swinging open actually does.
             */
            ease: 'power1.out',
          },
          BEATS.lidStart,
        );

        /* 1 · and the head sinks as it opens, until the eyes reach the floor */
        tl.fromTo(
          head,
          { y: 0 },
          {
            y: descent,
            duration: BEATS.descentEnd - BEATS.descentStart,
            ease: DESCENT_EASE,
          },
          BEATS.descentStart,
        );

        /*
         * The pitch and the scroll cue step aside — and now they have to hurry.
         *
         * The pitch occupies the sky, and the sky is where the first card
         * climbs. It used to have fourteen units to clear because nothing came
         * out of the head until unit 36. The first card is born at 3 and is
         * high enough to reach the headline by about 10, so that is the budget.
         * It is a scrubbed fade, so it still tracks the hand rather than
         * snapping — and the pitch is fully readable at rest, before any of
         * this starts.
         */
        if (pitch) tl.to(pitch, { autoAlpha: 0, y: -28, duration: 10, ease: 'power1.in' }, 0);
        if (cue) tl.to(cue, { autoAlpha: 0, duration: 4 }, 0);

        /*
         * 4 · the genie.
         *
         * One card *on stage* at a time — which is not the same as one card on
         * screen, and the difference is the point. Each is born tiny at the
         * mouth of the opening, arced up into the middle of the sky, held still
         * long enough to be read, then drifted on up and out. The next one is
         * born three units before that departure, so it is already out of the
         * head and climbing while the current card is still being read.
         *
         * All five cards occupy the same position in the layout, stacked, so
         * every one of them travels the same route from the same origin. Only
         * the arc differs — and because they share a destination, the overlap
         * is only safe while `CARD_STRIDE > CARD_HOLD` holds. `choreography.ts`
         * states that constraint and two others alongside it;
         * `scripts/verify.mjs` samples the sequence and enforces them.
         */
        cards.forEach((card, i) => {
          const arc = CARD_ARCS[i % CARD_ARCS.length];
          const born = BEATS.showcaseStart + i * CARD_STRIDE;
          const from = (k: 'dx' | 'dy') => () => launch[i]?.[k] ?? 0;

          tl.fromTo(
            card,
            {
              x: from('dx'),
              y: from('dy'),
              scale: CARD_BIRTH_SCALE,
              rotate: arc.rotate,
              autoAlpha: 0,
            },
            { autoAlpha: 1, duration: CARD_RISE * 0.35 },
            born,
          );

          /*
           * x and y run on different curves. That is the whole trick behind the
           * arc: two eases that disagree bend a straight line into one, without
           * a motion-path plugin and without a single non-composited property.
           */
          tl.to(card, { x: 0, duration: CARD_RISE, ease: arc.xEase, immediateRender: false }, born);
          tl.to(card, { y: 0, duration: CARD_RISE, ease: arc.yEase, immediateRender: false }, born);
          /*
           * Scale is eased `inOut` for the same reason y is: an `out` curve
           * brings the card to nearly full size in the first third of its
           * rise, which is exactly the stretch where the *previous* card is
           * still on stage. A full-size card climbing past a full-size card
           * reads as a collision. Staying small while it is low is what makes
           * the overlap read as depth.
           */
          tl.to(
            card,
            { scale: 1, rotate: 0, duration: CARD_RISE, ease: 'power2.inOut', immediateRender: false },
            born,
          );

          /*
           * The last one does not leave.
           *
           * Every card before it drifts away to make room for the next, but
           * there is no next after the fifth, and letting it go too would end
           * the whole performance on an empty sheet of paper while the head
           * slides out beneath it. Holding it means the pin releases onto
           * something — and the eye has somewhere to be as the index arrives.
           */
          if (i === cards.length - 1) return;

          const leaves = born + CARD_RISE + CARD_HOLD;
          const away = () => -(card.getBoundingClientRect().bottom + 48);

          tl.to(
            card,
            { y: away, scale: 0.94, rotate: arc.rotate * 0.35, duration: CARD_LEAVE, ease: 'power1.in', immediateRender: false },
            leaves,
          );
          /*
           * Fading over the back three-quarters, so it is gone before the edge
           * — and, more to the point, so it is visibly receding by the time the
           * incoming card climbs past it. It used to hold full opacity for
           * nearly half its exit, which was fine when nothing else was on
           * screen and became a departing card sitting opaquely on top of an
           * arriving one the moment the two were made to overlap.
           */
          tl.to(
            card,
            { autoAlpha: 0, duration: CARD_LEAVE * 0.75, ease: 'none', immediateRender: false },
            leaves + CARD_LEAVE * 0.25,
          );
        });

        /*
         * 5 · settle. The head does not dissolve — it carries on the way it has
         * been going and leaves the bottom of the frame. A duotone head fading
         * over paper would read as a printing error rather than an intention,
         * and the descent has already established the direction, so the exit
         * costs no new vocabulary.
         */
        tl.to(
          head,
          {
            y: () => descent() + head.offsetHeight * 0.8,
            duration: BEATS.exitEnd - BEATS.exitStart,
            ease: 'power2.in',
            immediateRender: false,
          },
          BEATS.exitStart,
        );

        tl.set({}, {}, TOTAL); // hold the timeline open to its full length

        /*
         * There is no keyboard rescue here any more, and that is the fix
         * rather than an omission.
         *
         * An earlier version hid the only copy of the work inside this pinned
         * section, so a keyboard user could reach it only at one scroll
         * position — which needed a scripted jump on the skip link, which
         * needed the scrub landed synchronously first, which needed the
         * timeline poked by hand. Three mechanisms to undo one bad decision.
         *
         * Now the showcase is a performance and `Index` below the pin is the
         * navigation: five links, always in the document, always visible. The
         * skip link is an ordinary anchor and none of the above exists.
         */

        return () => {
          ScrollTrigger.removeEventListener('refreshInit', measure);
          stage.removeAttribute('data-ready');
          stage.classList.remove('is-pinned');
        };
      });
    },
    { scope: root },
  );
}
