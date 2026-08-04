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
         * Where each card is born, relative to where CSS has already put it.
         *
         * Measured with transforms cleared, because after the first refresh
         * every one of these elements is carrying one — measuring through it
         * would compound the offset a little more on each resize until the
         * cards launched from somewhere off-screen.
         *
         * The cavity is measured at rest and the descent added, rather than
         * measured live: by the time a card emerges the head has finished
         * sinking, so its launch point is the opening's *final* position.
         */
        let launch: { dx: number; dy: number }[] = [];
        const measure = () => {
          gsap.set([head, ...cards], { clearProps: 'transform' });
          const c = cavity.getBoundingClientRect();
          const cx = c.left + c.width / 2;
          const cy = c.top + c.height / 2 + descent();
          launch = cards.map((card) => {
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
            ease: 'power2.inOut',
          },
          BEATS.descentStart,
        );

        /* the pitch and the scroll cue step aside before anything else moves */
        if (pitch) tl.to(pitch, { autoAlpha: 0, y: -28, duration: 14, ease: 'power1.in' }, 2);
        if (cue) tl.to(cue, { autoAlpha: 0, duration: 6 }, 0);

        /*
         * 2 · beat — nothing between the lid settling and the first card. It
         * will feel wrong in isolation and right in sequence. Do not fill it.
         */

        /*
         * 4 · the genie.
         *
         * One card at a time: born tiny at the mouth of the opening, arced up
         * into the middle of the sky, held still long enough to be read, then
         * drifting on up and out while the next is already on its way.
         *
         * All five cards occupy the same position in the layout, stacked, so
         * every one of them travels the same route from the same origin. Only
         * the arc differs.
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
          tl.to(
            card,
            { scale: 1, rotate: 0, duration: CARD_RISE, ease: 'power2.out', immediateRender: false },
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
          /* Fading only over the back half, so it is gone before the edge. */
          tl.to(
            card,
            { autoAlpha: 0, duration: CARD_LEAVE * 0.55, ease: 'none', immediateRender: false },
            leaves + CARD_LEAVE * 0.45,
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
