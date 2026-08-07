import CvButton from './CvButton';

/**
 * The rest state.
 *
 * One name, one sentence, one line of evidence. The hub gets about five
 * seconds on a skim, and this is all of the argument that has to survive them
 * — everything else is the work.
 */
export default function Pitch() {
  return (
    <div className="pitch" data-pitch>
      <p className="pitch-name mono">Kim Nejudne — Design Engineer</p>
      <h1 className="pitch-line">
        Full-stack engineer
        <br />
        with a designer&rsquo;s eye.
      </h1>
      <p className="pitch-meta mono">
        Nine years of production JavaScript · An editorial background · Motion that ships at 60fps
      </p>
      {/*
        Inside the pitch on purpose, so it fades with it.

        The timeline takes this whole block to `autoAlpha: 0` over the first ten
        scroll units — the sky it occupies is where the first card climbs. That
        is the right behaviour for a button and not merely a tolerable one:
        `autoAlpha` writes `visibility: hidden`, which takes the anchor out of
        the tab order rather than leaving an invisible target for a keyboard
        user to land on. The copy in the colophon is the one for everyone past
        the fold, and `useHubTimeline` needed no change to make any of it true.
      */}
      <CvButton />
    </div>
  );
}
