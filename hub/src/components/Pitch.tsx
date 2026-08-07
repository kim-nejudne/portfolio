import CvButton from './CvButton';
import { NAME, PITCH_LINES, PITCH_META } from '../identity';

/**
 * The rest state.
 *
 * One name, one sentence, one line of evidence. The hub gets about five
 * seconds on a skim, and this is all of the argument that has to survive them.
 * Everything else is the work.
 *
 * The eyebrow is the name alone. It carried the job title until 2026-08-07,
 * directly above an H1 that made the same claim in different words, so the
 * title moved down into the sentence that was already saying it better and the
 * eyebrow went back to doing the one job an eyebrow has. See `identity.ts`,
 * which is where all four of these strings live now.
 */
export default function Pitch() {
  return (
    <div className="pitch" data-pitch>
      <p className="pitch-name mono">{NAME}</p>
      <h1 className="pitch-line">
        {PITCH_LINES[0]}
        <br />
        {PITCH_LINES[1]}
      </h1>
      <p className="pitch-meta mono">{PITCH_META}</p>
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
