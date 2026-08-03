import type { RefObject } from 'react';
import { gsap, MM, ScrollTrigger, useGSAP } from '../gsapSetup';
import {
  BEATS,
  CARD_ARCS,
  CARD_BIRTH_SCALE,
  CARD_DURATION,
  CARD_STAGGER,
  EYE_END_VH,
  EYE_REST_VH,
  FLICK_SECONDS,
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
        const sky = q<HTMLImageElement>('[data-layer="sky"]');
        const eyesForward = q<HTMLImageElement>('[data-layer="eyes-forward"]');
        const eyesUp = q<HTMLImageElement>('[data-layer="eyes-up"]');
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

        const descent = () => ((EYE_END_VH - EYE_REST_VH[bp]) / 100) * window.innerHeight;

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

        /* ---- the gaze: triggered, never scrubbed ---------------------- */

        let gaze: 'forward' | 'up' = 'forward';
        gsap.set(eyesUp, { autoAlpha: 0 });
        gsap.set(eyesForward, { autoAlpha: 1 });

        const setGaze = (next: 'forward' | 'up') => {
          if (next === gaze) return;
          gaze = next;
          const up = next === 'up';
          gsap.to(eyesUp, {
            autoAlpha: up ? 1 : 0,
            duration: FLICK_SECONDS,
            ease: 'power2.out',
            overwrite: true,
          });
          gsap.to(eyesForward, {
            autoAlpha: up ? 0 : 1,
            duration: FLICK_SECONDS,
            ease: 'power2.out',
            overwrite: true,
          });
        };

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
            onUpdate: (self) => setGaze(self.progress >= BEATS.look / TOTAL ? 'up' : 'forward'),
          },
        });

        /* 1 · the lid hinges open */
        tl.fromTo(
          lid,
          { rotateX: 0 },
          { rotateX: LID_ANGLE, duration: BEATS.lidEnd - BEATS.lidStart, ease: 'power2.inOut' },
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

        /* the sky drifts against the descent — the only depth cue in the piece */
        if (sky) {
          tl.fromTo(sky, { yPercent: -1.2 }, { yPercent: 1.2, duration: TOTAL }, 0);
        }

        /* the pitch and the scroll cue step aside before anything else moves */
        if (pitch) tl.to(pitch, { autoAlpha: 0, y: -28, duration: 14, ease: 'power1.in' }, 2);
        if (cue) tl.to(cue, { autoAlpha: 0, duration: 6 }, 0);

        /*
         * 3 · beat — nothing between 38 and 48. It will feel wrong in isolation
         * and right in sequence. Do not fill it.
         */

        /* 4 · the cards rise into the sky he is already looking at */
        cards.forEach((card, i) => {
          const arc = CARD_ARCS[i % CARD_ARCS.length];
          const at = BEATS.emergeStart + i * CARD_STAGGER;
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
            { autoAlpha: 1, duration: CARD_DURATION * 0.3 },
            at,
          );

          /*
           * x and y run on different curves. That is the whole trick behind the
           * arc: two eases that disagree bend a straight line into one, without
           * a motion-path plugin and without a single non-composited property.
           */
          tl.to(card, { x: 0, duration: CARD_DURATION, ease: arc.xEase, immediateRender: false }, at);
          tl.to(card, { y: 0, duration: CARD_DURATION, ease: arc.yEase, immediateRender: false }, at);
          tl.to(
            card,
            { scale: 1, rotate: 0, duration: CARD_DURATION, ease: 'power2.out', immediateRender: false },
            at,
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
         * Keyboard rescue.
         *
         * The cards spend most of the pin at `autoAlpha: 0`, which sets
         * `visibility: hidden` — and that is correct: invisible work must not
         * be clickable by a stray mouse or tabbable by someone who cannot see
         * why focus vanished. But it also means the obvious fix does not work.
         * A `focusin` handler on the list can never fire, because a
         * visibility-hidden element cannot take focus in the first place. That
         * was written, shipped into the verify suite, and failed there.
         *
         * So the rescue belongs on the skip link, which is the first thing a
         * keyboard user reaches. It jumps to the settled state and hands focus
         * to the first card. Without the timeline it stays an ordinary anchor
         * to `#work`, so nothing depends on this running.
         */
        const st = tl.scrollTrigger;
        const skip = document.querySelector<HTMLAnchorElement>('[data-skip]');

        const onSkip = (e: Event) => {
          if (!st) return;
          e.preventDefault();
          const settled = st.start + (st.end - st.start) * (BEATS.emergeEnd / TOTAL);
          window.scrollTo({ top: settled, behavior: 'instant' as ScrollBehavior });
          st.update();
          /*
           * Land the timeline on the same beat, synchronously.
           *
           * Scrolling alone is not enough: the scrub is 0.4s of easing behind
           * the scroll, so the card would still be `visibility: hidden` at the
           * instant focus was handed to it — and focus on a hidden element is
           * silently dropped, which is the bug this whole handler exists to
           * fix. Setting the progress directly renders it now; the scrub then
           * eases from that value to the same value and nothing moves.
           */
          tl.progress(BEATS.emergeEnd / TOTAL);
          list.querySelector<HTMLAnchorElement>('a')?.focus();
        };

        skip?.addEventListener('click', onSkip);

        return () => {
          ScrollTrigger.removeEventListener('refreshInit', measure);
          skip?.removeEventListener('click', onSkip);
          stage.removeAttribute('data-ready');
          stage.classList.remove('is-pinned');
        };
      });
    },
    { scope: root },
  );
}
