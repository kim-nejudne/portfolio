import CvButton from './CvButton';
import { NAME, PITCH_LINES, PITCH_META_SET, STACK_SET, AVAILABILITY_SET } from '../identity';

/**
 * The rest state.
 *
 * One name, one sentence, and the three lines of evidence that have to survive
 * a six-second skim. Everything else is the work.
 *
 * The eyebrow is the name alone. It carried the job title until 2026-08-07,
 * directly above an H1 that made the same claim in different words, so the
 * title moved down into the sentence that was already saying it better and the
 * eyebrow went back to doing the one job an eyebrow has. See `identity.ts`,
 * which is where every string here lives.
 *
 * ## The three mono lines, and why they are in this order
 *
 * Added 2026-08-11. Before that the fold was name, H1, one evidence line, and a
 * button, and it named no technology at all: someone scanning for React or
 * Postgres found nothing, on a page arguing for a senior full-stack seat.
 *
 * They read in the order a recruiter asks the questions. **Stack** is the
 * filter, and it goes first because a reader who does not match it should be
 * able to leave in two seconds rather than six. **Evidence** is the scale, and
 * it answers the "yes, but how much" that follows. **Availability** is last
 * because it is only worth reading once the first two have landed, and it is
 * the one line here that is about what to do rather than about who Kim is.
 *
 * All three are strings from `identity.ts` rather than literals, so none of
 * them can drift, and none of them needs an entry in `identity-check.mjs`. The
 * typeset `_SET` forms are used rather than the plain ones: each is bound so a
 * wrap can only fold at a separator. `verify.mjs` compares them against the
 * plain strings and collapses whitespace to do it, so the assertions see the
 * sentences and not the binding.
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
      <p className="pitch-stack mono">{STACK_SET}</p>
      <p className="pitch-meta mono">{PITCH_META_SET}</p>
      <p className="pitch-avail mono">{AVAILABILITY_SET}</p>
      {/*
        Inside the pitch on purpose, so it fades with it.

        The timeline takes this whole block to `autoAlpha: 0` over the first ten
        scroll units, and the sky it occupies is where the first card climbs. That
        is the right behaviour for a button and not merely a tolerable one:
        `autoAlpha` writes `visibility: hidden`, which takes the anchor out of
        the tab order rather than leaving an invisible target for a keyboard
        user to land on. The copy in the colophon is the one for everyone past
        the fold, and `useHubTimeline` needed no change to make any of it true.

        The second link is deliberately not a second button. One primary action
        per screen, and the work is already reachable three other ways: the skip
        link, the scroll, and the index. This exists because a recruiter who has
        just read the stack line wants the products and should not have to guess
        that scrolling is how. It points at `#work`, the same always-present
        list the skip link uses, so it needs nothing to run and cannot land
        somewhere the choreography has moved.
      */}
      <div className="pitch-actions">
        <CvButton />
        <a className="pitch-jump mono" href="#work">
          See the work
          <span aria-hidden="true"> →</span>
        </a>
      </div>
    </div>
  );
}
