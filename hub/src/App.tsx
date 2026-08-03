import { useRef, type CSSProperties } from 'react';
import Colophon from './components/Colophon';
import Head from './components/Head';
import Index from './components/Index';
import Pitch from './components/Pitch';
import Showcase from './components/Showcase';
import { CANVAS, CARD_Z, EYE_LINE, HEAD_FRACTION, HEAD_OPEN_RISE } from './head';
import { EYE_END_VH, EYE_REST_VH, HEAD_HEIGHT_VH, LID_ANGLE, LID_TILT } from './choreography';
import { useHubTimeline } from './hooks/useHubTimeline';

/**
 * The numbers that both the stylesheet and the timeline need, handed to CSS as
 * custom properties from the same TypeScript constants the timeline reads.
 *
 * Layout belongs in CSS and choreography belongs in GSAP, but they have to
 * agree about where the eyes are or the descent will overshoot. Rather than
 * write the figures twice, they are declared once in `choreography.ts` and
 * `head.ts` and injected here. The head is sized crown-to-chin rather than by
 * its artboard, because the artboard also carries shoulders and margin and
 * sizing by it makes the head itself unpredictably small.
 */
const vars = {
  '--eye-rest-mobile': EYE_REST_VH.mobile,
  '--eye-rest-desktop': EYE_REST_VH.desktop,
  '--eye-end': `${EYE_END_VH}vh`,
  '--eye-line': EYE_LINE,
  '--head-fraction': HEAD_FRACTION,
  '--head-open-rise': HEAD_OPEN_RISE,
  '--head-vh-mobile': HEAD_HEIGHT_VH.mobile,
  '--head-vh-desktop': HEAD_HEIGHT_VH.desktop,
  '--canvas-aspect': CANVAS.w / CANVAS.h,
  '--lid-angle': `${LID_ANGLE}deg`,
  '--lid-tilt': `${LID_TILT}deg`,
  '--card-z': CARD_Z,
} as CSSProperties;

export default function App() {
  const stage = useRef<HTMLElement>(null);
  useHubTimeline(stage);

  return (
    <>
      {/*
        An ordinary anchor to an ordinary list. It needs no JavaScript, no
        scroll arithmetic and no knowledge of the timeline, because the thing
        it points at sits below the pinned section and is always visible.
      */}
      <a className="skip mono" href="#work">
        Skip to the work
      </a>
      <main>
        <section className="stage" ref={stage} style={vars}>
          <div className="stage-inner">
            <Pitch />
            <Head />
            <Showcase />
          </div>
          <p className="cue mono" data-cue aria-hidden="true">
            Scroll
          </p>
        </section>
        <Index />
        <Colophon />
      </main>
    </>
  );
}
