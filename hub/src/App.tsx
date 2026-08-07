import { useRef, type CSSProperties } from 'react';
import Colophon from './components/Colophon';
import Head from './components/Head';
import Index from './components/Index';
import Pitch from './components/Pitch';
import Roles from './components/Roles';
import Showcase from './components/Showcase';
import {
  CANVAS,
  CARD_Z,
  CHROME_Z,
  HEAD_FRACTION,
  HEAD_OPEN_RISE,
  HEAD_Z,
  LIP_LINE,
  SKY_Z,
} from './head';
import { HEAD_HEIGHT_VH, LID_ANGLE, LIP_END_VH, LIP_REST_VH } from './choreography';
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
  '--lip-rest-mobile': LIP_REST_VH.mobile,
  '--lip-rest-desktop': LIP_REST_VH.desktop,
  '--lip-end': `${LIP_END_VH}vh`,
  '--lip-line': LIP_LINE,
  '--head-fraction': HEAD_FRACTION,
  '--head-open-rise': HEAD_OPEN_RISE,
  '--head-vh-mobile': HEAD_HEIGHT_VH.mobile,
  '--head-vh-desktop': HEAD_HEIGHT_VH.desktop,
  '--canvas-aspect': CANVAS.w / CANVAS.h,
  '--lid-angle': `${LID_ANGLE}deg`,
  '--sky-z': SKY_Z,
  '--card-z': CARD_Z,
  '--head-z': HEAD_Z,
  '--chrome-z': CHROME_Z,
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
        {/*
          Under the index, not inside it: the work is the argument and this is
          the support for it, and the skip link's `#work` target stays one
          section about one subject.
        */}
        <Roles />
        <Colophon />
      </main>
    </>
  );
}
